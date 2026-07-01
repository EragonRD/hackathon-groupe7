from __future__ import annotations
from fastapi import APIRouter

from app.data.api.dependencies import get_core_data
from app.data.api.schemas import ComparisonEntry

router = APIRouter(prefix="/comparison", tags=["Comparaison"])


@router.get("", response_model=list[ComparisonEntry],
            summary="Classement des vidéos par rétention décroissante")
def comparison() -> list[ComparisonEntry]:
    data = get_core_data()
    ranked = data.summary.sort_values("retention", ascending=False)
    return [
        ComparisonEntry(
            video_id=vid, title=row["title"], category=row["category"],
            retention=float(row["retention"]), completion_rate=float(row["completion_rate"]),
            duration_sec=int(row["duration_sec"]),
            abandon_rate=float(row.get("abandon_rate", 0.0) or 0.0),
        )
        for vid, row in ranked.iterrows()
    ]
