"""Dashboard d'analyse d'audience & rétention — Streamlit.

Lancer :  streamlit run dashboard/app.py   (depuis le dossier engine/)

Onglets :
  1. Par vidéo     — courbe de rétention, zones d'ennui détectées, conseils
  2. Comparaison   — classement des vidéos, durée vs rétention
  3. Qualité détec.— précision / rappel mesurés contre le corrigé
  4. Prédiction    — métriques du modèle, prédit vs réel, importance features
"""
from __future__ import annotations
import os
import sys
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

# Rend le package `app` (engine/app/) importable quel que soit le cwd de streamlit.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.data.data_loader import load_logs, load_videos, load_ground_truth, session_table  # noqa: E402
from app.data.retention import retention_target, completion_rate, retention_curve, N_BINS  # noqa: E402
from app.data.hotspots import (friction_signal, detect_hotspots, evaluate_detection,  # noqa: E402
                               THRESHOLD_QUANTILE)
from app.data.features import build_features  # noqa: E402
from app.data.model import evaluate_models, best_model_name, feature_importance  # noqa: E402
from app.data.recommend import recommend  # noqa: E402
from app.data.descriptive import (abandon_rate_global, abandon_rate_per_video,  # noqa: E402
                             pauses_per_minute, seek_per_video, seek_per_minute,
                             abandon_position_stats, category_duration,
                             category_analytics, user_engagement,
                             abandon_peak_hour, abandon_hour_matrix)

st.set_page_config(page_title="Retention Analytics", layout="wide")

ACCENT = "#4F8DFD"
DANGER = "#E5484D"
GT_COLOR = "#F5A623"


# --------------------------------------------------------------------------- #
# Chargement (mis en cache)
# --------------------------------------------------------------------------- #
@st.cache_data
def load_all():
    logs = load_logs()
    videos = load_videos()
    gt = load_ground_truth()
    sessions = session_table(logs)
    return logs, videos, gt, sessions


@st.cache_data
def compute_summary(_logs, _videos, _gt, _sessions):
    ret = retention_target(_sessions)
    comp = completion_rate(_sessions)
    det = evaluate_detection(_logs, _sessions, _videos, _gt)
    summary = _videos.set_index("video_id").copy()
    summary["retention"] = ret
    summary["completion_rate"] = comp
    return summary, det


@st.cache_data
def compute_model(_logs, _videos, _sessions):
    y = retention_target(_sessions)
    X = build_features(_logs, _sessions, _videos).loc[y.index]
    results = evaluate_models(X, y)
    imp = feature_importance(X, y)
    best = best_model_name(results)
    return X, y, results, imp, best


@st.cache_data
def compute_descriptive(_logs, _videos, _sessions):
    return {
        "abandon_global": abandon_rate_global(_logs),
        "abandon_video": abandon_rate_per_video(_logs, _sessions),
        "pauses_min": pauses_per_minute(_logs, _videos, _sessions),
        "seek_video": seek_per_video(_logs, _sessions),
        "abandon_pos": abandon_position_stats(_logs),
        "cat_duration": category_duration(_videos),
        "cat_analytics": category_analytics(_logs, _videos, _sessions),
        "users": user_engagement(_logs),
        "peak_hour": abandon_peak_hour(_logs, _videos),
        "hour_matrix": abandon_hour_matrix(_logs, _videos),
    }


logs, videos, gt, sessions = load_all()
summary, det = compute_summary(logs, videos, gt, sessions)
desc = compute_descriptive(logs, videos, sessions)

st.title("📺 Retention Analytics")
st.caption("Logs de visionnage → zones d'ennui, courbes de rétention, comparaison "
           "et prédiction. Le corrigé sert uniquement à mesurer la qualité.")

# --- barre de KPI globaux ---
k1, k2, k3, k4 = st.columns(4)
k1.metric("Vidéos analysées", f"{len(videos)}")
k2.metric("Sessions", f"{sessions.shape[0]:,}".replace(",", " "))
k3.metric("Rétention moyenne", f"{summary['retention'].mean():.0%}")
k4.metric("Taux d'abandon global", f"{desc['abandon_global']:.0%}",
          help="Part des sessions qui se terminent par un abandon (descriptif)")

tab1, tab2, tabcat, tabaud, tab3, tab4 = st.tabs(
    ["📉 Par vidéo", "📊 Comparaison", "🗂️ Catégories", "👥 Audience",
     "🎯 Qualité détection", "🔮 Prédiction"])


# --------------------------------------------------------------------------- #
# Onglet 1 — Par vidéo
# --------------------------------------------------------------------------- #
with tab1:
    c1, c2 = st.columns([3, 1])
    with c2:
        vid = st.selectbox("Vidéo", videos["video_id"],
                           format_func=lambda v: f"{v} · {summary.loc[v, 'title']}")
        show_gt = st.toggle("Afficher le corrigé", value=False,
                            help="Zones d'ennui de référence (évaluation uniquement)")
    dur = int(summary.loc[vid, "duration_sec"])
    curve = retention_curve(sessions, vid, N_BINS)
    sig = friction_signal(logs, sessions, vid, N_BINS)
    hotspots = detect_hotspots(logs, sessions, vid, dur)
    x_sec = np.arange(N_BINS) / N_BINS * dur

    with c2:
        st.metric("Rétention", f"{summary.loc[vid, 'retention']:.0%}")
        st.metric("Vont au bout", f"{summary.loc[vid, 'completion_rate']:.0%}")
        st.metric("Taux d'abandon", f"{desc['abandon_video'].get(vid, 0):.0%}")
        st.metric("Pauses / min", f"{desc['pauses_min'].get(vid, 0):.2f}")
        st.metric("Catégorie", summary.loc[vid, "category"])
        st.metric("Durée", f"{dur}s")

    with c1:
        # --- courbe de rétention + zones d'ennui ---
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=x_sec, y=curve * 100, mode="lines",
                                 line=dict(color=ACCENT, width=3), name="Rétention",
                                 hovertemplate="%{x:.0f}s : %{y:.0f}%<extra></extra>"))
        for k, (a, b) in enumerate(hotspots):
            fig.add_vrect(x0=a, x1=b, fillcolor=DANGER, opacity=0.18, line_width=0,
                          annotation_text="ennui" if k == 0 else None,
                          annotation_position="top left")
        if show_gt:
            for _, r in gt[gt["video_id"] == vid].iterrows():
                fig.add_vrect(x0=r["hotspot_start"], x1=r["hotspot_end"],
                              line=dict(color=GT_COLOR, width=2, dash="dot"),
                              fillcolor="rgba(0,0,0,0)")
        fig.update_layout(height=330, margin=dict(l=10, r=10, t=30, b=10),
                          yaxis_title="% audience présente", xaxis_title="position (s)",
                          title="Courbe de rétention (zones d'ennui en rouge)")
        st.plotly_chart(fig, use_container_width=True)

        # --- signal de friction ---
        figf = go.Figure()
        figf.add_trace(go.Bar(x=x_sec, y=sig, marker_color=DANGER, name="friction",
                              hovertemplate="%{x:.0f}s<extra></extra>"))
        figf.update_layout(height=200, margin=dict(l=10, r=10, t=30, b=10),
                           yaxis_title="signal d'ennui", xaxis_title="position (s)",
                           title="Friction par position (pauses, retours arrière, abandons, chute)")
        st.plotly_chart(figf, use_container_width=True)

    st.subheader("💡 Que conseiller pour cette vidéo ?")
    for tip in recommend(logs, sessions, videos, vid, hotspots):
        st.markdown(f"- {tip}")

    if vid in desc["abandon_pos"].index:
        fa = desc["abandon_pos"].loc[vid, "first_abandon"]
        ma = desc["abandon_pos"].loc[vid, "median_abandon"]
        st.caption(f"📍 Décrochage : premiers abandons dès **{fa:.0%}** de la vidéo "
                   f"(~{int(fa * dur)}s), le gros du public abandonne vers "
                   f"**{ma:.0%}** (~{int(ma * dur)}s). *(descriptif — non utilisé "
                   "par le modèle)*")

    st.subheader("Détail par vidéo (descriptif)")
    detail = summary.reset_index()[["video_id", "title", "category", "retention",
                                    "completion_rate", "duration_sec"]].copy()
    detail["taux_abandon"] = detail["video_id"].map(desc["abandon_video"])
    detail["pauses_min"] = detail["video_id"].map(desc["pauses_min"])
    detail["seek_par_sess"] = detail["video_id"].map(desc["seek_video"])
    st.dataframe(
        detail.style.format({"retention": "{:.0%}", "completion_rate": "{:.0%}",
                             "taux_abandon": "{:.0%}", "pauses_min": "{:.2f}",
                             "seek_par_sess": "{:.2f}"}),
        use_container_width=True, height=380)


# --------------------------------------------------------------------------- #
# Onglet 2 — Comparaison
# --------------------------------------------------------------------------- #
with tab2:
    rank = summary.sort_values("retention", ascending=False).reset_index()
    fig = px.bar(rank, x="retention", y="video_id", orientation="h",
                 color="category", text=rank["retention"].map("{:.0%}".format),
                 title="Rétention par vidéo (classement)")
    fig.update_layout(height=620, yaxis=dict(autorange="reversed"),
                      xaxis_tickformat=".0%")
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("Synthèse par catégorie")
    cc1, cc2 = st.columns([1, 1])
    with cc1:
        by_cat = (summary.groupby("category")
                  .agg(retention_moy=("retention", "mean"),
                       completion_moy=("completion_rate", "mean"),
                       n=("title", "size")).sort_values("retention_moy", ascending=False))
        st.dataframe(by_cat.style.format({"retention_moy": "{:.0%}",
                                          "completion_moy": "{:.0%}"}),
                     use_container_width=True)
    with cc2:
        cd = desc["cat_duration"].reset_index()
        figd = px.bar(cd, x="duree_moyenne", y="category", orientation="h",
                      text=cd["duree_moyenne"].map("{:.0f}s".format),
                      title="Durée moyenne par catégorie")
        figd.update_layout(height=300, yaxis_title="", margin=dict(t=40))
        st.plotly_chart(figd, use_container_width=True)


# --------------------------------------------------------------------------- #
# Onglet Catégories — analyse par type de contenu (descriptif)
# --------------------------------------------------------------------------- #
with tabcat:
    ca = desc["cat_analytics"]
    st.subheader("Quelle catégorie captive le plus ? où perd-on l'audience ?")
    st.caption("Toutes ces métriques sont descriptives (elles résument le résultat) "
               "et servent à comprendre le catalogue, pas à nourrir le modèle.")

    g1, g2 = st.columns(2)
    with g1:
        d = ca.reset_index()
        fig = px.bar(d, x="retention", y="category", orientation="h",
                     color="retention", color_continuous_scale="Blues",
                     text=d["retention"].map("{:.0%}".format),
                     title="Rétention moyenne par catégorie (captation)")
        fig.update_layout(height=320, yaxis=dict(autorange="reversed"),
                          coloraxis_showscale=False, xaxis_tickformat=".0%")
        st.plotly_chart(fig, use_container_width=True)
    with g2:
        d = ca.reset_index()
        fig = px.bar(d, x="abandon_rate", y="category", orientation="h",
                     color="abandon_rate", color_continuous_scale="Reds",
                     text=d["abandon_rate"].map("{:.0%}".format),
                     title="Taux d'abandon par catégorie  ·  abandon/(abandon+ended)")
        fig.update_layout(height=320, yaxis=dict(autorange="reversed"),
                          coloraxis_showscale=False, xaxis_tickformat=".0%")
        st.plotly_chart(fig, use_container_width=True)

    g3, g4 = st.columns(2)
    with g3:
        d = ca.reset_index().sort_values("first_abandon")
        fig = px.bar(d, x="first_abandon", y="category", orientation="h",
                     text=d["first_abandon"].map("{:.0%}".format),
                     title="Instant moyen du 1er abandon (tôt = perd vite l'audience)")
        fig.update_layout(height=300, yaxis=dict(autorange="reversed"),
                          xaxis_tickformat=".0%")
        st.plotly_chart(fig, use_container_width=True)
    with g4:
        d = ca.reset_index()
        fig = px.bar(d.sort_values("rewind_ratio", ascending=False),
                     x="rewind_ratio", y="category", orientation="h",
                     text=d.sort_values("rewind_ratio", ascending=False)["rewind_ratio"]
                     .map("{:.1%}".format),
                     title="Taux de rebobinage (seek_back / total évènements)")
        fig.update_layout(height=300, yaxis=dict(autorange="reversed"),
                          xaxis_tickformat=".1%")
        st.plotly_chart(fig, use_container_width=True)

    g5, g6 = st.columns(2)
    with g5:
        d = ca.reset_index().sort_values("abandon_count", ascending=False)
        fig = px.bar(d, x="abandon_count", y="category", orientation="h",
                     text="abandon_count", color="abandon_count",
                     color_continuous_scale="Oranges",
                     title="Nombre de visionnages abandonnés (volume brut)")
        fig.update_layout(height=300, yaxis=dict(autorange="reversed"),
                          coloraxis_showscale=False)
        st.plotly_chart(fig, use_container_width=True)
        st.caption("Volume brut, sensible au nombre de vidéos/sessions par "
                   "catégorie — à lire avec le taux d'abandon (normalisé).")
    with g6:
        d = ca.reset_index().sort_values("mean_abandon")
        fig = px.bar(d, x="mean_abandon", y="category", orientation="h",
                     text=d["mean_abandon"].map("{:.0%}".format),
                     title="Temps moyen d'abandon (% de la vidéo atteint avant de lâcher)")
        fig.update_layout(height=300, yaxis=dict(autorange="reversed"),
                          xaxis_tickformat=".0%")
        st.plotly_chart(fig, use_container_width=True)

    st.subheader("Tableau récapitulatif par catégorie")
    st.dataframe(
        ca.style.format({
            "retention": "{:.0%}", "completion_rate": "{:.0%}",
            "abandon_rate": "{:.0%}", "abandon_count": "{:.0f}",
            "first_abandon": "{:.0%}", "mean_abandon": "{:.0%}",
            "pauses_per_min": "{:.2f}", "seek_per_min": "{:.2f}",
            "rewind_ratio": "{:.1%}"})
        .background_gradient(subset=["retention"], cmap="Greens")
        .background_gradient(subset=["abandon_rate"], cmap="Reds"),
        use_container_width=True)
    st.caption("Lecture : rétention = fraction moyenne regardée · complétion = % qui "
               "vont au bout · abandon_count = nb de visionnages abandonnés (brut) · "
               "1er abandon = où décrochent les plus impatients · temps moyen d'abandon "
               "= où décroche le public en général · pauses/min = difficulté · "
               "seek/min & rebobinage = confusion ou re-visionnage.")

    st.subheader("Heure de pic d'abandon par catégorie")
    ph = desc["peak_hour"]
    hm = desc["hour_matrix"]
    p1, p2 = st.columns([1, 2])
    with p1:
        st.dataframe(ph.rename(columns={"interval": "créneau de pic",
                                        "abandons": "abandons"})
                     [["créneau de pic", "abandons"]], use_container_width=True)
        st.caption("⚠️ Exploratoire : les abandons sont ~uniformes sur 24h, ces pics "
                   "sont des maxima faibles, pas un vrai signal temporel.")
    with p2:
        fig = px.imshow(hm, aspect="auto", color_continuous_scale="Reds",
                        labels=dict(x="heure de la journée", y="catégorie",
                                    color="abandons"),
                        title="Abandons par heure et catégorie (tous jours confondus)")
        fig.update_layout(height=300, margin=dict(t=40))
        st.plotly_chart(fig, use_container_width=True)


# --------------------------------------------------------------------------- #
# Onglet Audience — engagement utilisateur (descriptif)
# --------------------------------------------------------------------------- #
with tabaud:
    u = desc["users"]
    st.subheader("Comportement de l'audience")
    st.caption("Décrit les utilisateurs (curiosité, fidélité au catalogue), pas la "
               "performance d'une vidéo. Non utilisé par le modèle.")

    mono = int((u["videos_distinct"] == 1).sum())
    a1, a2, a3, a4 = st.columns(4)
    a1.metric("Utilisateurs", f"{len(u)}")
    a2.metric("Vidéos / user (moy.)", f"{u['videos_distinct'].mean():.1f}")
    a3.metric("Mono-visionneurs", f"{mono / len(u):.0%}",
              help="Users qui n'ont regardé qu'une seule vidéo distincte")
    a4.metric("Re-visionnages", f"{int(u['rewatch'].sum())}",
              help="Sessions au-delà des vidéos distinctes (mêmes vidéos revues)")

    h1, h2 = st.columns(2)
    with h1:
        dist = (u["videos_distinct"].value_counts().sort_index()
                .rename_axis("videos_distinctes").reset_index(name="nb_users"))
        fig = px.bar(dist, x="videos_distinctes", y="nb_users",
                     text="nb_users", title="Nombre de vidéos distinctes par utilisateur")
        fig.update_layout(height=340, xaxis_title="vidéos distinctes regardées",
                          yaxis_title="nombre d'utilisateurs")
        st.plotly_chart(fig, use_container_width=True)
    with h2:
        seg = pd.cut(u["videos_distinct"], bins=[0, 1, 3, 100],
                     labels=["Mono (1)", "Occasionnel (2-3)", "Explorateur (4+)"])
        segc = seg.value_counts().reindex(
            ["Mono (1)", "Occasionnel (2-3)", "Explorateur (4+)"]).reset_index()
        segc.columns = ["segment", "nb_users"]
        fig = px.pie(segc, names="segment", values="nb_users", hole=0.45,
                     title="Segments d'audience")
        fig.update_layout(height=340)
        st.plotly_chart(fig, use_container_width=True)

    st.caption(f"Lecture : un utilisateur regarde en moyenne "
               f"{u['videos_distinct'].mean():.1f} vidéos distinctes "
               f"(de {u['videos_distinct'].min()} à {u['videos_distinct'].max()}), "
               f"sur {u['n_sessions'].mean():.1f} sessions — l'écart traduit les "
               "re-visionnages.")


# --------------------------------------------------------------------------- #
# Onglet 3 — Qualité de la détection
# --------------------------------------------------------------------------- #
with tab3:
    st.subheader("Détection des zones d'ennui — mesurée contre le corrigé")
    st.caption("Évaluation au niveau seconde, agrégée sur les 25 vidéos. Le corrigé "
               "n'intervient PAS dans la détection, seulement dans cette mesure.")
    m1, m2, m3 = st.columns(3)
    m1.metric("Précision", f"{det['precision']:.1%}",
              help="Parmi les secondes détectées « ennui », % réellement dans le corrigé")
    m2.metric("Rappel", f"{det['recall']:.1%}",
              help="Parmi les secondes d'ennui du corrigé, % retrouvées")
    m3.metric("F1", f"{det['f1']:.1%}")
    st.caption(f"Seuil de détection : quantile {THRESHOLD_QUANTILE} du signal de friction "
               f"· TP={det['tp']} · FP={det['fp']} · FN={det['fn']}")

    pv = det["per_video"].merge(videos[["video_id", "title", "category"]], on="video_id")
    st.dataframe(
        pv[["video_id", "title", "category", "precision", "recall", "tp", "fp", "fn"]]
        .style.format({"precision": "{:.0%}", "recall": "{:.0%}"})
        .background_gradient(subset=["recall"], cmap="Greens"),
        use_container_width=True, height=420)


# --------------------------------------------------------------------------- #
# Onglet 4 — Prédiction
# --------------------------------------------------------------------------- #
with tab4:
    X, y, results, imp, best = compute_model(logs, videos, sessions)
    st.subheader("Prédiction de la rétention — sans fuite de cible")
    st.caption("Cible : rétention par vidéo. Features : catégorie, durée, engagement "
               "précoce (10/20 %), pauses, retours en arrière. Évaluation Leave-One-Out "
               "CV (n=25). Aucune feature ne recopie la réponse.")

    perf = pd.DataFrame({n: {"MAE": r.mae, "R²": r.r2} for n, r in results.items()}).T
    c1, c2 = st.columns([1, 1])
    with c1:
        st.markdown("**Performance (LOO-CV)**")
        st.dataframe(perf.style.format({"MAE": "{:.4f}", "R²": "{:.3f}"})
                     .highlight_min(subset=["MAE"], color="#1f6f43"),
                     use_container_width=True)
        st.caption(f"Modèle retenu : **{best}** (meilleur MAE). Sur 25 vidéos, les "
                   "modèles linéaires régularisés battent souvent les arbres "
                   "(qui surapprennent).")
    with c2:
        imp_df = imp.sort_values().reset_index()
        imp_df.columns = ["feature", "importance"]
        figi = px.bar(imp_df, x="importance", y="feature",
                      orientation="h", title="Importance des features (RandomForest)")
        figi.update_layout(height=320, yaxis_title="", margin=dict(t=40))
        st.plotly_chart(figi, use_container_width=True)

    pred = results[best].predictions
    dfp = pd.DataFrame({"video_id": y.index, "réelle": y.values, "prédite": pred})
    figs = px.scatter(dfp, x="réelle", y="prédite", hover_name="video_id",
                      title=f"Rétention prédite vs réelle — {best}")
    lo, hi = float(min(y.min(), pred.min())), float(max(y.max(), pred.max()))
    figs.add_trace(go.Scatter(x=[lo, hi], y=[lo, hi], mode="lines",
                              line=dict(dash="dash", color="gray"), name="parfait"))
    figs.update_layout(height=420, xaxis_tickformat=".0%", yaxis_tickformat=".0%")
    st.plotly_chart(figs, use_container_width=True)
