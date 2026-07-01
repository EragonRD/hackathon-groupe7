"""Rétention : cible, courbes par vidéo, taux de complétion.

Définition (cf. DATA_SCHEMA.md) :
  rétention d'une vidéo = moyenne, sur ses sessions, de
  (position_max_atteinte / durée). Valeur entre 0 et 1.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

N_BINS = 100  # on raisonne en % de la vidéo -> courbes comparables entre vidéos


def retention_target(sessions: pd.DataFrame) -> pd.Series:
    """CIBLE : rétention moyenne par vidéo (à prédire / à valider, jamais en feature)."""
    return sessions.groupby("video_id")["rel_max"].mean().rename("retention")


def completion_rate(sessions: pd.DataFrame) -> pd.Series:
    """Part des sessions qui atteignent la fin de la vidéo."""
    return sessions.groupby("video_id")["completed"].mean().rename("completion_rate")


def retention_curve(sessions: pd.DataFrame, video_id: str, n_bins: int = N_BINS) -> np.ndarray:
    """Courbe de rétention : fraction de sessions encore présentes à chaque position (%).

    R(p) = part des sessions dont la position max atteinte >= p.
    Courbe décroissante de 1 (début) vers la rétention finale.
    """
    s = sessions[sessions["video_id"] == video_id]
    grid = np.arange(n_bins) / n_bins
    return np.array([(s["rel_max"] >= g).mean() for g in grid])


def retention_at(sessions: pd.DataFrame, video_id: str, pct: float) -> float:
    """Rétention à une position relative donnée (ex. 0.10 = après les 10 premiers %)."""
    s = sessions[sessions["video_id"] == video_id]
    return float((s["rel_max"] >= pct).mean())
