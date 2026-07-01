from __future__ import annotations
from fastapi import APIRouter

from app.data.api.dependencies import get_core_data
from app.data.api.schemas import GlobalKPIs

router = APIRouter(prefix="/kpis", tags=["KPIs"])


@router.get("", response_model=GlobalKPIs, summary="Indicateurs globaux du tableau de bord")
def global_kpis() -> GlobalKPIs:
    data = get_core_data()
    return GlobalKPIs(
        n_videos=len(data.videos),
        n_sessions=int(data.sessions.shape[0]),
        avg_retention=float(data.summary["retention"].mean()),
        global_abandon_rate=float(data.descriptive["abandon_global"]),
    )
