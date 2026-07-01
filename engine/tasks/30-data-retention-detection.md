# Tâche 30 — Rétention + détection des zones d'ennui · Responsable : Otman

## Objectif
Transformer les logs en **courbe de rétention** par vidéo et **détecter les zones d'ennui**, puis **mesurer** la détection contre le corrigé fourni.

## Entrées / Sorties
| Entrées | Sorties |
|---|---|
| `data/viewing_logs.csv`, `data/videos.csv` | Courbe de rétention/position, zones d'ennui détectées, scores précision/rappel |

## Dépendances
- Bloquée par : 00.
- Alimente : 31 (features dérivées éventuelles), 32 (dashboard), 33 (business).

## Étapes (checklist)
- [x] ✅ Lire `DATA_SCHEMA.md` : comprendre colonnes + définition de la cible
- [x] ✅ Construire la courbe de rétention par position (% audience encore présente)
- [x] ✅ Détecter les zones d'ennui : chutes de rétention / pics pauses / retours arrière
- [x] ✅ Charger `ground_truth_hotspots.csv` **uniquement pour mesurer**
- [x] ✅ Calculer **précision / rappel** détection vs corrigé — P=0.69 R=0.86 F1=0.77
- [x] ✅ Module `app/data/retention.py` : fonctions réutilisables par le dashboard (+ `app/data/hotspots.py`, `app/data/data_loader.py`)

## Critères « fait »
- Courbe de rétention correcte par vidéo.
- Zones d'ennui détectées + précision/rappel **chiffrés** (pas affirmés).
- Code réutilisé tel quel par la tâche 32.

## Notes / pièges
- ⚠️ Le corrigé `ground_truth_hotspots.csv` sert **à mesurer**, jamais à produire la détection.
- Définir clairement le seuil de « zone d'ennui » et le justifier.
