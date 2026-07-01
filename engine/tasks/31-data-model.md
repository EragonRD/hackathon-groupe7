# Tâche 31 — Modèle prédictif de rétention · Responsable : Amina

## Objectif
Prédire la rétention d'une vidéo à partir de features **indépendantes du dénouement** (sans fuite de cible), avec métriques honnêtes.

## Entrées / Sorties
| Entrées | Sorties |
|---|---|
| `data/viewing_logs.csv`, `data/videos.csv` | Modèle scikit-learn entraîné + métriques (MAE, R²) + doc features |

## Dépendances
- Bloquée par : 00.
- Partage des features avec : 30. Alimente : 32, 33.

## Étapes (checklist)
- [x] ✅ Lire `DATA_SCHEMA.md` : identifier la **cible** et ce qui la recopie (interdit)
- [x] ✅ Construire des features **sans fuite** : catégorie, durée, engagement précoce, nb pauses / retours arrière, fréquence (`app/data/features.py`)
- [x] ✅ Bannir explicitement : score de rétention, position moyenne atteinte, % sessions terminées
- [x] ✅ Leave-One-Out CV (25 vidéos → split train/test trop bruité, LOO-CV = métriques honnêtes)
- [x] ✅ Modèles : Ridge / RandomForest / GradientBoosting (comparer) — Ridge retenu (MAE 0.069)
- [x] ✅ Métriques : **MAE**, **R²** (LOO-CV, jamais in-sample)
- [x] ✅ Importance des features (interprétation) — `seek_per_sess` domine
- [x] ✅ Module `app/data/model.py` : `train()`, `evaluate()`, `predict()`

## Critères « fait »
- Aucune feature de fuite (revue croisée avec Otman).
- MAE / R² reportés sur jeu de test.
- Features documentées + justifiées.

## Notes / pièges
- ⚠️ **Fuite de cible** = disqualifiant : vérifier chaque feature.
- Privilégier l'**engagement précoce** (signaux du début de session).
