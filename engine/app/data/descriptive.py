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
      - abandon_count    : nombre de visionnages abandonnés (volume brut)
      - first_abandon    : instant moyen du 1er abandon (% de la vidéo)
      - mean_abandon     : temps moyen d'abandon, toutes sessions (% de la vidéo)
      - pauses_per_min   : densité de pauses (difficulté / complexité)
      - seek_per_min     : densité de retours en arrière (confusion / re-visionnage)
      - rewind_ratio     : seek_back / total évènements (catégorie la plus re-visionnée)
    """
    cat = videos.set_index("video_id")["category"]
    l = logs.assign(category=logs["video_id"].map(cat))
    s = sessions.assign(category=sessions["video_id"].map(cat))

    retention = s.groupby("category")["rel_max"].mean()
    completion = s.groupby("category")["completed"].mean()

    term = l[l["event_type"].isin(["abandon", "ended"])]
    abandon_rate = term.groupby("category").apply(
        lambda d: (d["event_type"] == "abandon").sum() / len(d), include_groups=False)

    pm = pauses_per_minute(logs, videos, sessions)
    sm = seek_per_minute(logs, videos, sessions)
    pauses_cat = pm.groupby(cat).mean()
    seek_cat = sm.groupby(cat).mean()

    ab = l[l["event_type"] == "abandon"].copy()
    ab["rel"] = (ab["position_sec"] / ab["video_duration_sec"]).clip(0, 1)
    first_ab = ab.groupby("video_id")["rel"].min().groupby(cat).mean()
    abandon_count = ab.groupby("category").size()          # nb de visionnages abandonnés
    mean_abandon = ab.groupby("category")["rel"].mean()    # temps moyen d'abandon (relatif)

    rewind = l.groupby("category").apply(
        lambda d: (d["event_type"] == "seek_back").sum() / len(d), include_groups=False)

    out = pd.DataFrame({
        "retention": retention, "completion_rate": completion,
        "abandon_rate": abandon_rate, "abandon_count": abandon_count,
        "first_abandon": first_ab, "mean_abandon": mean_abandon,
        "pauses_per_min": pauses_cat, "seek_per_min": seek_cat,
        "rewind_ratio": rewind,
    }).sort_values("retention", ascending=False)
    return out


def user_engagement(logs: pd.DataFrame) -> pd.DataFrame:
    """Engagement par utilisateur (descriptif — décrit l'audience, pas la vidéo).

    Par user :
      - videos_distinct : nombre de vidéos différentes regardées
      - n_sessions      : nombre de visionnages (sessions)
      - rewatch         : visionnages au-delà des vidéos distinctes (n_sessions - distinct)

    ⚠️ Décrit l'utilisateur, pas la vidéo : ne pas utiliser comme feature du
    modèle (qui prédit par vidéo) ni dans la détection de zones d'ennui.
    """
    g = logs.groupby("user_id")
    out = pd.DataFrame({
        "videos_distinct": g["video_id"].nunique(),
        "n_sessions": g["session_id"].nunique(),
    })
    out["rewatch"] = out["n_sessions"] - out["videos_distinct"]
    return out


def abandon_peak_hour(logs: pd.DataFrame, videos: pd.DataFrame) -> pd.DataFrame:
    """Créneau horaire (0h-24h) du pic d'abandons, par catégorie.

    Les abandons sont comptés par heure de la journée (tous jours confondus),
    puis on prend l'heure de maximum par catégorie.

    ⚠️ Exploratoire : si les abandons sont ~uniformes sur 24h, ces pics sont
    des maxima faibles, pas un vrai signal temporel.
    """
    cat = videos.set_index("video_id")["category"]
    ab = logs[logs["event_type"] == "abandon"].copy()
    ab["category"] = ab["video_id"].map(cat)
    ab["hour"] = pd.to_datetime(ab["event_time"]).dt.hour
    counts = ab.groupby(["category", "hour"]).size()

    rows = []
    for c in sorted(ab["category"].dropna().unique()):
        sub = counts.loc[c]
        h = int(sub.idxmax())
        rows.append({"category": c, "peak_hour": h,
                     "interval": f"{h:02d}h–{h + 1:02d}h",
                     "abandons": int(sub.max())})
    return (pd.DataFrame(rows).set_index("category")
            .sort_values("abandons", ascending=False))


def abandon_hour_matrix(logs: pd.DataFrame, videos: pd.DataFrame) -> pd.DataFrame:
    """Matrice catégorie × heure (0..23) du nombre d'abandons (pour heatmap)."""
    cat = videos.set_index("video_id")["category"]
    ab = logs[logs["event_type"] == "abandon"].copy()
    ab["category"] = ab["video_id"].map(cat)
    ab["hour"] = pd.to_datetime(ab["event_time"]).dt.hour
    return (ab.groupby(["category", "hour"]).size()
            .unstack(fill_value=0).reindex(columns=range(24), fill_value=0))


def category_duration(videos: pd.DataFrame) -> pd.DataFrame:
    """Durée moyenne (et nombre de vidéos) par catégorie."""
    return (videos.groupby("category")["duration_sec"]
            .agg(duree_moyenne="mean", n_videos="size")
            .sort_values("duree_moyenne", ascending=False))
