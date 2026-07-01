# 📊 Lecture business — Audience & rétention (P3-B)

> Tâche 33 (Hassane). Consomme les résultats des tâches 30 (Otman — rétention
> & détection), 31 (Amina — modèle prédictif) et 32 (Faycal — dashboard).
> Public visé : non-technique (jury, PM, créateurs de contenu).
> Chiffres mesurés via `python scripts/run_analysis_3b.py` (`engine/outputs/data-3b/metrics.json`).

---

## 1. Ce qu'on mesure

**Rétention d'une vidéo** = en moyenne, quelle fraction de la vidéo les gens
regardent avant de partir (`position_max_atteinte / durée`, moyenné sur
toutes les sessions). Une rétention de 0,55 veut dire : en moyenne, le
public part après avoir vu 55 % de la vidéo.

**Zones d'ennui** = portions de la vidéo où l'audience décroche plus que la
normale (retours en arrière, pauses groupées, abandons, chute locale de la
courbe de rétention).

---

## 2. Comment on détecte les zones d'ennui (honnêteté méthodo)

Signal de friction par position, combinant 4 indices comportementaux :

| Signal | Poids | Pourquoi |
|---|:---:|---|
| `seek_back` (retour en arrière) | 4.0 | signal le plus discriminant — quasi-uniquement présent dans les zones d'ennui |
| chute locale de rétention | 3.0 | une chute = un décrochage réel |
| `abandon` | 2.0 | les gens quittent à cet endroit précis |
| `pause` | 0.5 | signal faible (une pause n'est pas forcément de l'ennui) |

On extrait les régions au-dessus du **quantile 0.92** du signal, **union**
avec les décrochages progressifs et prolongés de la courbe de rétention
(perte cumulée ≥ 10 % d'audience — capte les baisses lentes qui ne génèrent
pas de pic de comportement marqué). **Le corrigé
(`ground_truth_hotspots.csv`) n'intervient jamais dans la détection** — il
sert uniquement à mesurer la qualité a posteriori.

**Qualité mesurée**, au niveau seconde, sur les 25 vidéos :

| Précision | Rappel | F1 |
|:---:|:---:|:---:|
| **0.69** | **0.86** | **0.77** |

Le rappel élevé (0.86) vient de l'union des deux signaux (friction ponctuelle
+ décrochages progressifs) : on capte plus de vraies zones d'ennui, au prix
d'un peu plus de faux positifs (précision 0.69) — un compromis assumé pour
ne pas rater de décrochages lents.

---

## 3. Comment on prédit la rétention (honnêteté méthodo)

**Cible** : rétention par vidéo. **Features — sans fuite de cible** :
`category`, `duration_sec`, engagement précoce (`early_ret_10`,
`early_ret_20`), fréquence de pauses/retours en arrière par session.
**Explicitement bannis** (fuite) : la rétention elle-même, la position
moyenne atteinte, le % de sessions qui terminent, le corrigé.

**Évaluation — Leave-One-Out CV** (25 vidéos → un split train/test serait
trop bruité) :

| Modèle | MAE | R² |
|---|:---:|:---:|
| Baseline (moyenne) | 0.106 | −0.09 |
| **Ridge** ✅ | **0.069** | **0.56** |
| GradientBoosting | 0.076 | 0.44 |
| RandomForest | 0.086 | 0.27 |

Sur un échantillon aussi petit, un modèle linéaire régularisé généralise
mieux que les arbres, qui surapprennent — résultat honnête, pas une faiblesse
cachée. **Importance des features** (RandomForest, pour l'interprétation) :
`seek_per_sess` > `duration_sec` > `early_ret_20` > `pause_per_sess` >
`early_ret_10` > catégorie.

---

## 4. Ce qui reste descriptif (jamais dans le modèle)

Certaines métriques décrivent le **résultat** — utiles pour comprendre une
vidéo, mais interdites comme feature (fuite de cible) : taux d'abandon par
vidéo (corrèle fortement avec la rétention), durée regardée/durée totale
(c'est la cible), moment médian d'abandon. Elles vivent dans le dashboard
(`app/data/descriptive.py`), jamais dans `app/data/features.py`.

---

## 5. Insights → actions concrètes

| Constat détecté | Action recommandée |
|---|---|
| Zone d'ennui ponctuelle (pic de retours en arrière / pauses / abandons à un instant précis) | Revoir le montage à cet endroit précis — passage confus ou trop long |
| Décrochage précoce (< 85 % passent les 10 premiers %) | Soigner l'accroche des toutes premières secondes |
| Vidéo longue pour sa catégorie (> médiane et > 360 s) | Raccourcir, ou découper en chapitres |
| Chute finale marquée (< 50 % atteignent la fin) | Déplacer l'information clé plus tôt dans la vidéo |

**Enseignement transverse** : `seek_per_sess` (retours en arrière) est à la
fois le meilleur prédicteur de rétention **et** le meilleur détecteur de
zones d'ennui — un spectateur qui rejoue un passage est le signal d'alerte
n°1 d'un passage à revoir.

Le dashboard (onglet « Par vidéo ») génère ces conseils automatiquement pour
chaque vidéo via `app/data/recommend.py`.

---

## 6. Guide de reproduction

Tout est **synthétique, déterministe, 100 % local** — `random_state=42`
partout, aucune dépendance réseau, aucune clé payante.

```bash
cd engine
python -m virtualenv .venv && source .venv/bin/activate   # Windows : .venv\Scripts\activate
pip install -r requirements.txt

# pipeline complet (détection + modèle) -> engine/outputs/data-3b/
python scripts/run_analysis_3b.py

# dashboard interactif
streamlit run dashboard/app.py

# (bonus, optionnel) API REST JSON pour un consommateur front
uvicorn app.data.api.main:app --reload --port 8010   # docs sur /docs
```

Données lues depuis `../data/` (racine du repo, partagée par toute
l'équipe) : `viewing_logs.csv`, `videos.csv`, `ground_truth_hotspots.csv`,
`DATA_SCHEMA.md`.

---

## 7. Messages clés pour la soutenance (volet Data 3B)

1. **On ne devine pas au hasard** : le modèle de rétention bat une baseline
   naïve de 35 % (MAE 0.069 vs 0.106), en LOO-CV honnête (pas de fuite de
   cible — vérifié feature par feature).
2. **La détection de zones d'ennui est mesurée, pas affirmée** : F1 = 0.77
   contre un corrigé humain (P=0.69, R=0.86), jamais utilisé pour produire
   la détection elle-même.
3. **Un seul signal domine** : les retours en arrière (`seek_back`) sont à
   la fois le meilleur prédicteur de rétention et le meilleur détecteur
   d'ennui — un message business simple et actionnable.
4. **Tout est reproductible en une commande**, sans modèle lourd ni clé
   API — contrairement au volet NLP (3A), ce volet tourne en quelques
   secondes sur CPU.
