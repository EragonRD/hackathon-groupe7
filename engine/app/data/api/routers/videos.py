from __future__ import annotations
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

from app.data.api.dependencies import CoreData, get_core_data
from app.data.api.schemas import (VideoSummary, RetentionCurve, FrictionSignal,
                                   VideoHotspots, Hotspot, Recommendations)
from app.data.retention import retention_curve, N_BINS
from app.data.hotspots import friction_signal, detect_hotspots
from app.data.recommend import recommend

router = APIRouter(prefix="/videos", tags=["Vidéos"])


def _require_video(video_id: str) -> CoreData:
    data = get_core_data()
    if video_id not in data.summary.index:
        raise HTTPException(status_code=404, detail=f"Vidéo '{video_id}' introuvable")
    return data


def _to_summary(video_id: str, data: CoreData) -> VideoSummary:
    row = data.summary.loc[video_id]
    first_pause = row.get("first_pause_sec")
    return VideoSummary(
        video_id=video_id, title=row["title"], category=row["category"],
        duration_sec=int(row["duration_sec"]), retention=float(row["retention"]),
        completion_rate=float(row["completion_rate"]),
        abandon_rate=float(row.get("abandon_rate", 0.0) or 0.0),
        first_pause_sec=float(first_pause) if pd.notna(first_pause) else None,
    )


@router.get("", response_model=list[VideoSummary], summary="Liste des vidéos avec leurs métriques")
def list_videos() -> list[VideoSummary]:
    data = get_core_data()
    return [_to_summary(vid, data) for vid in data.summary.index]


@router.get("/{video_id}", response_model=VideoSummary, summary="Détail d'une vidéo")
def get_video(video_id: str) -> VideoSummary:
    data = _require_video(video_id)
    return _to_summary(video_id, data)


@router.get("/{video_id}/retention-curve", response_model=RetentionCurve,
            summary="Courbe de rétention (% audience présente par position)")
def get_retention_curve(video_id: str) -> RetentionCurve:
    data = _require_video(video_id)
    dur = int(data.summary.loc[video_id, "duration_sec"])
    curve = retention_curve(data.sessions, video_id, N_BINS)
    positions = (np.arange(N_BINS) / N_BINS * dur).tolist()
    return RetentionCurve(video_id=video_id, positions_sec=positions, retention=curve.tolist())


@router.get("/{video_id}/friction-signal", response_model=FrictionSignal,
            summary="Signal de friction par position (base de la détection de zones d'ennui)")
def get_friction_signal(video_id: str) -> FrictionSignal:
    data = _require_video(video_id)
    dur = int(data.summary.loc[video_id, "duration_sec"])
    sig = friction_signal(data.logs, data.sessions, video_id, N_BINS)
    positions = (np.arange(N_BINS) / N_BINS * dur).tolist()
    return FrictionSignal(video_id=video_id, positions_sec=positions, signal=sig.tolist())


@router.get("/{video_id}/hotspots", response_model=VideoHotspots,
            summary="Zones d'ennui détectées, en secondes")
def get_hotspots(video_id: str) -> VideoHotspots:
    data = _require_video(video_id)
    dur = int(data.summary.loc[video_id, "duration_sec"])
    zones = detect_hotspots(data.logs, data.sessions, video_id, dur)
    return VideoHotspots(video_id=video_id,
                          hotspots=[Hotspot(start_sec=a, end_sec=b) for a, b in zones])


@router.get("/{video_id}/recommendations", response_model=Recommendations,
            summary="Conseils business générés pour la vidéo")
def get_recommendations(video_id: str) -> Recommendations:
    data = _require_video(video_id)
    tips = recommend(data.logs, data.sessions, data.videos, video_id)
    return Recommendations(video_id=video_id, tips=tips)
