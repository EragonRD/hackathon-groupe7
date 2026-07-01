# Tâche 10 — API Engine (FastAPI) + contrat JSON + lien Core · Responsable : Rabah

## Objectif
Exposer l'Engine via une API FastAPI appelable par le Core (NestJS), orchestrant le pipeline NLP (3A) et renvoyant un JSON **conforme** à `docs/P3A-metadata-schema.md`.

## Entrées / Sorties
| Entrées | Sorties |
|---|---|
| Fichier vidéo (upload ou chemin) + token Core | JSON métadonnées riche (contrat P3A) |

## Dépendances
- Bloquée par : 00 (socle).
- Consomme : 20 (transcript), 21 (résumé/mots-clés), 22 (recherche/traduction).

## Étapes (checklist)
- [x] ✅ `GET /health`
- [x] ✅ `POST /analyze` (upload) + `POST /analyze-path` (local) → job async → JSON contrat
- [x] ✅ `POST /search` (query + job_id) → recherche sémantique (timecodes + scores)
- [x] ✅ Schémas Pydantic alignés **1:1** sur `docs/P3A-metadata-schema.md` (`app/schemas.py`)
- [x] ✅ Orchestration : transcription → résumé/chapitres/mots-clés/traduction → embeddings (`app/pipeline.py`)
- [x] ✅ Vérif token JWT du Core (HS256, `JWT_SECRET`, `verify_sub=False`) — refus 401 (`app/auth.py`)
- [x] ✅ Gestion erreurs + statut de traitement **async** (jobs + polling)
- [x] ✅ Doc d'interface Engine↔Core (`engine/docs/api-contract.md`)

## Critères « fait »
- [x] ✅ `result` **validé** contre le contrat (`tests/test_contract.py`, `test_e2e.py`)
- [x] ✅ Flux complet HTTP de bout en bout sur vidéo `media/` (`scripts/demo_api.py`)
- [x] ✅ Token invalide / absent → 401 (`tests/test_api.py`)

## ✅ Tâche 10 TERMINÉE — validée par 11 tests (API + contrat + E2E)
> `app/nlp/{transcribe,summarize,search}.py` = **baselines fonctionnelles** ; affinage qualité = tâches **20 (Duval) / 21 (Antoine) / 22 (Izlene)**.

## Notes / pièges
- Contrat d'interface figé avec Enzo : `engine/docs/api-contract.md` (forme JWT, URL Engine).
- Modèles en **singleton paresseux** (`app/models.py`) pour éviter le rechargement par requête.
