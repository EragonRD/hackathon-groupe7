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
- [ ] ❌ `GET /health` → statut + modèles chargés
- [ ] ❌ `POST /analyze` (vidéo) → lance le pipeline, renvoie le JSON contrat
- [ ] ❌ `POST /search` (query + video_id) → résultats recherche sémantique (tâche 22)
- [ ] ❌ Schémas Pydantic alignés **1:1** sur `docs/P3A-metadata-schema.md`
- [ ] ❌ Orchestration : transcription → résumé/chapitres/mots-clés → embeddings
- [ ] ❌ Vérif token : valider le JWT du Core (clé/algo partagés) — refus sinon (401)
- [ ] ❌ Gestion erreurs + statut de traitement (sync simple, async si le temps)
- [ ] ❌ Doc d'interface Engine↔Core (endpoint, payload, auth) figée avec Enzo

## Critères « fait »
- `POST /analyze` renvoie un JSON **validé** contre le contrat.
- Appel réussi depuis le Core de bout en bout (1 vidéo de `media/`).
- Token invalide → 401.

## Notes / pièges
- Figer le contrat d'interface avec Enzo **J1** (forme JWT, URL Engine).
- Garder les modèles chargés en mémoire (singleton) pour éviter rechargement par requête.
