# Plan maître — Engine · Pôle 3 (IA & Data)

> Branche : `feat/intelligence-artificielle-data` (fusionnée sur `master`).
> Statut : **🟢 3A LIVRÉ · 🔴 3B (Data) À FAIRE** — voir « Réconciliation code » en bas.
> Document vivant : mis à jour à chaque étape.
> ⚠️ Cases recalées sur le **code réel le 2026-07-01** (le plan était périmé).

---

## 1. Contexte

Le Pôle 3 construit la brique **Engine** : un service Python, nouveau dans le dépôt (`engine/`), qui rend une vidéo et des données d'usage *exploitables*. Il est piloté par **Rabah** (lead) et regroupe 8 personnes réparties en deux squads. L'Engine ne vit pas seul : il est **appelé par le Core** (NestJS), et ses résultats s'affichent dans la **View** (React). C'est cette couture qui est notée au Bloc B.

Deux sujets sont menés en parallèle :
- **3A — Indexation & analyse sémantique** (squad NLP) : sujet noté **principal**.
- **3B — Analyse d'audience & rétention** (squad Data) : enrichit la View et l'intégration, présenté en **bonus**.

## 2. Objectif

| # | Objectif | Mesure de réussite |
|---|---|---|
| O1 | Pipeline 3A : vidéo → JSON riche conforme au contrat | JSON valide vs `docs/P3A-metadata-schema.md`, démo sur ≥ 1 vidéo |
| O2 | Pipeline 3B : logs → dashboard + modèle prédictif | Dashboard reproductible, métriques MAE/R² documentées |
| O3 | API Engine appelable par le Core | Endpoint répond, intégration de bout en bout |
| O4 | 100 % local, gratuit, reproductible | `requirements.txt` + 1 commande, aucune clé payante |
| O5 | Répartition claire et traçable | 1 fichier de tâche par membre, checklist à jour |

## 3. Constats (état actuel)

| Élément | État |
|---|---|
| `engine/` | Créé, README posé. Code à construire. |
| Python | `python3.10` présent. Aucun venv ni `requirements.txt`. |
| Modèles (Whisper/Ollama) | Non installés (cf. `scripts/prefetch.sh`). |
| Contrat 3A | `docs/P3A-metadata-schema.md` fourni — à respecter. |
| Données 3B | `data/viewing_logs.csv`, `videos.csv`, `ground_truth_hotspots.csv`, `DATA_SCHEMA.md` fournis. |
| Core (auth) | Opérationnel — `POST /auth/login`, `GET /auth/me`. Orchestration Engine à ajouter (P2/Enzo). |

## 4. Décisions (proposées — à valider)

| # | Décision | Justification |
|---|---|---|
| D1 | API = **FastAPI** | Léger, standard Python, simple à appeler depuis le Core |
| D2 | Transcription = **faster-whisper** (CPU) | Local, rapide sur CPU, segments horodatés |
| D3 | Résumé/chapitres = **llama.cpp** (llama-cpp-python, GGUF quantifié Q4), repli NLP classique | In-process, sans daemon, intégré à FastAPI ; repli garantit une démo même sans modèle lourd |
| D4 | Modèle 3B = **scikit-learn** (forêts / gradient boosting) | Simple, métriques claires, anti-fuite de cible |
| D5 | Dashboard = **Streamlit** | Rapide à livrer, lisible |
| D6 | Tâches détaillées → `engine/tasks/NN-*.md` (1 par membre/tâche) | Clarté, traçabilité, reprise |
| D7 | 3A = livrable noté principal, 3B = bonus d'intégration | Maximise la note du pôle + couture Bloc B |

## 5. Risques

| Risque | Impact | Parade |
|---|---|---|
| Whisper/LLM trop lourds sur CPU | Démo lente | Modèles légers (Whisper `tiny`/`base`, GGUF quantifié Q4), repli NLP classique |
| **Fuite de cible** en 3B | Modèle invalide / triché | Bannir score de rétention et proxys comme features ; revue croisée |
| Engine non branché au Core à temps | Bloc B faible | Figer le contrat d'interface dès J1 avec Enzo |
| Dérive du JSON vs contrat | Non-conformité 3A | Valider chaque sortie contre `P3A-metadata-schema.md` |
| Modèles non prefetch (réseau lent) | Blocage | Lancer `scripts/prefetch.sh` tôt |

## 6. Plan d'Action (checklist)

### Phase 0 — Cadrage & socle
- [x] ✅ Valider ce plan (Rabah) — implémentation lancée
- [x] ✅ Figer le contrat d'interface Engine↔Core avec Enzo — orchestration opérationnelle
- [x] ✅ Créer env Python (`requirements.txt`, venv) + structure `app/`
- [x] ✅ Générer les fichiers de tâches `engine/tasks/*.md`

### Phase 1 — Squad NLP (3A) — ✅ LIVRÉ
- [x] ✅ API Engine + contrat JSON + orchestration + auth + jobs async (Rabah) — **testé E2E**
- [x] ✅ Extraction audio + transcription Whisper horodatée (Duval) — `app/nlp/transcribe.py`
- [x] ✅ Résumé + chapitres + mots-clés (Antoine) — `app/nlp/summarize.py`
- [x] ✅ Recherche sémantique + traduction multilingue (Izlene) — `app/nlp/search.py` + `translate.py` (NLLB-200)
- [x] ✅ Pipeline testé (11 tests, cf. `todo/context-state.md`) ; corpus `tests/examples/`

### Phase 2 — Squad Data (3B) — 🔴 À FAIRE (aucun code)
- [ ] ❌ Courbe de rétention + détection zones d'ennui + mesure vs corrigé (Otman)
- [ ] ❌ Modèle prédictif scikit-learn, features sans fuite, MAE/R² (Amina)
- [ ] ❌ Dashboard Streamlit + comparaison vidéos (Faycal) — *`dashboard/app.py` = placeholder*
- [ ] ❌ Lecture business + doc reproductible (Hassane)

### Phase 3 — Intégration (Bloc B)
- [x] ✅ **Core appelle l'Engine** (P2↔P3 : orchestration par `contentId`, service Docker)
- [ ] ❌ **Résultats affichés dans la View** (P1↔P3 : transcription/chapitres/hotspots) — cf. `docs/P1-integration-checklist.md` §2
- [ ] ❌ Répétition démo « une identité, un flux »

## 7. Découpage des fichiers de tâches (à générer après validation)

| Fichier proposé | Membre | Tâche |
|---|---|---|
| `engine/tasks/00-setup-env.md` | Rabah | Env Python, structure, dépendances |
| `engine/tasks/10-api-engine.md` | Rabah | API FastAPI + contrat JSON + lien Core |
| `engine/tasks/20-nlp-transcription.md` | Duval | ffmpeg + Whisper, segments horodatés |
| `engine/tasks/21-nlp-summary-keywords.md` | Antoine | Résumé, chapitres, mots-clés |
| `engine/tasks/22-nlp-semantic-search.md` | Izlene | Embeddings, recherche, traduction |
| `engine/tasks/30-data-retention-detection.md` | Otman | Rétention + zones d'ennui + mesure |
| `engine/tasks/31-data-model.md` | Amina | Modèle prédictif, anti-fuite, métriques |
| `engine/tasks/32-data-dashboard.md` | Faycal | Dashboard Streamlit |
| `engine/tasks/33-data-business-doc.md` | Hassane | Lecture business, doc repro |

> 1 fichier = 1 responsable. Chaque fichier reprendra : objectif, entrées/sorties, étapes (checklist), dépendances, critères « fait ».

## 8. Avancement

| Date | Étape | Statut |
|---|---|---|
| 2026-06-30 | Création `engine/` + README + ce plan | ✅ |
| 2026-06-30 | FastAPI validé · **llama.cpp** retenu (vs Ollama) | ✅ |
| 2026-06-30 | Génération des 9 fiches de tâches `engine/tasks/` | ✅ |
| 2026-06-30 | **Tâche 00 setup** : venv + deps CPU-only + `/health` OK | ✅ |
| 2026-06-30 | Nettoyage disque (~60 Go) + choix modèles légers (`docs/model-selection.md`) | ✅ |
| 2026-06-30 | Téléchargement GGUF Qwen2.5-1.5B Q4_K_M → `engine/models/` | ✅ |
| 2026-06-30 | Plan de tests + benchmark perf chiffré (`tests/`) | ✅ |
| 2026-06-30 | **Tâche 10 — API Engine** (endpoints, auth JWT, jobs async, orchestration) | ✅ testé E2E |
| 2026-06-30 | Tâches 20/21/22 (transcription, résumé/chapitres/mots-clés, recherche/traduction) | ✅ implémentées |
| 2026-07-01 | Tâches 30→33 (Data 3B) | ❌ non commencées (aucun code) |
| 2026-07-01 | Bloc B : P2↔P3 ✅ · P1↔P3 (View) ❌ | ⏳ partiel |

## 9. Résumé Non-Technique

On crée un nouveau « moteur » (`engine/`) qui fait deux choses utiles. **Côté contenu**, il regarde une vidéo et en sort automatiquement un résumé : ce qui est dit (transcription), dans quelle langue, découpé en chapitres, avec les mots importants — pour qu'on puisse *retrouver* un passage sans tout revisionner. **Côté audience**, il analyse les statistiques de visionnage pour montrer *où les gens décrochent* d'une vidéo et *prévoir* quelles vidéos retiennent le mieux, le tout dans un tableau de bord lisible.

Le travail est réparti entre 8 personnes en deux équipes, chacune avec sa fiche de tâche claire. La partie **contenu (3A) est livrée** ; la partie **audience (3B) reste à faire**.

## 10. Réconciliation code (2026-07-01)

État vérifié dans le code sur `master` (pas de supposition) :

| Bloc | Constat | État |
|---|---|---|
| API Engine (T10) | `app/main.py`, auth JWT, jobs async | ✅ |
| Transcription (T20) | `app/nlp/transcribe.py` | ✅ |
| Résumé/chapitres/mots-clés (T21) | `app/nlp/summarize.py` | ✅ |
| Recherche/traduction (T22) | `app/nlp/search.py` + `translate.py` (NLLB-200) | ✅ |
| Rétention 3B (T30) | aucun fichier, aucun code rétention/hotspot | ❌ |
| Modèle 3B (T31) | aucun usage `scikit-learn` ; `app/data/` vide | ❌ |
| Dashboard 3B (T32) | `dashboard/app.py` = **placeholder** Streamlit | ❌ |
| Doc business 3B (T33) | absent | ❌ |
| Bloc B P2↔P3 | orchestration Core→Engine réelle | ✅ |
| Bloc B P1↔P3 | affichage metadata dans la View | ❌ |

**Reste à faire = tout le Data 3B (bonus)** + **l'affichage front des métadonnées IA**
(cf. `docs/P1-integration-checklist.md`). Le noyau 3A (sujet noté principal) est livré.

> Rappel anti-fuite (T31) : bannir le score de rétention et ses proxys comme features.
