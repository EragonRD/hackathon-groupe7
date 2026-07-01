"""Chargement et mise en cache des données et modèles pour l'API bonus P3-B.

Même logique que le dashboard Streamlit (`dashboard/app.py`) : les CSV et les
modèles sont chers à recalculer, on les charge donc une seule fois par
processus (`lru_cache` sur des fonctions sans argument = mémoïsation façon
singleton). Aucune logique métier ici : uniquement l'assemblage des
fonctions de `app/data/*` (tâches 30/31/33).
"""
from __future__ import annotations
from dataclasses import dataclass
from functools import lru_cache
import pandas as pd

from app.data.data_loader import load_logs, load_videos, load_ground_truth, session_table
from app.data.retention import retention_target, completion_rate
from app.data.descriptive import (
    abandon_rate_global, abandon_rate_per_video, first_pause_time,
    category_duration, category_analytics,
)
from app.data.features import build_features
from app.data.model import evaluate_models, best_model_name, fit_final, feature_importance
from app.data.ennui_interval import (
    build_interval_target, build_interval_features, evaluate_interval_models,
    best_model_name as best_interval_name, fit_final as fit_interval_final,
)
from app.data.churn_predict import (
    build_churn_labels, build_churn_features, evaluate_churn_models,
    fit_final as fit_churn_final, best_model_name as best_churn_name,
    feature_importance as churn_feature_importance,
)


@dataclass
class CoreData:
    logs: pd.DataFrame
    videos: pd.DataFrame
    ground_truth: pd.DataFrame
    sessions: pd.DataFrame
    summary: pd.DataFrame  # videos + retention/completion/abandon/first_pause, indexé video_id
    descriptive: dict


@lru_cache
def get_core_data() -> CoreData:
    logs = load_logs()
    videos = load_videos()
    gt = load_ground_truth()
    sessions = session_table(logs)

    summary = videos.set_index("video_id").copy()
    summary["retention"] = retention_target(sessions)
    summary["completion_rate"] = completion_rate(sessions)
    summary["abandon_rate"] = abandon_rate_per_video(logs, sessions)
    summary["first_pause_sec"] = first_pause_time(logs)

    descriptive = {
        "abandon_global": abandon_rate_global(logs),
        "cat_duration": category_duration(videos),
        "cat_analytics": category_analytics(logs, videos, sessions),
    }
    return CoreData(logs, videos, gt, sessions, summary, descriptive)


@dataclass
class RetentionModelArtifacts:
    X: pd.DataFrame
    y: pd.Series
    results: dict
    best_name: str
    model: object
    importance: pd.Series


@lru_cache
def get_retention_model() -> RetentionModelArtifacts:
    data = get_core_data()
    y = retention_target(data.sessions)
    X = build_features(data.logs, data.sessions, data.videos).loc[y.index]
    results = evaluate_models(X, y)
    best = best_model_name(results)
    model = fit_final(X, y, best)
    imp = feature_importance(X, y)
    return RetentionModelArtifacts(X, y, results, best, model, imp)


@dataclass
class IntervalModelArtifacts:
    X: pd.DataFrame
    target: pd.DataFrame
    results_start: dict
    results_width: dict
    best_start: str
    best_width: str
    model_start: object
    model_width: object


@lru_cache
def get_interval_model() -> IntervalModelArtifacts:
    data = get_core_data()
    target = build_interval_target(data.ground_truth, data.videos)
    X = build_interval_features(data.videos).loc[target.index]
    results_start = evaluate_interval_models(X, target["start_rel"])
    results_width = evaluate_interval_models(X, target["width_rel"])
    best_start = best_interval_name(results_start)
    best_width = best_interval_name(results_width)
    model_start = fit_interval_final(X, target["start_rel"], best_start)
    model_width = fit_interval_final(X, target["width_rel"], best_width)
    return IntervalModelArtifacts(X, target, results_start, results_width,
                                   best_start, best_width, model_start, model_width)


@dataclass
class ChurnModelArtifacts:
    X: pd.DataFrame
    y: pd.Series
    results: dict
    best_name: str
    model: object
    importance: pd.Series


@lru_cache
def get_churn_model() -> ChurnModelArtifacts:
    data = get_core_data()
    y = build_churn_labels(data.logs, data.sessions)
    X = build_churn_features(data.logs, data.sessions, data.videos)
    results = evaluate_churn_models(X, y)
    best = best_churn_name(results)
    model = fit_churn_final(X, y, best)
    imp = churn_feature_importance(X, y)
    return ChurnModelArtifacts(X, y, results, best, model, imp)
