"""Construction des features du modèle de prédiction de rétention.

⚠️ RÈGLE D'OR (cf. DATA_SCHEMA.md) : aucune feature ne doit contenir la
réponse. Sont donc INTERDITS : la rétention, la position moyenne atteinte,
le % de sessions qui terminent, la durée réellement regardée, le corrigé.

Features utilisées (toutes disponibles AVANT de connaître le dénouement) :
  - category        : catégorie de la vidéo (one-hot)
  - duration_sec    : durée totale
  - early_ret_10    : % de sessions encore présentes après 10 % de la vidéo
  - early_ret_20    : % encore présentes après 20 % (engagement précoce)
  - pause_per_sess  : nombre moyen de pauses par session
  - seek_per_sess   : nombre moyen de retours en arrière par session

`early_ret_10/20` ne mesurent QUE le tout début du visionnage : ce sont des
signaux d'engagement précoce explicitement autorisés, pas le résultat final.
"""
from __future__ import annotations
import pandas as pd

EARLY_WINDOWS = (0.10, 0.20)  # bornes "engagement précoce" (début de vidéo)


def build_features(logs: pd.DataFrame, sessions: pd.DataFrame,
                   videos: pd.DataFrame) -> pd.DataFrame:
    """Table de features (une ligne par vidéo), indexée par video_id."""
    vmeta = videos.set_index("video_id")
    rows = []
    for vid in videos["video_id"]:
        l = logs[logs["video_id"] == vid]
        s = sessions[sessions["video_id"] == vid]
        n_sess = max(s.shape[0], 1)
        row = {
            "video_id": vid,
            "category": vmeta.loc[vid, "category"],
            "duration_sec": int(vmeta.loc[vid, "duration_sec"]),
            "pause_per_sess": (l["event_type"] == "pause").sum() / n_sess,
            "seek_per_sess": (l["event_type"] == "seek_back").sum() / n_sess,
        }
        for w in EARLY_WINDOWS:
            row[f"early_ret_{int(w * 100)}"] = float((s["rel_max"] >= w).mean())
        rows.append(row)

    X = pd.DataFrame(rows).set_index("video_id")
    X = pd.get_dummies(X, columns=["category"])
    return X
