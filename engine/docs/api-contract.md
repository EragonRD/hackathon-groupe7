# API Engine ↔ Core — contrat d'interface (T10)

> Service **Engine** (FastAPI, Python). Appelé par le **Core** (NestJS). Auth = **JWT du Core**.
> Base URL locale : `http://localhost:8000`.

## Authentification
- En-tête : `Authorization: Bearer <accessToken>` (le JWT émis par `POST /auth/login` du Core).
- Algo **HS256**, secret partagé via env **`JWT_SECRET`** (défaut `dev-secret-change-me`, comme le Core).
- **Refus par défaut** : 401 si token absent / invalide / expiré.
- Bypass local (dev/tests sans Core) : `ENGINE_REQUIRE_AUTH=false`.

> ⚠️ Interop : le Core émet `sub` **numérique** (user.id) ; l'Engine désactive la vérif `sub` de PyJWT pour rester compatible. Garder **le même `JWT_SECRET`** des deux côtés.

## Endpoints
| Méthode | Endpoint | Auth | Rôle |
|---|---|---|---|
| GET | `/health` | non | sonde de vie |
| POST | `/analyze` | oui | upload vidéo (`multipart/form-data`, champ `file`) → job |
| POST | `/analyze-path` | oui | analyse un fichier **local** (`{"path": "..."}`) → job (test/démo) |
| GET | `/jobs/{job_id}` | oui | statut + résultat (métadonnées P3-A) |
| POST | `/search` | oui | recherche sémantique dans une vidéo analysée |

### Cycle de vie d'une analyse (asynchrone)
L'analyse (transcription + LLM) prend de quelques secondes à plusieurs minutes → **traitement async** :
1. `POST /analyze` → `{ "job_id": "...", "status": "processing" }`
2. `GET /jobs/{job_id}` → `status` ∈ `processing | done | error`
3. quand `done` → `result` = métadonnées conformes au **contrat P3-A**.

### Exemples
```bash
# 1) Analyse (upload)
curl -X POST http://localhost:8000/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@media/demo.mp4"
# → { "job_id": "0da528...", "status": "processing" }

# 2) Statut / résultat
curl http://localhost:8000/jobs/0da528... -H "Authorization: Bearer $TOKEN"
# → { "job_id": "...", "status": "done", "result": { ...contrat P3-A... }, "error": null }

# 3) Recherche sémantique
curl -X POST http://localhost:8000/search \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "job_id": "0da528...", "query": "sécurité", "k": 3 }'
# → { "query": "sécurité", "hits": [ { "start": 50.6, "end": 55.0, "text": "...", "score": 0.58 } ] }
```

### Réponse `/jobs/{id}` (result) — contrat P3-A (+ extension multilingue)
Voir `../docs/P3A-metadata-schema.md`. Champs : `video, language, duration_sec, transcript, segments[], translation{lang,text}, summary, chapters[{title,start}], keywords[], generated_at`.

**Extension `translations[]` (sous-titres multilingues)** — en plus du `translation` unique (compat contrat), chaque analyse produit une piste par langue cible (`config.TARGET_LANGS`, défaut `fr,en,es,ar`) :
```json
"translations": [
  {
    "lang": "fr",
    "text": "Texte intégral traduit…",
    "segments": [ { "start": 1.6, "end": 9.7, "text": "Bonjour, les filles de 2020 !" } ]
  },
  { "lang": "es", "text": "…", "segments": [ … ] },
  { "lang": "ar", "text": "…", "segments": [ … ] }
]
```
- `segments[]` = **sous-titres horodatés** (réutilisent les timecodes de la transcription).
- La **langue source** est incluse telle quelle (sous-titres originaux).
- Traduction par **NLLB-200** (modèle dédié, 200 langues) — ajouter une langue = étendre `TARGET_LANGS`.

## Codes d'erreur
| Code | Cas |
|---|---|
| 401 | token absent / invalide / expiré |
| 400 | `/analyze-path` : fichier introuvable |
| 404 | `job_id` inconnu ou job non terminé (`/search`) |

## Côté Core (orchestration — Enzo)
1. L'utilisateur est authentifié par le Core (`/auth/login` → JWT).
2. Le Core **relaie ce JWT** à l'Engine (`Authorization: Bearer`).
3. Le Core appelle `POST /analyze`, **polle** `/jobs/{id}`, puis renvoie le résultat à la View.
4. La View peut interroger `/search` (via le Core) pour la recherche dans la vidéo.

## Variables d'environnement
| Var | Défaut | Rôle |
|---|---|---|
| `JWT_SECRET` | `dev-secret-change-me` | **doit** matcher le Core |
| `ENGINE_REQUIRE_AUTH` | `true` | `false` = bypass auth (local) |
| `WHISPER_MODEL` | `base` | modèle de transcription |
| `LLM_GGUF` | `models/qwen2.5-1.5b-instruct-q4_k_m.gguf` | modèle LLM |
| `LLM_THREADS` | `4` | threads llama.cpp |

## Statut
✅ Implémenté et **validé** (tests `tests/test_api.py`, `test_contract.py`, `test_e2e.py` + `scripts/demo_api.py`).
