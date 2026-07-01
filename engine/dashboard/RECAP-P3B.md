# 📊 Récapitulatif — Pôle 3 · Sujet B (Data : Audience & Rétention)

> Intégration du livrable **Squad Data 3B** (Otman, Amina, Faycal, Hassane) dans
> `engine/`. Transforme les logs de visionnage (`data/*.csv`) en insights :
> **où** une vidéo perd son audience, **quelles** vidéos retiennent le mieux, et
> **prédiction** de la rétention à partir de signaux disponibles avant le résultat.
> 100 % local, déterministe (`random_state=42`), aucune dépendance réseau.

---

## ✅ Ce qui est fait (mesuré, pas affirmé)

| Volet | Résultat | Vérifié le 2026-07-01 |
|---|---|:---:|
| Détection des zones d'ennui (vs corrigé) | **P=0.730 · R=0.692 · F1=0.711** | ✅ |
| Modèle prédictif de rétention (LOO-CV, n=25) | **Ridge — MAE=0.069 · R²=0.56** | ✅ |
| Dashboard Streamlit (4 onglets) | opérationnel | ✅ syntaxe + imports |
| Pipeline CLI reproductible | `scripts/run_analysis.py` régénère `outputs/` | ✅ exécuté |

`python scripts/run_analysis.py` (depuis `engine/`) réaffiche exactement
`P=0.730 R=0.692 F1=0.711` et retient **Ridge** automatiquement.

---

## 🗺️ Où est le code (mapping tâches → fichiers)

Le livrable a été intégré à l'emplacement **prévu par le plan** (`engine/tasks/30-33`) :

| Tâche | Responsable | Fichier intégré |
|---|---|---|
| 30 — Rétention + zones d'ennui | Otman | `engine/app/data/retention.py`, `engine/app/data/hotspots.py` |
| 31 — Modèle prédictif | Amina | `engine/app/data/model.py`, `engine/app/data/features.py` |
| 32 — Dashboard Streamlit | Faycal | `engine/dashboard/app.py` (remplace le placeholder) |
| 33 — Lecture business + doc | Hassane | `engine/app/data/recommend.py`, ce RECAP |
| Support commun | — | `engine/app/data/data_loader.py`, `engine/app/data/descriptive.py` |
| Pipeline CLI | — | `engine/scripts/run_analysis.py` |

```
engine/
├── app/data/            # modules Data 3B (package Python `app.data`)
│   ├── data_loader.py   # lecture CSV + position relative + table sessions
│   ├── retention.py     # CIBLE, courbes de rétention, complétion
│   ├── hotspots.py      # détection zones d'ennui + éval P/R/F1
│   ├── features.py      # features SANS fuite de cible (modèle)
│   ├── model.py         # Ridge / RandomForest / GradientBoosting + LOO-CV
│   ├── descriptive.py   # métriques descriptives (dashboard)
│   └── recommend.py     # conseils business par vidéo
├── dashboard/app.py     # dashboard Streamlit (ce dossier)
└── scripts/run_analysis.py  # pipeline CLI -> engine/outputs/
```

Les données `data/*.csv` (`viewing_logs`, `videos`, `ground_truth_hotspots`,
`DATA_SCHEMA.md`) **ne sont pas dupliquées** : le code lit la **racine du repo**
`../../../../data/` (déjà présente, fichiers identiques au livrable).

---

## ▶️ Lancer

Depuis le dossier `engine/` (voir `engine/README.md` pour l'installation `.venv`) :

```bash
# 1. pipeline CLI (régénère engine/outputs/, ignoré par git)
python scripts/run_analysis.py
#    -> doit afficher  P=0.730  R=0.692  F1=0.711

# 2. dashboard
streamlit run dashboard/app.py
#    -> http://localhost:8501  (onglets : Par vidéo · Comparaison · Qualité détec. · Prédiction)
```

Dépendances (déjà dans `engine/requirements.txt`) : `pandas numpy scikit-learn
joblib streamlit plotly`.

---

## 🔬 Méthodologie (résumé)

**Courbe de rétention.** `R(p)` = fraction de sessions encore présentes à la
position `p` (% de la vidéo). Décroît de 1 vers la rétention finale.

**Détection des zones d'ennui.** Signal de *friction* par position, combinant les
indices du log et la chute locale de rétention, lissé, puis on garde les régions
au-dessus du **quantile 0.92**. **Le corrigé n'intervient jamais dans la détection**
(uniquement pour mesurer P/R/F1).

| Signal | Poids | Pourquoi |
|---|:--:|---|
| `seek_back` | 4.0 | signal le plus discriminant (quasi exclusif aux zones d'ennui) |
| chute de rétention | 3.0 | une chute locale = un décrochage |
| `abandon` | 2.0 | les gens quittent à cet endroit |
| `pause` | 0.5 | signal faible (pause ≠ ennui) |

**Prédiction — sans fuite de cible.** Cible = rétention par vidéo ∈ [0,1].
Features connues *avant* le dénouement uniquement : `category`, `duration_sec`,
`early_ret_10/20` (engagement précoce), `pause_per_sess`, `seek_per_sess`.
Exclus (fuite) : rétention, position moyenne, % terminé, durée regardée, corrigé.
Évaluation **Leave-One-Out CV** (n=25 → un split train/test serait trop bruité).

| Modèle | MAE | R² |
|---|:--:|:--:|
| Baseline (moyenne) | 0.106 | −0.09 |
| **Ridge** ✅ | **0.069** | **0.56** |
| GradientBoosting | 0.076 | 0.44 |
| RandomForest | 0.086 | 0.26 |

> Sur n=25, les modèles linéaires régularisés (Ridge) généralisent mieux que les
> arbres (qui surapprennent). Les 3 modèles demandés sont fournis ; le pipeline
> retient automatiquement le meilleur MAE.

**Lecture business** (`recommend.py`, affiché dans le dashboard) : zone d'ennui
ponctuelle → revoir le montage à l'endroit précis ; décrochage précoce → soigner
l'accroche ; vidéo longue pour sa catégorie → raccourcir/chapitrer ; chute finale
→ déplacer l'info clé plus tôt. Enseignement transverse : `seek_per_sess` est à la
fois le meilleur **prédicteur** de rétention et le meilleur **détecteur** de zones
d'ennui — les retours en arrière sont le signal d'alerte n°1.

---

## 🔧 Adaptations faites à l'intégration (vs le zip livré)

- Package renommé `src/` → `app.data` (imports absolus `from app.data.X`) ;
  les imports internes relatifs (`from .retention`) sont inchangés.
- `dashboard/app.py` et `scripts/run_analysis.py` : ajout d'un shim
  `sys.path.insert(0, <racine engine>)` (même convention que
  `scripts/analyze_file.py`) pour rendre le package `app` importable.
- `data_loader.py` : `DATA_DIR` pointe vers la racine du repo (données partagées,
  pas de doublon).
- `engine/requirements.txt` : ajout de `joblib` et `plotly` (`matplotlib`,
  inutilisé, volontairement écarté).
- **Non commités** (régénérables / ignorés par `engine/.gitignore`) :
  `outputs/*`, `__pycache__/`. **Non copié** : `data/` (déjà à la racine).

---

## 🔁 Reproductibilité

- Données déterministes, `random_state=42` partout, LOO-CV déterministe.
- `python scripts/run_analysis.py` régénère tous les artefacts dans `engine/outputs/`.
