"""Lecture business : que conseiller pour améliorer une vidéo donnée.

Règles simples et explicables, dérivées des signaux observés (pas une
boîte noire). Objectif : transformer la détection en conseils actionnables
pour quelqu'un qui produit du contenu.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

from .retention import retention_at


def recommend(logs, sessions, videos, video_id: str) -> list[str]:
    vmeta = videos.set_index("video_id")
    dur = int(vmeta.loc[video_id, "duration_sec"])
    tips: list[str] = []

    # 2. décrochage précoce (intro)
    early = retention_at(sessions, video_id, 0.10)
    if early < 0.85:
        tips.append(
            f"Décrochage précoce : seules {early:.0%} des sessions passent les "
            "10 premiers %. Soigner l'accroche / promesse des premières secondes.")

    # 3. durée
    cat_dur = vmeta.loc[vmeta["category"] == vmeta.loc[video_id, "category"], "duration_sec"]
    if dur > cat_dur.median() and dur > 360:
        tips.append(
            f"Vidéo longue ({dur}s) pour sa catégorie : envisager de raccourcir ou "
            "de découper en chapitres.")

    return tips
