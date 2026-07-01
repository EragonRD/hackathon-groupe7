"""Prédiction d'abandon de session (classification) à partir des logs (bonus — 31).

Cible : la session se termine-t-elle par un `abandon` (1) ou un visionnage
normal jusqu'à `ended` (0) ?

Features volontairement limitées à ce qui est connu ou estimable AVANT/AU
DÉBUT de la session, sans suivi en temps réel : catégorie, durée de la vidéo,
nombre de pauses potentielles. Aucune fuite de la cible.
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, confusion_matrix, roc_curve)

RANDOM_STATE = 42
CUTOFF = 0.20  # on n'observe que les 20 premiers % de la vidéo


def build_churn_labels(logs: pd.DataFrame, sessions: pd.DataFrame) -> pd.Series:
    """1 = la session s'est terminée par un abandon, 0 = elle est allée jusqu'à `ended`."""
    term = (logs[logs["event_type"].isin(["abandon", "ended"])]
           .set_index("session_id")["event_type"])
    return (term == "abandon").astype(int).reindex(sessions.index).rename("abandoned")


def build_churn_features(logs: pd.DataFrame, sessions: pd.DataFrame, videos: pd.DataFrame,
                         cutoff: float = CUTOFF) -> pd.DataFrame:
    """Features : catégorie, durée de la vidéo, nombre de pauses dans les
    `cutoff` premiers % (« pauses potentielles »). Rien d'autre."""
    vmeta = videos.set_index("video_id")
    early = logs[logs["rel_pos"] <= cutoff]
    n_pause = early[early["event_type"] == "pause"].groupby("session_id").size()

    X = pd.DataFrame(index=sessions.index)
    X["duration_sec"] = sessions["duration_sec"]
    X["n_pause_early"] = n_pause.reindex(X.index, fill_value=0)
    X["category"] = sessions["video_id"].map(vmeta["category"])
    return pd.get_dummies(X, columns=["category"])


def get_models() -> dict:
    return {
        "LogisticRegression": Pipeline([("scale", StandardScaler()),
                                        ("model", LogisticRegression(max_iter=1000))]),
        "RandomForest": RandomForestClassifier(
            n_estimators=300, max_depth=5, random_state=RANDOM_STATE),
    }


@dataclass
class ClfResult:
    name: str
    accuracy: float
    precision: float
    recall: float
    f1: float
    auc: float
    predictions: np.ndarray
    probabilities: np.ndarray


def evaluate_churn_models(X: pd.DataFrame, y: pd.Series, n_splits: int = 5) -> dict:
    """Validation croisée stratifiée (n=1250 sessions, K-fold adapté à cette taille,
    contrairement au LOO-CV utilisé ailleurs pour les 25 vidéos)."""
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)
    results: dict[str, ClfResult] = {}

    maj = int(y.mean() > 0.5)
    base_pred = np.full(len(y), maj)
    base_proba = base_pred.astype(float)
    results["Baseline (majorité)"] = ClfResult(
        "Baseline (majorité)", accuracy_score(y, base_pred),
        precision_score(y, base_pred, zero_division=0),
        recall_score(y, base_pred, zero_division=0),
        f1_score(y, base_pred, zero_division=0), float("nan"), base_pred, base_proba)

    for name, model in get_models().items():
        pred = cross_val_predict(model, X, y, cv=cv, method="predict")
        proba = cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]
        results[name] = ClfResult(
            name, accuracy_score(y, pred),
            precision_score(y, pred, zero_division=0),
            recall_score(y, pred, zero_division=0),
            f1_score(y, pred, zero_division=0),
            roc_auc_score(y, proba), pred, proba)
    return results


def best_model_name(results: dict) -> str:
    """Meilleur modèle (hors baseline) au sens F1."""
    cands = {k: v for k, v in results.items() if not k.startswith("Baseline")}
    return max(cands, key=lambda k: cands[k].f1)


def feature_importance(X: pd.DataFrame, y: pd.Series) -> pd.Series:
    rf = RandomForestClassifier(n_estimators=300, max_depth=5,
                                random_state=RANDOM_STATE).fit(X, y)
    return pd.Series(rf.feature_importances_, index=X.columns,
                     name="importance").sort_values(ascending=False)


def fit_final(X: pd.DataFrame, y: pd.Series, name: str):
    model = get_models()[name]
    model.fit(X, y)
    return model


def confusion(y: pd.Series, predictions: np.ndarray) -> np.ndarray:
    return confusion_matrix(y, predictions)


def roc_points(y: pd.Series, probabilities: np.ndarray):
    """(fpr, tpr) pour tracer la courbe ROC."""
    fpr, tpr, _ = roc_curve(y, probabilities)
    return fpr, tpr
