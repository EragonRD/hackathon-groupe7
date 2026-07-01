"""Modèles Pydantic — contrats de requête/réponse de l'API bonus P3-B.

Servent aussi à générer la doc interactive OpenAPI (/docs, /redoc).
"""
from __future__ import annotations
from pydantic import BaseModel, Field


class VideoSummary(BaseModel):
    video_id: str
    title: str
    category: str
    duration_sec: int
    retention: float = Field(description="Part moyenne de la vidéo regardée avant de partir (0-1)")
    completion_rate: float = Field(description="Part des sessions qui vont jusqu'au bout (0-1)")
    abandon_rate: float = Field(description="Part des visionnages qui s'arrêtent brusquement (0-1)")
    first_pause_sec: float | None = Field(
        default=None, description="Instant moyen (s) de la 1re pause")


class RetentionCurve(BaseModel):
    video_id: str
    positions_sec: list[float]
    retention: list[float] = Field(description="% audience encore présente à chaque position")


class FrictionSignal(BaseModel):
    video_id: str
    positions_sec: list[float]
    signal: list[float] = Field(description="Signal de friction (base de la détection de zones d'ennui)")


class Hotspot(BaseModel):
    start_sec: int
    end_sec: int


class VideoHotspots(BaseModel):
    video_id: str
    hotspots: list[Hotspot]


class Recommendations(BaseModel):
    video_id: str
    tips: list[str]


class CategoryAnalytics(BaseModel):
    category: str
    retention: float
    completion_rate: float
    abandon_rate: float
    pauses_per_min: float
    seek_per_min: float
    first_abandon: float = Field(description="Instant moyen du 1er abandon, en % de la vidéo")
    rewind_ratio: float
    duree_moyenne_sec: float
    n_abandons: int
    abandon_time_sec: float


class ComparisonEntry(BaseModel):
    video_id: str
    title: str
    category: str
    retention: float
    completion_rate: float
    duration_sec: int
    abandon_rate: float


class GlobalKPIs(BaseModel):
    n_videos: int
    n_sessions: int
    avg_retention: float
    global_abandon_rate: float


class ModelScore(BaseModel):
    model: str
    mae: float | None = None
    r2: float | None = None
    accuracy: float | None = None
    precision: float | None = None
    recall: float | None = None
    f1: float | None = None
    auc: float | None = None


class FeatureImportance(BaseModel):
    feature: str
    importance: float


class ModelInfo(BaseModel):
    best_model: str
    scores: list[ModelScore]
    feature_importance: list[FeatureImportance] = []


class HotspotIntervalRequest(BaseModel):
    category: str
    duration_sec: int = Field(gt=0)


class HotspotIntervalPrediction(BaseModel):
    category: str
    duration_sec: int
    start_sec: float
    end_sec: float
    start_rel: float
    width_rel: float


class ChurnRequest(BaseModel):
    category: str
    duration_sec: int = Field(gt=0)
    n_pause_early: int = Field(ge=0, default=0, description="Pauses potentielles dans les 20 premiers % de la vidéo")


class ChurnPrediction(BaseModel):
    category: str
    duration_sec: int
    n_pause_early: int
    churn_probability: float
