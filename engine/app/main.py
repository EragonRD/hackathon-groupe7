"""Engine — Pôle 3 (IA & Data). API FastAPI (T10 — Rabah).

Endpoints :
  GET  /health              → sonde de vie
  POST /analyze             → upload vidéo (multipart) → job async (contrat P3-A)
  POST /analyze-path        → analyse un fichier local (test/démo) → job async
  GET  /jobs/{job_id}       → statut + résultat (métadonnées)
  POST /search              → recherche sémantique dans une vidéo analysée

Auth : JWT du Core (HS256). Refus par défaut (cf. app/auth.py).
Traitement asynchrone : l'analyse (transcription + LLM) prend du temps → job + polling.
"""

import os
import shutil
import tempfile
import threading
import uuid

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile

from . import config, pipeline
from .auth import require_service
from .nlp import search as search_mod
from .nlp import translate as translate_mod
from .output import save_outputs
from .schemas import (
    AnalyzePathRequest,
    JobCreated,
    JobStatus,
    SearchRequest,
    SearchResponse,
    TranslateRequest,
    TranslationTrack,
)

app = FastAPI(title="Engine — Pôle 3 (IA & Data)", version="0.2.0")

# Store de jobs en mémoire : job_id -> {status, result, error, segments, index}
JOBS: dict[str, dict] = {}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "engine", "pole": 3}


def _run_job(job_id: str, video_path: str, video_name: str, cleanup: bool) -> None:
    try:
        metadata, segments, index = pipeline.analyze(video_path, video_name)
        out_dir = save_outputs(metadata, video_path)
        JOBS[job_id].update(
            status="done", result=metadata, segments=segments, index=index, output_dir=out_dir
        )
    except Exception as exc:  # noqa: BLE001 — on remonte l'erreur dans le job
        JOBS[job_id].update(status="error", error=str(exc))
    finally:
        if cleanup:
            try:
                os.remove(video_path)
            except OSError:
                pass


def _start_job(video_path: str, video_name: str, cleanup: bool) -> str:
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"status": "processing", "result": None, "error": None}
    threading.Thread(
        target=_run_job, args=(job_id, video_path, video_name, cleanup), daemon=True
    ).start()
    return job_id


@app.post("/analyze", response_model=JobCreated)
async def analyze(file: UploadFile = File(...), user: dict = Depends(require_service)) -> JobCreated:
    suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as out:
        shutil.copyfileobj(file.file, out)
    job_id = _start_job(path, file.filename or "video", cleanup=True)
    return JobCreated(job_id=job_id, status="processing")


@app.post("/analyze-path", response_model=JobCreated)
def analyze_path(req: AnalyzePathRequest, user: dict = Depends(require_service)) -> JobCreated:
    # Endpoint de test/démo : DÉSACTIVÉ si aucun répertoire autorisé n'est configuré.
    if not config.ANALYZE_PATH_BASE:
        raise HTTPException(403, "/analyze-path désactivé (ANALYZE_PATH_BASE non défini)")
    base = os.path.realpath(config.ANALYZE_PATH_BASE)
    target = os.path.realpath(req.path)
    # Anti-path-traversal : le fichier résolu doit être STRICTEMENT sous `base`.
    if os.path.commonpath([base, target]) != base:
        raise HTTPException(403, "Chemin hors du répertoire autorisé")
    if not os.path.isfile(target):
        raise HTTPException(400, "Fichier introuvable")
    job_id = _start_job(target, os.path.basename(target), cleanup=False)
    return JobCreated(job_id=job_id, status="processing")


@app.get("/jobs/{job_id}", response_model=JobStatus)
def job_status(job_id: str, user: dict = Depends(require_service)) -> JobStatus:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job inconnu")
    return JobStatus(
        job_id=job_id,
        status=job["status"],
        result=job["result"],
        error=job["error"],
        output_dir=job.get("output_dir"),
    )


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest, user: dict = Depends(require_service)) -> SearchResponse:
    job = JOBS.get(req.job_id)
    if not job or job["status"] != "done":
        raise HTTPException(404, "Job inconnu ou non terminé")
    hits = search_mod.search(req.query, job["segments"], job["index"], req.k)
    return SearchResponse(query=req.query, hits=hits)


@app.post("/translate", response_model=TranslationTrack)
def translate(req: TranslateRequest, user: dict = Depends(require_service)) -> TranslationTrack:
    """Traduction À LA DEMANDE d'une langue via le pipeline (segments déjà en cache).

    Réutilise `translate_all` (même code que l'analyse). Permet au front de
    déclencher/tester une langue en temps réel sans relancer toute l'analyse.
    """
    job = JOBS.get(req.job_id)
    if not job or job["status"] != "done":
        raise HTTPException(404, "Job inconnu ou non terminé")
    result = job["result"]
    tracks = translate_mod.translate_all(
        result.get("transcript", ""), job["segments"], result.get("language", ""), [req.lang]
    )
    if not tracks:
        raise HTTPException(422, f"Traduction indisponible pour la langue '{req.lang}'")
    return TranslationTrack(**tracks[0])
