from __future__ import annotations
from fastapi import APIRouter

from app.data.api.dependencies import get_core_data
from app.data.api.schemas import CategoryAnalytics

router = APIRouter(prefix="/categories", tags=["Catégories"])


@router.get("", response_model=list[CategoryAnalytics], summary="Analyse par catégorie de contenu")
def list_categories() -> list[CategoryAnalytics]:
    data = get_core_data()
    ca = data.descriptive["cat_analytics"]
    return [
        CategoryAnalytics(
            category=cat, retention=float(row["retention"]),
            completion_rate=float(row["completion_rate"]),
            abandon_rate=float(row["abandon_rate"]),
            pauses_per_min=float(row["pauses_per_min"]),
            seek_per_min=float(row["seek_per_min"]),
            first_abandon=float(row["first_abandon"]),
            rewind_ratio=float(row["rewind_ratio"]),
            duree_moyenne_sec=float(row["duree_moyenne_sec"]),
            n_abandons=int(row["n_abandons"]),
            abandon_time_sec=float(row["abandon_time_sec"]),
        )
        for cat, row in ca.iterrows()
    ]
