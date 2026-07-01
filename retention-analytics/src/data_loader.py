"""Chargement et préparation des données de visionnage.

Source unique de vérité pour lire les CSV fournis dans `data/`.
Aucune transformation "métier" ici : on charge, on type, on ajoute la
position relative (= position / durée) qui sert partout ensuite.
"""
from __future__ import annotations
from pathlib import Path
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def load_logs(data_dir: Path = DATA_DIR) -> pd.DataFrame:
    """Logs d'évènements, enrichis de la position relative et du bin (0..99)."""
    logs = pd.read_csv(data_dir / "viewing_logs.csv")
    logs["event_time"] = pd.to_datetime(logs["event_time"])
    # position relative dans la vidéo, bornée [0, 1]
    logs["rel_pos"] = (logs["position_sec"] / logs["video_duration_sec"]).clip(0, 1)
    return logs


def load_videos(data_dir: Path = DATA_DIR) -> pd.DataFrame:
    return pd.read_csv(data_dir / "videos.csv")


def load_ground_truth(data_dir: Path = DATA_DIR) -> pd.DataFrame:
    """Corrigé des zones d'ennui. À n'utiliser QUE pour l'évaluation."""
    return pd.read_csv(data_dir / "ground_truth_hotspots.csv")


def session_table(logs: pd.DataFrame) -> pd.DataFrame:
    """Une ligne par session : vidéo, durée, position max atteinte, fraction vue.

    `rel_max` (= position_max / durée) est l'ingrédient de la CIBLE.
    Réservé à la construction de la cible et à la courbe de rétention,
    JAMAIS comme feature du modèle.
    """
    s = logs.groupby("session_id").agg(
        video_id=("video_id", "first"),
        duration_sec=("video_duration_sec", "first"),
        pos_max=("position_sec", "max"),
        n_events=("event_id", "size"),
    )
    s["rel_max"] = (s["pos_max"] / s["duration_sec"]).clip(0, 1)
    s["completed"] = s["rel_max"] >= 0.98  # quasi-fin de vidéo
    return s
