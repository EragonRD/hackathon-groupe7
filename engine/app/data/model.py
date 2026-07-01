"""Modèle de prédiction de la rétention.

Cible : rétention par vidéo (entre 0 et 1).
Évaluation : Leave-One-Out CV. Avec seulement 25 vidéos, un simple split
train/test serait trop bruité (5 vidéos en test) ; la LOO-CV donne des
métriques MAE / R² honnêtes en utilisant chaque vidéo comme test une fois.

On compare plusieurs modèles à une baseline (prédire la moyenne). Sur ce
petit échantillon, les modèles linéaires régularisés (Ridge) généralisent
souvent mieux que les arbres, qui ont tendance à surapprendre.
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

RANDOM_STATE = 42


def get_models() -> dict:
    return {
        "Ridge": Pipeline([("scale", StandardScaler()),
                           ("model", Ridge(alpha=1.0))]),
        "RandomForest": RandomForestRegressor(
            n_estimators=300, max_depth=5, random_state=RANDOM_STATE),
        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=200, max_depth=2, learning_rate=0.05,
            random_state=RANDOM_STATE),
    }


@dataclass
class CVResult:
    name: str
    mae: float
    r2: float
    predictions: np.ndarray


def evaluate_models(X: pd.DataFrame, y: pd.Series) -> dict:
    """Métriques LOO-CV pour chaque modèle + baseline (moyenne)."""
    loo = LeaveOneOut()
    results: dict[str, CVResult] = {}

    # baseline : prédire la moyenne du train à chaque pli
    base_pred = np.empty(len(y))
    for tr, te in loo.split(X):
        base_pred[te] = y.iloc[tr].mean()
    results["Baseline (moyenne)"] = CVResult(
        "Baseline (moyenne)", mean_absolute_error(y, base_pred),
        r2_score(y, base_pred), base_pred)

    for name, model in get_models().items():
        pred = cross_val_predict(model, X, y, cv=loo)
        results[name] = CVResult(name, mean_absolute_error(y, pred),
                                 r2_score(y, pred), pred)
    return results


def best_model_name(results: dict) -> str:
    """Meilleur modèle (hors baseline) au sens MAE."""
    cands = {k: v for k, v in results.items() if not k.startswith("Baseline")}
    return min(cands, key=lambda k: cands[k].mae)


def fit_final(X: pd.DataFrame, y: pd.Series, name: str):
    """Réentraîne le modèle choisi sur l'ensemble des données (pour l'inférence)."""
    model = get_models()[name]
    model.fit(X, y)
    return model


def feature_importance(X: pd.DataFrame, y: pd.Series) -> pd.Series:
    """Importance des features (RandomForest), pour la lecture business."""
    rf = RandomForestRegressor(n_estimators=300, max_depth=5,
                               random_state=RANDOM_STATE).fit(X, y)
    return pd.Series(rf.feature_importances_, index=X.columns).sort_values(ascending=False)
