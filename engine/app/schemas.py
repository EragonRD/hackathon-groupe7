"""Schémas Pydantic — alignés 1:1 sur le contrat docs/P3A-metadata-schema.md."""

from typing import Optional

from pydantic import BaseModel, Field


class Segment(BaseModel):
    start: float
    end: float
    text: str


class Translation(BaseModel):
    lang: str
    text: str


class TranslationTrack(BaseModel):
    """Une piste de traduction = texte complet + sous-titres horodatés."""

    lang: str
    text: str
    segments: list["Segment"] = []


class Chapter(BaseModel):
    title: str
    start: float


class VideoMetadata(BaseModel):
    """Sortie du pipeline P3-A (contrat JSON)."""

    video: str
    language: str
    duration_sec: float
    transcript: str
    segments: list[Segment]
    translation: Translation  # compat contrat : 1re langue cible
    translations: list[TranslationTrack] = []  # multilingue + sous-titres
    summary: str
    chapters: list[Chapter]
    keywords: list[str]
    generated_at: str


# --- API I/O ---
class AnalyzePathRequest(BaseModel):
    path: str = Field(..., description="Chemin local d'un fichier vidéo (test/démo)")


class JobCreated(BaseModel):
    job_id: str
    status: str  # processing


class JobStatus(BaseModel):
    job_id: str
    status: str  # processing | done | error
    result: Optional[VideoMetadata] = None
    error: Optional[str] = None
    output_dir: Optional[str] = None  # dossier généré (vidéo + JSON par langue)


class SearchRequest(BaseModel):
    job_id: str
    query: str
    k: int = 3


class TranslateRequest(BaseModel):
    job_id: str
    lang: str  # code ISO 639-1 cible (ex. "en", "es", "ar")


class SearchHit(BaseModel):
    start: float
    end: float
    text: str
    score: float


class SearchResponse(BaseModel):
    query: str
    hits: list[SearchHit]
