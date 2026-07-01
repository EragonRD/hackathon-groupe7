from __future__ import annotations
import numpy as np
import pandas as pd
from fastapi import APIRouter

from app.data.api.dependencies import get_retention_model, get_interval_model, get_churn_model
from app.data.api.schemas import (ModelInfo, ModelScore, FeatureImportance,
                                   HotspotIntervalRequest, HotspotIntervalPrediction,
                                   ChurnRequest, ChurnPrediction)

router = APIRouter(prefix="/predictions", tags=["Prédictions"])


@router.get("/retention-model", response_model=ModelInfo,
            summary="Performance du modèle de prédiction de rétention (LOO-CV)")
def retention_model_info() -> ModelInfo:
    art = get_retention_model()
    scores = [ModelScore(model=name, mae=r.mae, r2=r.r2) for name, r in art.results.items()]
    importance = [FeatureImportance(feature=f, importance=float(v))
                  for f, v in art.importance.items()]
    return ModelInfo(best_model=art.best_name, scores=scores, feature_importance=importance)


@router.post("/hotspot-interval", response_model=HotspotIntervalPrediction,
             summary="Prédit la zone de décrochage probable à partir de la catégorie et de la durée")
def predict_hotspot_interval(req: HotspotIntervalRequest) -> HotspotIntervalPrediction:
    art = get_interval_model()
    row = pd.DataFrame([{"duration_sec": req.duration_sec, "category": req.category}])
    row = pd.get_dummies(row, columns=["category"]).reindex(columns=art.X.columns, fill_value=0)
    start_rel = float(np.clip(art.model_start.predict(row)[0], 0, 1))
    width_rel = float(max(art.model_width.predict(row)[0], 0.02))
    end_rel = float(min(start_rel + width_rel, 1))
    return HotspotIntervalPrediction(
        category=req.category, duration_sec=req.duration_sec,
        start_sec=start_rel * req.duration_sec, end_sec=end_rel * req.duration_sec,
        start_rel=start_rel, width_rel=width_rel,
    )


@router.get("/hotspot-interval/metrics", response_model=ModelInfo,
            summary="Performance du modèle de prédiction d'intervalle d'ennui (début de zone)")
def hotspot_interval_metrics() -> ModelInfo:
    art = get_interval_model()
    scores = [ModelScore(model=name, mae=r.mae, r2=r.r2) for name, r in art.results_start.items()]
    return ModelInfo(best_model=art.best_start, scores=scores)


@router.post("/churn", response_model=ChurnPrediction,
             summary="Prédit la probabilité qu'une session se termine par un abandon")
def predict_churn(req: ChurnRequest) -> ChurnPrediction:
    art = get_churn_model()
    row = pd.DataFrame([{
        "duration_sec": req.duration_sec, "n_pause_early": req.n_pause_early,
        "category": req.category,
    }])
    row = pd.get_dummies(row, columns=["category"]).reindex(columns=art.X.columns, fill_value=0)
    proba = float(art.model.predict_proba(row)[0, 1])
    return ChurnPrediction(category=req.category, duration_sec=req.duration_sec,
                            n_pause_early=req.n_pause_early, churn_probability=proba)


@router.get("/churn/metrics", response_model=ModelInfo,
            summary="Performance du modèle de prédiction d'abandon (validation croisée 5 plis)")
def churn_metrics() -> ModelInfo:
    art = get_churn_model()
    scores = [
        ModelScore(model=name, accuracy=r.accuracy, precision=r.precision,
                   recall=r.recall, f1=r.f1, auc=(r.auc if r.auc == r.auc else None))
        for name, r in art.results.items()
    ]
    importance = [FeatureImportance(feature=f, importance=float(v))
                  for f, v in art.importance.items()]
    return ModelInfo(best_model=art.best_name, scores=scores, feature_importance=importance)
