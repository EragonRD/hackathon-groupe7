"""Dashboard d'analyse d'audience & rétention (P3-B, tâche 32 — Faycal).

Lancer (depuis `engine/`) :  streamlit run dashboard/app.py

Onglets :
  1. Par vidéo     — courbe de rétention, zones d'ennui détectées, détail, conseils
  2. Catégories    — analyse descriptive par type de contenu
  3. Comparaison   — classement des vidéos, durée vs rétention
  4. Prévision     — métriques du modèle, prédit vs réel, importance features
"""
from __future__ import annotations
import sys
from pathlib import Path

# Streamlit place le dossier du script (dashboard/) en tête de sys.path ; on
# ajoute `engine/` (son parent) pour pouvoir importer le paquet `app.data.*`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

from app.data.data_loader import load_logs, load_videos, load_ground_truth, session_table
from app.data.retention import retention_target, completion_rate, retention_curve, N_BINS
from app.data.hotspots import friction_signal, detect_hotspots
from app.data.recommend import recommend
from app.data.descriptive import (abandon_rate_global, abandon_rate_per_video,
                             seek_per_video, seek_per_minute, first_pause_time,
                             category_duration, category_analytics)
from app.data.ennui_interval import (build_interval_target, build_interval_features,
                                evaluate_interval_models,
                                best_model_name as best_interval_name,
                                fit_final as fit_interval_final)
from app.data.churn_predict import (build_churn_labels, build_churn_features,
                               evaluate_churn_models, fit_final as fit_churn_final,
                               best_model_name as best_churn_name,
                               feature_importance as churn_importance,
                               confusion as churn_confusion, roc_points as churn_roc_points)

st.set_page_config(page_title="Analyse d'audience", layout="wide")

ACCENT = "#4F8DFD"
DANGER = "#E5484D"
GT_COLOR = "#F5A623"


def sec_to_mmss(x: float) -> str:
    """Formate un nombre de secondes en 'm:ss'."""
    m, s = divmod(int(round(x)), 60)
    return f"{m}:{s:02d}"


def mmss_ticks(max_val: float) -> tuple[list[float], list[str]]:
    """Positions et libellés d'axe en 'm:ss', espacés joliment."""
    step = 30 if max_val <= 180 else 60
    vals = list(np.arange(0, max_val + step, step))
    return vals, [sec_to_mmss(v) for v in vals]


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
def compute_summary(_videos, _sessions):
    ret = retention_target(_sessions)
    comp = completion_rate(_sessions)
    summary = _videos.set_index("video_id").copy()
    summary["retention"] = ret
    summary["completion_rate"] = comp
    return summary


@st.cache_data
def compute_interval_model(_videos, _gt):
    """Prédiction de l'intervalle d'ennui à partir des seules métadonnées vidéo."""
    target = build_interval_target(_gt, _videos)
    X = build_interval_features(_videos).loc[target.index]
    results_start = evaluate_interval_models(X, target["start_rel"])
    results_width = evaluate_interval_models(X, target["width_rel"])
    return target, X, results_start, results_width


@st.cache_data
def compute_churn_model(_logs, _videos, _sessions):
    """Classification : la session va-t-elle se terminer par un abandon ?"""
    y = build_churn_labels(_logs, _sessions)
    X = build_churn_features(_logs, _sessions, _videos)
    results = evaluate_churn_models(X, y)
    imp = churn_importance(X, y)
    best = best_churn_name(results)
    return X, y, results, imp, best


@st.cache_data
def compute_descriptive(_logs, _videos, _sessions):
    return {
        "abandon_global": abandon_rate_global(_logs),
        "abandon_video": abandon_rate_per_video(_logs, _sessions),
        "first_pause_sec": first_pause_time(_logs),
        "seek_video": seek_per_video(_logs, _sessions),
        "cat_duration": category_duration(_videos),
        "cat_analytics": category_analytics(_logs, _videos, _sessions),
    }


logs, videos, gt, sessions = load_all()
summary = compute_summary(videos, sessions)
desc = compute_descriptive(logs, videos, sessions)

st.title(" Analyse d'audience & prévision ")

# --- barre de KPI globaux ---
k1, k2, k3, k4 = st.columns(4)
k1.metric("Vidéos analysées", f"{len(videos)}",
          help="Nombre de vidéos couvertes par ce tableau de bord.")
k2.metric("Sessions", f"{sessions.shape[0]:,}".replace(",", " "),
          help="Nombre de fois où quelqu'un a lancé une vidéo.")
k3.metric("Rétention moyenne", f"{summary['retention'].mean():.0%}",
          help="En moyenne, la part d'une vidéo que les gens regardent avant de partir.")
k4.metric("Taux d'abandon global", f"{desc['abandon_global']:.0%}",
          help="Part des visionnages qui s'arrêtent brusquement, sans aller au bout.")

tab1, tabcat, tab2, tab4 = st.tabs(
    ["Par vidéo", "Catégories", "Comparaison", "Prévision"])


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
        st.metric("Rétention", f"{summary.loc[vid, 'retention']:.0%}",
                  help="En moyenne, la part de la vidéo que les gens regardent "
                       "avant de partir.")
        st.metric("Complétion", f"{summary.loc[vid, 'completion_rate']:.0%}",
                  help="Part des spectateurs qui regardent la vidéo jusqu'au bout.")
        st.metric("Taux d'abandon", f"{desc['abandon_video'].get(vid, 0):.0%}",
                  help="Part des visionnages qui s'arrêtent brusquement, sans "
                       "aller au bout normalement.")
        st.metric("1er temps de pause (s)", f"{desc['first_pause_sec'].get(vid, 0):.0f}s",
                  help="En moyenne, au bout de combien de secondes les gens "
                       "mettent la vidéo en pause pour la première fois.")
        st.metric("Catégorie", summary.loc[vid, "category"],
                  help="Type de contenu de la vidéo.")
        st.metric("Durée", f"{dur}s", help="Longueur totale de la vidéo, en secondes.")

    with c1:
        # --- courbe de rétention + zones d'ennui ---
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=x_sec, y=curve * 100, mode="lines",
                                 line=dict(color=ACCENT, width=3), name="Rétention",
                                 hovertemplate="%{x:.0f}s : %{y:.0f}%<extra></extra>"))
        for a, b in hotspots:
            fig.add_vrect(x0=a, x1=b, fillcolor=DANGER, opacity=0.18, line_width=0,
                          annotation_text="ennui", annotation_position="top left")
        if show_gt:
            for _, r in gt[gt["video_id"] == vid].iterrows():
                fig.add_vrect(x0=r["hotspot_start"], x1=r["hotspot_end"],
                              line=dict(color=GT_COLOR, width=2, dash="dot"),
                              fillcolor="rgba(0,0,0,0)")
        fig.update_layout(height=330, margin=dict(l=10, r=10, t=30, b=10),
                          yaxis_title="% audience présente", xaxis_title="position (s)",
                          title="Zones d'ennui ")
        st.plotly_chart(fig, width='stretch')

        # --- signal de friction ---
        figf = go.Figure()
        figf.add_trace(go.Bar(x=x_sec, y=sig, marker_color=DANGER, name="friction",
                              hovertemplate="%{x:.0f}s<extra></extra>"))
        figf.update_layout(height=200, margin=dict(l=10, r=10, t=30, b=10),
                           yaxis_title="signal d'ennui", xaxis_title="position (s)",
                           title="Signal d'ennui")
        st.plotly_chart(figf, width='stretch')

    st.subheader("Descriptif par vidéo")
    detail = summary.reset_index()[["video_id", "title", "category", "retention",
                                    "completion_rate", "duration_sec"]].copy()
    detail["taux_abandon"] = detail["video_id"].map(desc["abandon_video"])
    detail["first_pause_sec"] = detail["video_id"].map(desc["first_pause_sec"])
    detail = detail.rename(columns={
        "video_id": "ID vidéo", "title": "Titre", "category": "Catégorie",
        "retention": "Rétention", "completion_rate": "Complétion",
        "duration_sec": "Durée (s)", "taux_abandon": "Taux d'abandon",
        "first_pause_sec": " 1er temps de pause (s)",
    })
    st.dataframe(
        detail.style.format({"Rétention": "{:.0%}", "Complétion": "{:.0%}",
                             "Taux d'abandon": "{:.0%}",
                             " 1er temps de pause (s)": "{:.0f}s"}),
        width='stretch', height=380,
        column_config={
            "ID vidéo": st.column_config.TextColumn(
                help="Identifiant de la vidéo."),
            "Titre": st.column_config.TextColumn(help="Titre de la vidéo."),
            "Catégorie": st.column_config.TextColumn(help="Type de contenu de la vidéo."),
            "Rétention": st.column_config.Column(
                help="En moyenne, la part de la vidéo que les gens regardent "
                     "avant de partir."),
            "Complétion": st.column_config.Column(
                help="Part des spectateurs qui regardent la vidéo jusqu'au bout."),
            "Durée (s)": st.column_config.Column(
                help="Longueur totale de la vidéo, en secondes."),
            "Taux d'abandon": st.column_config.Column(
                help="Part des visionnages qui s'arrêtent brusquement, sans "
                     "aller au bout normalement."),
            " 1er temps de pause (s)": st.column_config.Column(
                help="En moyenne, au bout de combien de secondes les gens "
                     "mettent la vidéo en pause pour la première fois."),
        })

    for tip in recommend(logs, sessions, videos, vid):
        st.markdown(f"- {tip}")


# --------------------------------------------------------------------------- #
# Onglet Catégories — analyse par type de contenu (descriptif)
# --------------------------------------------------------------------------- #
with tabcat:
    ca = desc["cat_analytics"]
    st.caption("Toutes ces métriques sont descriptives (elles résument le résultat) "
               "et servent à comprendre le catalogue, pas à nourrir le modèle.")

    g1, g2 = st.columns(2)
    with g1:
        d = ca.reset_index()
        fig = px.bar(d, x="retention", y="category", orientation="h",
                     color="retention", color_continuous_scale="Blues",
                     text=d["retention"].map("{:.0%}".format),
                     title="Rétention moyenne par catégorie")
        fig.update_layout(height=320, yaxis=dict(autorange="reversed"),
                          coloraxis_showscale=False, xaxis_tickformat=".0%")
        st.plotly_chart(fig, width='stretch')
        st.caption("? En moyenne, quelle part des vidéos de cette catégorie "
                   "les gens regardent avant de partir.")
    with g2:
        d = ca.reset_index()
        fig = px.bar(d, x="abandon_rate", y="category", orientation="h",
                     color="abandon_rate", color_continuous_scale="Reds",
                     text=d["abandon_rate"].map("{:.0%}".format),
                     title="Taux d'abandon par catégorie")
        fig.update_layout(height=320, yaxis=dict(autorange="reversed"),
                          coloraxis_showscale=False, xaxis_tickformat=".0%")
        st.plotly_chart(fig, width='stretch')
        st.caption("? Part des visionnages de cette catégorie qui s'arrêtent "
                   "brusquement au lieu d'aller au bout.")

    g3, g4, g5 = st.columns(3)
    with g3:
        d = ca.reset_index()
        d["first_abandon_sec"] = d["first_abandon"] * d["duree_moyenne_sec"]
        d = d.sort_values("first_abandon_sec")
        fig = px.bar(d, x="first_abandon_sec", y="category", orientation="h",
                     text=d["first_abandon_sec"].map(sec_to_mmss),
                     title="Instant moyen du 1er abandon ")
        tickvals, ticktext = mmss_ticks(d["first_abandon_sec"].max())
        fig.update_layout(height=300, yaxis=dict(autorange="reversed"),
                          xaxis_title="Instant du 1er abandon (m:ss)",
                          xaxis=dict(tickvals=tickvals, ticktext=ticktext))
        st.plotly_chart(fig, width='stretch')
        st.caption("? À quel moment, en moyenne, les premiers départs "
                   "surviennent pour cette catégorie.")
    with g4:
        d = ca.reset_index()
        fig = px.bar(d.sort_values("rewind_ratio", ascending=False),
                     x="rewind_ratio", y="category", orientation="h",
                     text=d.sort_values("rewind_ratio", ascending=False)["rewind_ratio"]
                     .map("{:.1%}".format),
                     title="Taux de rebobinage ")
        fig.update_layout(height=300, yaxis=dict(autorange="reversed"),
                          xaxis_tickformat=".1%")
        st.plotly_chart(fig, width='stretch')
        st.caption("? Part des actions des spectateurs qui sont des retours "
                   "en arrière (ils rejouent un passage).")
    with g5:
        cd = desc["cat_duration"].reset_index()
        figd = px.bar(cd, x="duree_moyenne", y="category", orientation="h",
                      text=cd["duree_moyenne"].map("{:.0f}s".format),
                      title="Durée moyenne par catégorie")
        figd.update_layout(height=300, yaxis=dict(autorange="reversed"), yaxis_title="",
                          margin=dict(t=40))
        st.plotly_chart(figd, width='stretch')
        st.caption("? Longueur moyenne des vidéos de cette catégorie, en secondes.")

    st.subheader("Synthèse par catégorie")
    by_cat = (summary.groupby("category")
              .agg(retention_moy=("retention", "mean"),
                   completion_moy=("completion_rate", "mean"),
                   n=("title", "size")).sort_values("retention_moy", ascending=False))
    by_cat = by_cat.rename_axis("Catégorie").rename(columns={
        "retention_moy": "Rétention moyenne", "completion_moy": "Complétion moyenne",
        "n": "Nombre de vidéos",
    })
    st.dataframe(by_cat.style.format({"Rétention moyenne": "{:.0%}",
                                      "Complétion moyenne": "{:.0%}"}),
                 width='stretch',
                 column_config={
                     "Catégorie": st.column_config.TextColumn(
                         help="Type de contenu des vidéos."),
                     "Rétention moyenne": st.column_config.Column(
                         help="En moyenne, la part des vidéos de cette "
                              "catégorie que les gens regardent avant de partir."),
                     "Complétion moyenne": st.column_config.Column(
                         help="Part des spectateurs qui regardent ces vidéos "
                              "jusqu'au bout."),
                     "Nombre de vidéos": st.column_config.Column(
                         help="Combien de vidéos appartiennent à cette catégorie."),
                 })

    st.subheader("Tableau récapitulatif par catégorie")
    ca_disp = ca.drop(columns=["seek_per_min"]).rename_axis("Catégorie").rename(columns={
        "retention": "Rétention", "completion_rate": "Complétion",
        "abandon_rate": "Taux d'abandon", "pauses_per_min": "1er temps moyen de pause (s)",
        "first_abandon": "1er abandon", "rewind_ratio": "Taux de rebobinage",
        "duree_moyenne_sec": "Durée moyenne (s)", "n_abandons": "Nombre d'abandons",
        "abandon_time_sec": "Temps moyen d'abandon",
    })
    st.dataframe(
        ca_disp.style.format({
            "Rétention": "{:.0%}", "Complétion": "{:.0%}",
            "Taux d'abandon": "{:.0%}", "1er temps moyen de pause": "{:.2f}",
            "1er abandon": "{:.0%}", "Taux de rebobinage": "{:.1%}",
            "Durée moyenne (s)": "{:.0f} s", "Nombre d'abandons": "{:.0f}",
            "Temps moyen d'abandon": sec_to_mmss})
        .background_gradient(subset=["Rétention"], cmap="Greens")
        .background_gradient(subset=["Taux d'abandon"], cmap="Reds"),
        width='stretch',
        column_config={
            "Catégorie": st.column_config.TextColumn(help="Type de contenu des vidéos."),
            "Rétention": st.column_config.Column(
                help="En moyenne, la part des vidéos que les gens regardent "
                     "avant de partir."),
            "Complétion": st.column_config.Column(
                help="Part des spectateurs qui vont jusqu'au bout des vidéos."),
            "Taux d'abandon": st.column_config.Column(
                help="Part des visionnages qui s'arrêtent brusquement."),
            "1er temps moyen de pause ": st.column_config.Column(
                help="En moyenne, à quel rythme les spectateurs mettent pause "
                     "(plus c'est élevé, plus c'est difficile à suivre)."),
            "1er abandon": st.column_config.Column(
                help="À quel moment (en % de la vidéo) les premiers départs "
                     "surviennent en moyenne."),
            "Taux de rebobinage": st.column_config.Column(
                help="Part des actions qui sont des retours en arrière "
                     "(confusion ou passage qu'on rejoue)."),
            "Durée moyenne (s)": st.column_config.Column(
                help="Longueur moyenne des vidéos de la catégorie, en secondes."),
            "Nombre d'abandons": st.column_config.Column(
                help="Combien de visionnages se sont terminés par un abandon."),
            "Temps moyen d'abandon": st.column_config.Column(
                help="En moyenne, à quel instant (minutes:secondes) les gens "
                     "abandonnent la vidéo."),
        })


# --------------------------------------------------------------------------- #
# Onglet 2 — Comparaison
# --------------------------------------------------------------------------- #
with tab2:
    cmp = summary.reset_index()[["video_id", "title", "category", "retention",
                                 "completion_rate", "duration_sec"]].copy()
    cmp["abandon_rate"] = cmp["video_id"].map(desc["abandon_video"])

    rank = summary.sort_values("retention", ascending=False).reset_index()
    c1, c2 = st.columns(2)
    with c1:
        fig = px.bar(rank, x="retention", y="video_id", orientation="h",
                     color="category", text=rank["retention"].map("{:.0%}".format),
                     title="Rétention par vidéo (classement)")
        fig.update_layout(height=560, yaxis=dict(autorange="reversed"),
                          xaxis_tickformat=".0%")
        st.plotly_chart(fig, width='stretch')
    with c2:
        fig = px.scatter(cmp, x="abandon_rate", y="retention", color="category",
                         size="duration_sec", hover_name="title",
                         title="Rétention vs taux d'abandon, par vidéo")
        fig.update_layout(height=560, xaxis_tickformat=".0%", yaxis_tickformat=".0%",
                          xaxis_title="Taux d'abandon", yaxis_title="Rétention")
        st.plotly_chart(fig, width='stretch')


# --------------------------------------------------------------------------- #
# Onglet 4 — Prévision
# --------------------------------------------------------------------------- #
with tab4:
    # ----------------------------------------------------------------------- #
    # 1. Où l'ennui va-t-il probablement survenir ? (régression d'intervalle)
    # ----------------------------------------------------------------------- #
    st.subheader("Où l'ennui va-t-il probablement survenir ?")

    target, Xi, results_start, results_width = compute_interval_model(videos, gt)
    best_start = best_interval_name(results_start)
    best_width = best_interval_name(results_width)
    final_start = fit_interval_final(Xi, target["start_rel"], best_start)
    final_width = fit_interval_final(Xi, target["width_rel"], best_width)

    si1, si2 = st.columns([1, 2])
    with si1:
        sim_cat_i = st.selectbox("Catégorie", sorted(videos["category"].unique()),
                                 key="cat_interval")
        sim_dur_i = st.slider("Durée prévue (s)", 60, 600, 300, step=10, key="dur_interval")

        row_i = pd.DataFrame([{"duration_sec": sim_dur_i, "category": sim_cat_i}])
        row_i = pd.get_dummies(row_i, columns=["category"]).reindex(
            columns=Xi.columns, fill_value=0)
        p_start = float(np.clip(final_start.predict(row_i)[0], 0, 1))
        p_width = float(max(final_width.predict(row_i)[0], 0.02))
        p_end = float(min(p_start + p_width, 1))
        start_sec, end_sec = p_start * sim_dur_i, p_end * sim_dur_i

        st.metric("Zone de décrochage estimée",
                  f"{start_sec:.0f}s → {end_sec:.0f}s",
                  help="Le moment de la vidéo où l'audience risque le plus "
                       "de décrocher, estimé à partir de sa catégorie et sa durée.")
        st.caption(f"Pour une vidéo **{sim_cat_i}** de {sim_dur_i}s, l'audience commence "
                   f"typiquement à décrocher vers **{start_sec:.0f}s** et se stabilise "
                   f"vers **{end_sec:.0f}s**.")

    with si2:
        figsim = go.Figure()
        figsim.add_trace(go.Bar(x=[sim_dur_i], y=[""], orientation="h",
                                marker_color="#e9ecef", showlegend=False, hoverinfo="skip"))
        figsim.add_vrect(x0=start_sec, x1=end_sec, fillcolor=DANGER, opacity=0.35,
                         line_width=0, annotation_text="zone à risque",
                         annotation_position="top left")
        tickvals, ticktext = mmss_ticks(sim_dur_i)
        figsim.update_layout(height=160, margin=dict(l=10, r=10, t=30, b=10),
                            xaxis=dict(tickvals=tickvals, ticktext=ticktext,
                                      title="position dans la vidéo (m:ss)"),
                            yaxis=dict(showticklabels=False),
                            title="Zone de décrochage estimée sur la timeline")
        st.plotly_chart(figsim, width='stretch')
        st.caption("? La zone rouge montre à quel moment de la vidéo l'audience "
                   "risque le plus de décrocher.")

    with st.expander("Détails techniques du modèle"):
        st.caption("Entraîné uniquement sur `videos.csv` (catégorie, durée) et le "
                   "corrigé `ground_truth_hotspots.csv` comme cible (zone la plus "
                   "large quand plusieurs sont annotées). Aucune donnée de visionnage. "
                   "Évaluation Leave-One-Out CV (n=25).")
        perf_int = pd.DataFrame({
            "Début - MAE": {n: r.mae for n, r in results_start.items()},
            "Début - R²": {n: r.r2 for n, r in results_start.items()},
            "Largeur - MAE": {n: r.mae for n, r in results_width.items()},
            "Largeur - R²": {n: r.r2 for n, r in results_width.items()},
        })
        st.dataframe(perf_int.style.format("{:.3f}")
                     .highlight_min(subset=["Début - MAE"], color="#1f6f43")
                     .highlight_min(subset=["Largeur - MAE"], color="#1f6f43"),
                     width='stretch')
        st.caption(f"Retenus : **{best_start}** pour le début, **{best_width}** pour la "
                   "largeur de la zone (meilleur MAE, baseline incluse ; la fin = début "
                   "+ largeur, donc toujours après le début). Une MAE de 0.13 à 0.16 "
                   "(≈ 13 à 16 % de la durée) montre que catégorie et durée seules "
                   "expliquent peu où l'ennui survient précisément : à prendre comme "
                   "premier repère, pas comme vérité absolue.")

        pred_start_rel = pd.Series(results_start[best_start].predictions,
                                   index=target.index).clip(0, 1)
        pred_width_rel = pd.Series(results_width[best_width].predictions,
                                   index=target.index).clip(lower=0.02)
        pred_end_rel = (pred_start_rel + pred_width_rel).clip(upper=1)
        g = pd.DataFrame({
            "video_id": target.index,
            "actual_start": target["hotspot_start"], "actual_end": target["hotspot_end"],
            "pred_start": pred_start_rel * target["duration_sec"],
            "pred_end": pred_end_rel * target["duration_sec"],
        }).sort_values("actual_start")
        figg = go.Figure()
        figg.add_trace(go.Bar(
            x=g["actual_end"] - g["actual_start"], y=g["video_id"], base=g["actual_start"],
            orientation="h", name="Réel (corrigé)", marker_color=GT_COLOR, opacity=0.55))
        figg.add_trace(go.Bar(
            x=g["pred_end"] - g["pred_start"], y=g["video_id"], base=g["pred_start"],
            orientation="h", name="Prédit", marker_color=ACCENT, opacity=0.55))
        figg.update_layout(barmode="overlay", height=560, margin=dict(t=40),
                          xaxis_title="position (s)", yaxis_title="",
                          title="Intervalle d'ennui : réel vs prédit, par vidéo (les 25 vidéos)")
        st.plotly_chart(figg, width='stretch')

    st.divider()

    # ----------------------------------------------------------------------- #
    # 2. Cet utilisateur va-t-il abandonner ? (classification par session)
    # ----------------------------------------------------------------------- #
    st.subheader("Cet utilisateur va-t-il abandonner ?")
    st.caption("Simulez une vidéo (catégorie, durée, pauses potentielles) pour "
               "estimer le risque d'abandon.")

    Xc, yc, results_c, imp_c, best_c = compute_churn_model(logs, videos, sessions)
    best_res = results_c[best_c]
    final_churn = fit_churn_final(Xc, yc, best_c)

    sc1, sc2 = st.columns([1, 2])
    with sc1:
        sim_cat = st.selectbox("Catégorie", sorted(videos["category"].unique()),
                               key="cat_churn")
        sim_dur = st.slider("Durée de la vidéo (s)", 60, 600, 300, step=10, key="dur_churn")
        sim_pause = st.slider("Pauses potentielles", 0, 5, 0)

        row = pd.DataFrame([{"duration_sec": sim_dur, "n_pause_early": sim_pause,
                             "category": sim_cat}])
        row = pd.get_dummies(row, columns=["category"]).reindex(
            columns=Xc.columns, fill_value=0)
        proba = float(final_churn.predict_proba(row)[0, 1])
        st.metric("Probabilité d'abandon", f"{proba:.0%}",
                  help="Le risque estimé que ce spectateur parte avant la fin "
                       "de la vidéo.")
        st.progress(min(max(proba, 0.0), 1.0))

    with sc2:
        figgauge = go.Figure(go.Indicator(
            mode="gauge+number", value=proba * 100,
            number={"suffix": "%"},
            gauge={"axis": {"range": [0, 100]},
                  "bar": {"color": ACCENT},
                  "steps": [{"range": [0, 40], "color": "#d4edda"},
                           {"range": [40, 70], "color": "#fff3cd"},
                           {"range": [70, 100], "color": "#f8d7da"}]},
            title={"text": "Risque d'abandon"}))
        figgauge.update_layout(height=280, margin=dict(l=20, r=20, t=50, b=20))
        st.plotly_chart(figgauge, width='stretch')
        if proba >= 0.70:
            st.warning("Risque élevé : envisager une relance (rappel, notification) "
                       "ou revoir ce passage de la vidéo.")
        elif proba >= 0.40:
            st.info("Risque modéré : à surveiller.")
        else:
            st.success("Risque faible : cette session part bien.")

    with st.expander("Détails techniques du modèle"):
        st.caption("Entraîné sur `viewing_logs.csv`, features limitées à la catégorie, "
                   "la durée de la vidéo et au nombre de pauses potentielles (20 "
                   "premiers % de la vidéo). Validation croisée stratifiée à 5 plis "
                   "(n=1250 sessions).")
        perf_c = pd.DataFrame({
            n: {"Accuracy": r.accuracy, "Précision": r.precision, "Rappel": r.recall,
                "F1": r.f1, "AUC": r.auc}
            for n, r in results_c.items()}).T
        st.dataframe(perf_c.style.format("{:.3f}")
                     .highlight_max(subset=["F1"], color="#1f6f43"),
                     width='stretch')
        st.caption(f"Modèle retenu : **{best_c}** (meilleur F1).")

        dc1, dc2 = st.columns(2)
        with dc1:
            cm = churn_confusion(yc, best_res.predictions)
            figcm = px.imshow(cm, text_auto=True, color_continuous_scale="Blues",
                              x=["Prédit : normal", "Prédit : abandon"],
                              y=["Réel : normal", "Réel : abandon"],
                              title=f"Matrice de confusion — {best_c}")
            figcm.update_layout(height=300, coloraxis_showscale=False, margin=dict(t=40))
            st.plotly_chart(figcm, width='stretch')

            fpr, tpr = churn_roc_points(yc, best_res.probabilities)
            figroc = go.Figure()
            figroc.add_trace(go.Scatter(x=fpr, y=tpr, mode="lines", name=best_c,
                                        line=dict(color=ACCENT, width=3)))
            figroc.add_trace(go.Scatter(x=[0, 1], y=[0, 1], mode="lines", name="hasard",
                                        line=dict(dash="dash", color="gray")))
            figroc.update_layout(height=300, margin=dict(t=40),
                                xaxis_title="Faux positifs", yaxis_title="Vrais positifs",
                                title=f"Courbe ROC (AUC={best_res.auc:.2f})")
            st.plotly_chart(figroc, width='stretch')
        with dc2:
            figi = px.bar(imp_c.sort_values().reset_index(), x="importance", y="index",
                          orientation="h", title="Importance des features (RandomForest)")
            figi.update_layout(height=620, yaxis_title="", margin=dict(t=40))
            st.plotly_chart(figi, width='stretch')
