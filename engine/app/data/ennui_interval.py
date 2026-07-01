"""Prédiction de l'intervalle d'ennui à partir des seules métadonnées vidéo (bonus — 31).

Utilise UNIQUEMENT `videos.csv` (catégorie, durée) et le corrigé
`ground_truth_hotspots.csv` comme cible — aucune donnée de visionnage (logs)
n'entre dans ce modèle. Objectif : avant même la mise en ligne d'une vidéo,
estimer où un passage risque de perdre l'audience, à partir de son seul
descriptif (catégorie + durée).

Pour les vidéos ayant plusieurs zones annotées, on retient la plus large
comme zone d'ennui « principale » à prédire (start_rel : position relative
0..1 du début ; width_rel : largeur relative de la zone).

⚠️ On prédit `start_rel` et `width_rel` (pas `end_rel`) : start et end sont
prédits par deux modèles entraînés indépendamment, donc rien ne garantit
end >= start si on les prédit séparément. En prédisant une LARGEUR (toujours
>= 0) et en l'ajoutant au début prédit, la fin est structurellement après le
début, quels que soient les deux modèles retenus.
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

RANDOM_STATE = 42


def build_interval_target(ground_truth: pd.DataFrame, videos: pd.DataFrame) -> pd.DataFrame:
    """Par vidéo : intervalle d'ennui principal, en secondes ET en position
    relative [0, 1] (bornée : certaines annotations dépassent légèrement la
    durée réelle par arrondi)."""
    gt = ground_truth.copy()
    gt["width"] = gt["hotspot_end"] - gt["hotspot_start"]
    primary = gt.loc[gt.groupby("video_id")["width"].idxmax()].set_index("video_id")
    dur = videos.set_index("video_id")["duration_sec"]
    primary = primary.join(dur)
    primary["start_rel"] = (primary["hotspot_start"] / primary["duration_sec"]).clip(0, 1)
    primary["end_rel"] = (primary["hotspot_end"] / primary["duration_sec"]).clip(0, 1)
    primary["width_rel"] = (primary["end_rel"] - primary["start_rel"]).clip(lower=0)
    return primary[["hotspot_start", "hotspot_end", "duration_sec",
                    "start_rel", "end_rel", "width_rel"]]


def build_interval_features(videos: pd.DataFrame) -> pd.DataFrame:
    """Features dispo AVANT toute mise en ligne : catégorie + durée uniquement."""
    X = videos.set_index("video_id")[["duration_sec", "category"]].copy()
    return pd.get_dummies(X, columns=["category"])


def get_models() -> dict:
    return {
        "Ridge": Pipeline([("scale", StandardScaler()), ("model", Ridge(alpha=1.0))]),
        "RandomForest": RandomForestRegressor(
            n_estimators=300, max_depth=4, random_state=RANDOM_STATE),
    }


@dataclass
class CVResult:
    name: str
    mae: float
    r2: float
    predictions: np.ndarray


def evaluate_interval_models(X: pd.DataFrame, y: pd.Series) -> dict:
    """LOO-CV (n=25) : MAE/R² pour chaque modèle + baseline (position moyenne)."""
    loo = LeaveOneOut()
    results: dict[str, CVResult] = {}

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
    """Meilleur modèle (baseline incluse : sur un si petit échantillon, elle
    gagne parfois — c'est un résultat honnête, pas un bug)."""
    return min(results, key=lambda k: results[k].mae)


def fit_final(X: pd.DataFrame, y: pd.Series, name: str):
    model = get_models().get(name)
    if model is None:  # baseline retenue : "modèle" = moyenne constante
        mean_val = float(y.mean())
        class _Mean:
            def predict(self, X):
                return np.full(len(X), mean_val)
        return _Mean()
    model.fit(X, y)
    return model
