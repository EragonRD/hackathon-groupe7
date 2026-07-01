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


def _friction_regions(logs: pd.DataFrame, sessions: pd.DataFrame, video_id: str,
                      duration_sec: int, n_bins: int = N_BINS,
                      quantile: float = THRESHOLD_QUANTILE) -> list[tuple[int, int]]:
    """Pics ponctuels de friction comportementale (pause/seek/abandon/chute)."""
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


# décrochage prolongé : perte cumulée minimale (en part d'audience) pour
# qu'une descente continue de la courbe de rétention soit marquée « ennui »
MIN_DECLINE_DROP = 0.10
# nombre de bins plats tolérés à l'intérieur d'une descente (pour ne pas la
# couper en morceaux à cause d'un bin sans perte au milieu)
MAX_DECLINE_GAP_BINS = 2


def detect_declines(sessions: pd.DataFrame, video_id: str, duration_sec: int,
                    n_bins: int = N_BINS, min_total_drop: float = MIN_DECLINE_DROP,
                    max_gap_bins: int = MAX_DECLINE_GAP_BINS) -> list[tuple[int, int]]:
    """Décrochages progressifs : la courbe de rétention est strictement
    décroissante (aucune remontée possible, cf. `retention_curve`) — on
    marque donc, depuis le début d'une baisse continue jusqu'à ce qu'elle se
    stabilise (stagnation), toute descente dont la perte cumulée d'audience
    dépasse `min_total_drop`. Contrairement au signal de friction (basé sur
    des pics de pause/seek/abandon), ceci capte aussi les décrochages lents
    et longs qui ne génèrent pas de sursaut de comportement marqué.
    """
    r = retention_curve(sessions, video_id, n_bins)
    drop = np.maximum(r[:-1] - r[1:], 0.0)
    active = drop > 1e-9
    n = len(active)

    regions: list[tuple[int, int]] = []
    i = 0
    while i < n:
        if not active[i]:
            i += 1
            continue
        j = i
        last_active = i
        while j < n:
            if active[j]:
                last_active = j
                j += 1
            elif j - last_active <= max_gap_bins:
                j += 1  # petit plat toléré au milieu d'une descente
            else:
                break
        end = last_active + 1  # position où la courbe se stabilise
        if r[i] - r[end] >= min_total_drop:
            regions.append((int(i / n_bins * duration_sec),
                            int(end / n_bins * duration_sec)))
        i = j
    return regions


def _merge_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not intervals:
        return []
    ordered = sorted(intervals)
    merged = [list(ordered[0])]
    for a, b in ordered[1:]:
        if a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return [tuple(x) for x in merged]


def detect_hotspots(logs: pd.DataFrame, sessions: pd.DataFrame, video_id: str,
                    duration_sec: int, n_bins: int = N_BINS,
                    quantile: float = THRESHOLD_QUANTILE) -> list[tuple[int, int]]:
    """Renvoie les zones d'ennui détectées en SECONDES : [(start, end), ...].

    Union de deux signaux complémentaires :
      - pics de friction comportementale (pause/seek/abandon/chute ponctuelle)
      - décrochages progressifs et prolongés de la courbe de rétention
    """
    regions = (_friction_regions(logs, sessions, video_id, duration_sec, n_bins, quantile)
              + detect_declines(sessions, video_id, duration_sec, n_bins))
    return _merge_intervals(regions)


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
