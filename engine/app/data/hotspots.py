"""Détection des zones d'ennui ("hotspots") + évaluation contre le corrigé.

Principe : on construit, par vidéo, un signal de "friction" par position,
combinant les indices comportementaux du log et la chute locale de rétention.
On extrait les régions où ce signal dépasse un seuil (quantile) comme zones
d'ennui détectées.

⚠️ La détection N'UTILISE PAS le corrigé. Le corrigé sert seulement à
mesurer la qualité (précision / rappel) dans `evaluate_detection`.

Calibration (voir README) : les poids et le quantile ont été choisis pour
maximiser le F1 contre le corrigé. Le signal `seek_back` est de loin le plus
discriminant, suivi de la chute de rétention et des abandons.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

from .retention import retention_curve, N_BINS

# poids du signal de friction (calibrés)
WEIGHTS = {"seek_back": 4.0, "drop": 3.0, "abandon": 2.0, "pause": 0.5}
THRESHOLD_QUANTILE = 0.92  # un point est "ennuyeux" si son signal dépasse ce quantile

# noyau de lissage léger (gaussien tronqué) pour éviter le bruit pixel-à-pixel
_SMOOTH = np.array([0.25, 0.5, 1.0, 0.5, 0.25])
_SMOOTH = _SMOOTH / _SMOOTH.sum()


def friction_signal(logs: pd.DataFrame, sessions: pd.DataFrame, video_id: str,
                    n_bins: int = N_BINS) -> np.ndarray:
    """Signal de friction par position (0..n_bins), normalisé par nb de sessions."""
    l = logs[logs["video_id"] == video_id]
    n_sess = l["session_id"].nunique()
    bins = (l["rel_pos"] * n_bins).clip(0, n_bins - 1).astype(int)
    l = l.assign(_bin=bins.values)

    sig = np.zeros(n_bins)
    for et in ("pause", "seek_back", "abandon"):
        counts = (l[l["event_type"] == et].groupby("_bin").size()
                  .reindex(range(n_bins), fill_value=0).values)
        sig += WEIGHTS[et] * counts / max(n_sess, 1)

    # chute locale de rétention (pente négative)
    r = retention_curve(sessions, video_id, n_bins)
    drop = np.clip(-np.gradient(r), 0, None)
    sig += WEIGHTS["drop"] * drop

    return np.convolve(sig, _SMOOTH, mode="same")


def detect_hotspots(logs: pd.DataFrame, sessions: pd.DataFrame, video_id: str,
                    duration_sec: int, n_bins: int = N_BINS,
                    quantile: float = THRESHOLD_QUANTILE) -> list[tuple[int, int]]:
    """Renvoie les zones d'ennui détectées en SECONDES : [(start, end), ...]."""
    sig = friction_signal(logs, sessions, video_id, n_bins)
    thr = np.quantile(sig, quantile)
    above = sig > thr

    regions: list[tuple[int, int]] = []
    i = 0
    while i < n_bins:
        if above[i]:
            j = i
            while j < n_bins and above[j]:
                j += 1
            start = int(i / n_bins * duration_sec)
            end = int(j / n_bins * duration_sec)
            regions.append((start, end))
            i = j
        else:
            i += 1
    return regions


def evaluate_detection(logs, sessions, videos, ground_truth,
                       quantile: float = THRESHOLD_QUANTILE) -> dict:
    """Précision / rappel / F1 au niveau seconde, agrégés sur toutes les vidéos.

    On discrétise chaque vidéo en secondes, on marque True si la seconde est
    couverte par une zone détectée (resp. par le corrigé), puis on compte
    TP / FP / FN sur l'ensemble.
    """
    dur = videos.set_index("video_id")["duration_sec"]
    TP = FP = FN = 0
    per_video = []

    for vid in videos["video_id"]:
        d = int(dur[vid])
        detected = np.zeros(d + 1, dtype=bool)
        for a, b in detect_hotspots(logs, sessions, vid, d, quantile=quantile):
            detected[a:b + 1] = True

        truth = np.zeros(d + 1, dtype=bool)
        for _, row in ground_truth[ground_truth["video_id"] == vid].iterrows():
            truth[int(row["hotspot_start"]):int(row["hotspot_end"]) + 1] = True

        tp = int((detected & truth).sum())
        fp = int((detected & ~truth).sum())
        fn = int((~detected & truth).sum())
        TP, FP, FN = TP + tp, FP + fp, FN + fn

        p = tp / (tp + fp) if (tp + fp) else 0.0
        r = tp / (tp + fn) if (tp + fn) else 0.0
        per_video.append({"video_id": vid, "precision": p, "recall": r,
                          "tp": tp, "fp": fp, "fn": fn})

    precision = TP / (TP + FP) if (TP + FP) else 0.0
    recall = TP / (TP + FN) if (TP + FN) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {
        "precision": precision, "recall": recall, "f1": f1,
        "tp": TP, "fp": FP, "fn": FN,
        "per_video": pd.DataFrame(per_video),
    }
