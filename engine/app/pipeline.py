"""Orchestration P3-A (T10 — Rabah) : vidéo → métadonnées (contrat JSON) + index de recherche."""

import subprocess
from datetime import datetime, timezone

from . import config, models, output
from .nlp import search as search_mod
from .nlp import summarize as sum_mod
from .nlp import transcribe as tr_mod
from .nlp import translate as translate_mod


def _duration_sec(path: str) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path]
    )
    return round(float(out), 1)


def analyze(video_path: str, video_name: str, out_root: str | None = None, force: bool = False):
    """Exécute le pipeline complet.

    Retourne (metadata: dict conforme au contrat, segments: list, index: np.ndarray).
    Cache : si le dossier de la vidéo existe déjà avec ses traductions, on ne régénère pas
    (et on ne traduit que les langues éventuellement manquantes). `force=True` ignore le cache.
    """
    requested = [lang for lang in config.TARGET_LANGS if lang in translate_mod.LANG_TO_NLLB]

    cached = None if force else output.load_meta(video_name, out_root)
    if cached and cached.get("segments"):
        existing = {t.get("lang") for t in cached.get("translations", [])}
        missing = [lang for lang in requested if lang not in existing]
        segments = cached["segments"]
        if not missing:
            # tout existe déjà → aucune (re)traduction
            return cached, segments, search_mod.build_index(segments)
        # incrémental : transcription/résumé réutilisés, on ne traduit que le manquant
        cached["translations"] = cached.get("translations", []) + translate_mod.translate_all(
            cached.get("transcript", ""), segments, cached.get("language", ""), missing
        )
        cached["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return cached, segments, search_mod.build_index(segments)

    duration = _duration_sec(video_path)
    tr = tr_mod.transcribe(video_path)
    transcript, segments, language = tr["transcript"], tr["segments"], tr["language"]

    # 1) LLM (résumé / chapitres) + mots-clés (embeddings)
    summary = sum_mod.summarize(transcript, language)
    chapters = sum_mod.make_chapters(segments)
    keywords = sum_mod.extract_keywords(transcript)

    # 2) libère le LLM avant NLLB (RAM limitée), puis traductions multilingues + sous-titres
    models.unload_llm()
    translations = translate_mod.translate_all(transcript, segments, language, config.TARGET_LANGS)

    # compat contrat : `translation` = 1re langue cible != source
    primary = next(
        (t for t in translations if t["lang"][:2] != (language or "")[:2]),
        translations[0] if translations else {"lang": "en", "text": ""},
    )

    metadata = {
        "video": video_name,
        "language": language,
        "duration_sec": duration,
        "transcript": transcript,
        "segments": segments,
        "translation": {"lang": primary["lang"], "text": primary["text"]},
        "translations": translations,
        "summary": summary,
        "chapters": chapters,
        "keywords": keywords,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    index = search_mod.build_index(segments)
    return metadata, segments, index
