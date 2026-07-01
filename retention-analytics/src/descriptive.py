"""Métriques descriptives pour le dashboard.

⚠️ Ces métriques décrivent le RÉSULTAT (abandon, durée regardée, moment de
décrochage). Elles sont parfaites pour COMPRENDRE une vidéo, mais ne doivent
JAMAIS servir de feature au modèle de prédiction : ce sont des reformulations
de la cible (fuite). Elles vivent donc ici, séparées de `features.py`.
"""
from __future__ import annotations
import numpy as np
import pandas as pd


def abandon_rate_global(logs: pd.DataFrame) -> float:
    """Part globale des sessions qui se terminent par un abandon."""
    n_aband = (logs["event_type"] == "abandon").sum()
    n_sess = logs["session_id"].nunique()
    return float(n_aband / n_sess)


def abandon_rate_per_video(logs: pd.DataFrame, sessions: pd.DataFrame) -> pd.Series:
    """Taux d'abandon par vidéo (≈ 1 − complétion ; descriptif uniquement)."""
    ab = (logs[logs["event_type"] == "abandon"].groupby("video_id").size())
    n = sessions.groupby("video_id").size()
    return (ab.reindex(n.index, fill_value=0) / n).rename("abandon_rate")


def pauses_per_minute(logs: pd.DataFrame, videos: pd.DataFrame,
                      sessions: pd.DataFrame) -> pd.Series:
    """Nombre moyen de pauses par minute de vidéo, par vidéo.

    = (pauses totales / nb sessions) / (durée en minutes).
    Indicateur d'effort de visionnage, normalisé par la durée.
    """
    vmeta = videos.set_index("video_id")
    pauses = (logs[logs["event_type"] == "pause"].groupby("video_id").size())
    n = sessions.groupby("video_id").size()
    out = {}
    for vid in videos["video_id"]:
        per_sess = pauses.get(vid, 0) / max(n.get(vid, 1), 1)
        minutes = vmeta.loc[vid, "duration_sec"] / 60
        out[vid] = per_sess / minutes if minutes else 0.0
    return pd.Series(out, name="pauses_per_min")


def first_pause_time(logs: pd.DataFrame) -> pd.Series:
    """Instant moyen (en secondes) de la toute première pause, par vidéo.

    Pour chaque session ayant fait au moins une pause, on prend la position
    de la première ; la moyenne par vidéo donne un repère temporel (à quel
    moment les gens ont typiquement besoin de souffler).
    """
    pauses = logs[logs["event_type"] == "pause"]
    first_sec = pauses.groupby("session_id")["position_sec"].min()
    vid_of_session = logs.groupby("session_id")["video_id"].first()
    return (first_sec.groupby(vid_of_session.reindex(first_sec.index))
           .mean().rename("first_pause_sec"))


def seek_per_video(logs: pd.DataFrame, sessions: pd.DataFrame) -> pd.Series:
    """Nombre moyen de retours en arrière par session, par vidéo."""
    sk = (logs[logs["event_type"] == "seek_back"].groupby("video_id").size())
    n = sessions.groupby("video_id").size()
    return (sk.reindex(n.index, fill_value=0) / n).rename("seek_per_sess")


def abandon_position_stats(logs: pd.DataFrame) -> pd.DataFrame:
    """Où les gens abandonnent, par vidéo (position RELATIVE, 0..1).

    - first_abandon  : position du tout premier abandon (min) — souvent très tôt,
      donc bruité ; utile surtout comme « plancher » de décrochage.
    - median_abandon : position médiane des abandons — « où décroche le gros
      du public ». C'est l'insight le plus parlant.
    Descriptif uniquement (la position d'abandon est le dénouement = fuite si
    utilisée comme feature).
    """
    ab = logs[logs["event_type"] == "abandon"].copy()
    ab["rel"] = (ab["position_sec"] / ab["video_duration_sec"]).clip(0, 1)
    g = ab.groupby("video_id")["rel"]
    return pd.DataFrame({"first_abandon": g.min(), "median_abandon": g.median()})


def seek_per_minute(logs: pd.DataFrame, videos: pd.DataFrame,
                    sessions: pd.DataFrame) -> pd.Series:
    """Nombre moyen de retours en arrière par minute de vidéo, par vidéo.

    Densité de re-visionnage : confusion ou passage qu'on rejoue.
    """
    vmeta = videos.set_index("video_id")
    seeks = (logs[logs["event_type"] == "seek_back"].groupby("video_id").size())
    n = sessions.groupby("video_id").size()
    out = {}
    for vid in videos["video_id"]:
        per_sess = seeks.get(vid, 0) / max(n.get(vid, 1), 1)
        minutes = vmeta.loc[vid, "duration_sec"] / 60
        out[vid] = per_sess / minutes if minutes else 0.0
    return pd.Series(out, name="seek_per_min")


def category_analytics(logs: pd.DataFrame, videos: pd.DataFrame,
                       sessions: pd.DataFrame) -> pd.DataFrame:
    """Tableau de bord par catégorie (descriptif).

    Colonnes :
      - retention        : avg(position_max / durée) — quelle catégorie captive le plus
      - completion_rate  : % de sessions qui atteignent la fin (distinct de la rétention)
      - abandon_rate     : abandon / (abandon + ended) — où les gens lâchent
      - pauses_per_min   : densité de pauses (difficulté / complexité)
      - seek_per_min     : densité de retours en arrière (confusion / re-visionnage)
      - first_abandon    : instant moyen du 1er abandon (% de la vidéo)
      - rewind_ratio     : seek_back / total évènements (catégorie la plus re-visionnée)
      - duree_moyenne_sec: durée moyenne des vidéos de la catégorie (secondes)
      - n_abandons       : nombre de sessions terminées par un abandon
      - abandon_time_sec : instant moyen (en secondes) où survient un abandon
    """
    cat = videos.set_index("video_id")["category"]
    l = logs.assign(category=logs["video_id"].map(cat))
    s = sessions.assign(category=sessions["video_id"].map(cat))

    retention = s.groupby("category")["rel_max"].mean()
    completion = s.groupby("category")["completed"].mean()

    term = l[l["event_type"].isin(["abandon", "ended"])]
    abandon_counts = term[term["event_type"] == "abandon"].groupby("category").size()
    term_counts = term.groupby("category").size()
    abandon_rate = abandon_counts.reindex(term_counts.index, fill_value=0) / term_counts

    pm = pauses_per_minute(logs, videos, sessions)
    sm = seek_per_minute(logs, videos, sessions)
    pauses_cat = pm.groupby(cat).mean()
    seek_cat = sm.groupby(cat).mean()

    ab = l[l["event_type"] == "abandon"].copy()
    ab["rel"] = (ab["position_sec"] / ab["video_duration_sec"]).clip(0, 1)
    first_ab = ab.groupby("video_id")["rel"].min().groupby(cat).mean()
    abandon_time_sec = ab.groupby("category")["position_sec"].mean()

    seek_counts = l[l["event_type"] == "seek_back"].groupby("category").size()
    all_counts = l.groupby("category").size()
    rewind = seek_counts.reindex(all_counts.index, fill_value=0) / all_counts

    duree_moyenne_sec = videos.groupby("category")["duration_sec"].mean()
    n_abandons = abandon_counts.reindex(term_counts.index, fill_value=0).astype(int)

    out = pd.DataFrame({
        "retention": retention, "completion_rate": completion,
        "abandon_rate": abandon_rate, "pauses_per_min": pauses_cat,
        "seek_per_min": seek_cat, "first_abandon": first_ab,
        "rewind_ratio": rewind, "duree_moyenne_sec": duree_moyenne_sec,
        "n_abandons": n_abandons, "abandon_time_sec": abandon_time_sec,
    }).sort_values("retention", ascending=False)
    return out


def category_duration(videos: pd.DataFrame) -> pd.DataFrame:
    """Durée moyenne (et nombre de vidéos) par catégorie."""
    return (videos.groupby("category")["duration_sec"]
            .agg(duree_moyenne="mean", n_videos="size")
            .sort_values("duree_moyenne", ascending=False))
