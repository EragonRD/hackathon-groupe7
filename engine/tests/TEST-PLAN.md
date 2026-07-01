# Plan de tests — Engine Pôle 3 (batterie)

> Branche `feat/intelligence-artificielle-data`. Objectif : valider chaque brique de l'Engine (3A NLP + 3B Data) + l'intégration, avec des critères mesurables. Outils : `pytest`, `jsonschema`, `tests/bench_pipeline.py`.

## 0. Niveaux de test
| Niveau | But | Portée |
|---|---|---|
| **U** Unitaire | Une fonction/module isolé | rapide, sans modèle si possible (mocks) |
| **I** Intégration | Plusieurs modules ensemble | pipeline partiel |
| **E2E** Bout-en-bout | Vidéo → JSON final / API | réaliste |
| **C** Conformité | Respect du contrat JSON P3-A | `jsonschema` vs `docs/P3A-metadata-schema.md` |
| **P** Performance | Temps / RTF / tokens-s / RAM | mesuré (bench) |
| **R** Robustesse | Cas limites & erreurs | entrées dégradées |

## 1. Tests par module (U)

### T20 — Transcription (Duval)
- [ ] Extraction audio → WAV **16 kHz mono** (vérifie `sample_rate`, `channels`)
- [ ] `transcribe()` renvoie ≥ 1 segment, chaque segment a `start < end`, `text` non vide
- [ ] Segments **ordonnés** et non chevauchants
- [ ] `language` détectée renvoyée

### T21 — Résumé/chapitres/mots-clés (Antoine)
- [ ] `summary` non vide et **≠ recopie** du transcript (longueur < transcript)
- [ ] `chapters[]` horodatés, ordonnés, couvrant la durée
- [ ] `keywords[]` non vide, sans doublon
- [ ] **Repli TextRank/KeyBERT** fonctionne si LLM désactivé (flag)

### T22 — Recherche sémantique + traduction (Izlene)
- [ ] `build_index()` : 1 vecteur/segment, dimension cohérente
- [ ] `search(q)` : top-k **triés par score décroissant**, renvoie timecodes
- [ ] Requête FR sur contenu EN → segment pertinent (multilingue)
- [ ] `translation` non vide

### T30 — Rétention & zones d'ennui (Otman)
- [ ] Courbe de rétention bornée **[0,1]**, globalement décroissante
- [ ] Détection de zones renvoie des intervalles valides
- [ ] **Précision/rappel** calculés vs `ground_truth_hotspots.csv`

### T31 — Modèle prédictif (Amina)
- [ ] **Anti-fuite** : test qui ÉCHOUE si une feature interdite (score rétention, % terminés, position moyenne) entre dans X
- [ ] `MAE`/`R²` calculés sur **jeu de test** (pas train)
- [ ] Reproductible (seed fixe → mêmes métriques)

### T10 — API Engine (Rabah)
- [ ] `GET /health` → 200 `{status:ok}`
- [ ] `POST /analyze` sans token → **401**
- [ ] `POST /analyze` (token valide) → JSON Pydantic valide

## 2. Intégration (I)
- [ ] Pipeline NLP complet : vidéo → dict unique (transcript+résumé+chapitres+keywords+embeddings)
- [ ] Engine ↔ Core : token Core valide accepté, token forgé/expiré rejeté
- [ ] Dashboard (T32) consomme les sorties de T30/T31 sans recalcul divergent

## 3. Bout-en-bout (E2E)
- [ ] `POST /analyze` sur `media/` → **tous les champs du contrat remplis** (aucun vide)
- [ ] Scénario démo : `search("sécurité")` → renvoie le bon timecode
- [ ] 1 commande reproductible (script de démo)

## 4. Conformité contrat (C)
- [ ] Sortie validée par `jsonschema` contre `docs/P3A-metadata-schema.md`
- [ ] Test **rouge** si un champ requis manque ou type incorrect

## 5. Performance (P) — voir `ESTIMATIONS.md`
- [ ] Mesurer RTF Whisper, tokens/s llama, temps embeddings (`bench_pipeline.py`)
- [ ] Empreinte **RAM pic ≤ ressources machine** (~3 Go visé)
- [ ] Estimation extrapolée par durée (60 s → 30 min)

## 6. Robustesse (R) — cas limites
| Cas | Attendu |
|---|---|
| Vidéo **muette**/sans parole | Pas de crash ; transcript vide géré proprement |
| Langue étrangère | Détection langue + traduction OK |
| Vidéo **très courte** (<5 s) | Au moins 1 segment ou message clair |
| Transcript **> n_ctx** | Chunking, pas de troncature silencieuse |
| Fichier **corrompu**/format inconnu | Erreur explicite (pas de stacktrace brute) |
| Audio bruité | Dégradation gracieuse |

## 7. Données de test
| Jeu | Usage | Durée |
|---|---|---|
| `media/42 - POC Parc des Princes V1 .mp4` | E2E/perf NLP | 87 s |
| `media/sample.mp4` (démo 42c, vraie parole) | qualité transcript FR | à DL |
| Sintel (CC-BY) clip | langue EN, multilingue | variable |
| Clips synthétiques courts (5–30 s) | unitaires/robustesse | court |
| `data/*.csv` + `ground_truth_hotspots.csv` | P3-B (T30/T31) | — |

## 8. Organisation des fichiers de test (cible)
```
engine/tests/
├── TEST-PLAN.md            ← ce fichier
├── ESTIMATIONS.md          ← perf chiffrée (bench)
├── bench_pipeline.py       ← benchmark perf (existe)
├── test_transcription.py   ← T20 (U)
├── test_summary.py         ← T21 (U)
├── test_search.py          ← T22 (U)
├── test_retention.py       ← T30 (U)
├── test_model_leakage.py   ← T31 anti-fuite (U) — prioritaire
├── test_api.py             ← T10 (U/I)
├── test_contract.py        ← C (jsonschema)
└── test_e2e.py             ← E2E
```

## 9. Exécution
```bash
cd engine && source .venv/bin/activate
pytest tests/ -v                       # toute la batterie
pytest tests/test_model_leakage.py -v  # ciblé
python tests/bench_pipeline.py "media/42 - POC Parc des Princes V1 .mp4"
```

## 10. Critères de sortie (Definition of Done global)
- [ ] Tous les tests U/I/E2E **verts**
- [ ] JSON **conforme** au contrat (C)
- [ ] Aucune **fuite de cible** (T31)
- [ ] Perf **dans le budget** RAM/temps de la machine (P)
- [ ] Robustesse : aucun crash sur les cas limites (R)
