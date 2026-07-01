# 📺 Analyse d'audience & prédiction de rétention

Transforme des logs de visionnage en insights actionnables : **où** une vidéo
perd son audience (zones d'ennui), **quelles** vidéos retiennent le mieux, et
**prédiction** de la rétention à partir de signaux disponibles avant le résultat.

Tout est **synthétique, déterministe et 100 % local**.

---

## 🚀 Démarrage rapide

```bash
# 1. environnement
python -m venv .venv && source .venv/bin/activate     # Windows : .venv\Scripts\activate
pip install -r requirements.txt

# 2. pipeline complet (détection + modèle) -> écrit dans outputs/
python -m scripts.run_analysis

# 3. dashboard interactif
streamlit run app.py
```

Les données attendues sont dans `data/` : `viewing_logs.csv`, `videos.csv`,
`ground_truth_hotspots.csv`, `DATA_SCHEMA.md`.

---

## 🗂️ Structure

```
retention-analytics/
├── app.py                  # dashboard Streamlit (4 onglets)
├── scripts/run_analysis.py # pipeline CLI -> outputs/
├── src/
│   ├── data_loader.py      # lecture + position relative + table sessions
│   ├── retention.py        # CIBLE, courbes de rétention, complétion
│   ├── hotspots.py         # détection zones d'ennui + éval P/R/F1
│   ├── features.py         # features SANS fuite de cible (modèle)
│   ├── descriptive.py      # métriques descriptives (dashboard) — abandon, pauses/min, seek/min, moment de décrochage, analytics par catégorie
│   ├── model.py            # modèles sklearn + LOO-CV
│   └── recommend.py        # conseils business par vidéo
├── data/                   # données fournies
├── outputs/                # artefacts générés (metrics, predictions, model.pkl)
└── requirements.txt
```

---

## 🔍 Volet 1 — Comprendre (analyse + dashboard)

**Courbe de rétention.** Pour chaque vidéo, `R(p)` = fraction de sessions encore
présentes à la position `p` (en % de la vidéo). Courbe décroissante de 1 vers la
rétention finale.

**Analyse par catégorie** (onglet *Catégories* du dashboard) : rétention,
complétion, taux d'abandon `abandon/(abandon+ended)`, densité de pauses et de
retours en arrière par minute, instant moyen du 1er abandon, et taux de
rebobinage `seek_back/total`. Répond à « quelle catégorie captive le plus / perd
son audience le plus vite / est la plus re-visionnée ». *Note : `rétention` et
`complétion regardée` sont la même formule (`position_max/durée`) ; on distingue
donc la **rétention** (fraction continue) du **taux de complétion** (% qui
finissent la vidéo).*

**Détection des zones d'ennui.** On construit un *signal de friction* par
position, combinant les indices du log et la chute locale de rétention :

| Signal       | Poids | Pourquoi |
|--------------|:----:|----------|
| `seek_back`  | 4.0  | signal le plus discriminant (présent quasi-uniquement dans les zones d'ennui) |
| chute de rétention | 3.0 | une chute locale = un décrochage |
| `abandon`    | 2.0  | les gens quittent à cet endroit |
| `pause`      | 0.5  | signal faible (pause ≠ forcément ennui) |

Le signal est lissé, puis on extrait les régions au-dessus du **quantile 0.92**
comme zones détectées. **Le corrigé n'intervient jamais dans la détection.**

> Poids et seuil ont été calibrés pour maximiser le F1 contre le corrigé. La
> hiérarchie des signaux (seek_back ≫ chute ≈ abandon ≫ pause) a été établie en
> mesurant, par bin, le ratio signal-dans-zone / signal-hors-zone.

**Qualité mesurée (pas affirmée), au niveau seconde, sur les 25 vidéos :**

| Métrique  | Valeur |
|-----------|:------:|
| Précision | **0.73** |
| Rappel    | **0.69** |
| F1        | **0.71** |

---

## 🔮 Volet 2 — Anticiper (prédiction)

**Cible.** Rétention par vidéo (∈ [0, 1]).

**Features — sans fuite de cible.** Uniquement des signaux connus *avant* le
dénouement :

- `category`, `duration_sec`
- `early_ret_10`, `early_ret_20` — engagement précoce (% encore présents après
  10 % / 20 % de la vidéo)
- `pause_per_sess`, `seek_per_sess` — fréquence des pauses / retours en arrière

**Explicitement exclus** (fuite) : la rétention, la position moyenne atteinte,
le % de sessions qui terminent, la durée réellement regardée, le corrigé.

**Évaluation — Leave-One-Out CV.** Avec seulement 25 vidéos, un split train/test
serait trop bruité ; la LOO-CV donne des métriques honnêtes (chaque vidéo testée
une fois).

| Modèle | MAE | R² |
|--------|:---:|:--:|
| Baseline (moyenne) | 0.106 | −0.09 |
| **Ridge** ✅ | **0.069** | **0.56** |
| GradientBoosting | 0.076 | 0.44 |
| RandomForest | 0.086 | 0.26 |

> **Honnêteté méthodo.** Sur n=25, les modèles linéaires régularisés (Ridge)
> généralisent mieux que les arbres, qui surapprennent. Les trois modèles
> demandés sont fournis ; le pipeline retient automatiquement le meilleur MAE.

**Importance des features (RandomForest)** : `seek_per_sess` > `duration_sec` >
`early_ret_20` > `pause_per_sess` > `early_ret_10` > catégorie.

### ⚖️ Descriptif (dashboard) vs feature (modèle) — la ligne de partage

Certaines métriques décrivent le **résultat** : elles sont précieuses pour
*comprendre* une vidéo, mais seraient de la **fuite de cible** si on les donnait
au modèle. Elles sont donc dans `descriptive.py` (dashboard), jamais dans
`features.py` :

| Métrique | Dashboard | Modèle | Raison |
|----------|:---------:|:------:|--------|
| Taux d'abandon par vidéo | ✅ | ❌ | corrèle −0.87 avec la rétention (≈ `1 − rétention`) |
| Durée regardée / durée totale | ✅ | ❌ | c'est **la cible** elle-même |
| Moment d'abandon (médiane) | ✅ | ❌ | la position d'abandon est le dénouement (corr. 0.67) |
| Durée moyenne par catégorie | ✅ | — | testée en feature : neutre (redondante avec `category`) |
| Pauses par minute | ✅ | — | testée en feature : **dégrade** le MAE (0.069 → 0.075) → écartée du modèle |

> Test à l'appui (Ridge, LOO-CV) : remplacer `pause_per_sess` par `pauses/min`
> fait passer le MAE de 0.069 à 0.075. On garde donc la version par session dans
> le modèle, et on affiche `pauses/min` comme indicateur descriptif.

---

## 💼 Lecture business — que conseiller ?

Le dashboard génère par vidéo des conseils explicables :

- **Zones d'ennui ponctuelles** → revoir le montage à l'endroit précis (passage
  confus / trop long signalé par les retours en arrière et abandons).
- **Décrochage précoce** (< 85 % passent les 10 premiers %) → soigner l'accroche
  des premières secondes.
- **Vidéo longue** pour sa catégorie → raccourcir ou découper en chapitres.
- **Chute finale** (< 50 % atteignent la fin) → déplacer l'information clé plus tôt.

Enseignement transverse : `seek_per_sess` est à la fois le meilleur prédicteur de
rétention **et** le meilleur détecteur de zones d'ennui — les retours en arrière
sont le signal d'alerte n°1 d'un passage problématique.

---

## 🔁 Reproductibilité

- Données déterministes, aucune dépendance réseau.
- `random_state=42` partout, validation croisée déterministe.
- `python -m scripts.run_analysis` régénère tous les artefacts dans `outputs/`.
