# PROJECT_MAP — Groupe 7 (Hackathon ESTIAM)

## Vue d'ensemble
Plateforme vidéo unique. Architecture **View / Core / Engine**. 3 pôles imbriqués (Bloc B = intégration).

## Arborescence
| Chemin | Rôle | Stack |
|---|---|---|
| `frontend/` | View — UI utilisateur | React + Vite |
| `backend/` | Core — API & règles métier | NestJS |
| `engine/` | Engine — traitements lourds (**à créer**) | Python |
| `data/` | Logs de visionnage P3-B + corrigés + `DATA_SCHEMA.md` | CSV |
| `docs/` | Schéma P3-A, env Python, plans, carte projet | Markdown |
| `media/` | Vidéo d'exemple libre de droits | MP4 |
| `scripts/` | Prefetch + récupération vidéo | Bash/PowerShell |

## Frontend (`frontend/src/`)
| Fichier | Rôle |
|---|---|
| `main.jsx` | Point d'entrée React |
| `App.jsx` | Composant racine |
| `Login.jsx` | Démo d'authentification |
| `auth.js` | login / token / `authFetch` |
| `index.css`, `App.css` | Styles |

## Backend (`backend/src/`)
| Fichier | Rôle |
|---|---|
| `main.ts` | Bootstrap NestJS |
| `app.module.ts` | Module racine |
| `app.controller.ts` / `app.service.ts` | Endpoint exemple |
| `auth/auth.module.ts` | Module auth |
| `auth/auth.controller.ts` | `POST /auth/login`, `GET /auth/me` |
| `auth/auth.service.ts` | Logique JWT |
| `auth/auth.guard.ts` | Guard routes protégées |
| `auth/users.service.ts` | Comptes démo (Argon2) |

## Auth fournie (Core)
- `POST /auth/login` `{username,password}` → JWT court + profil.
- `GET /auth/me` → route protégée, renvoie `req.user`.
- Comptes : `alice` (admin), `bob`, `carol` — mdp `password`.

## Données (`data/`)
| Fichier | Contenu |
|---|---|
| `viewing_logs.csv` | Logs de visionnage (P3-B) |
| `videos.csv` | Métadonnées vidéos |
| `ground_truth_hotspots.csv` | Corrigé zones d'ennui (⚠️ évaluation seule) |
| `DATA_SCHEMA.md` | Schéma colonnes + définition cible |

## Docs (`docs/`)
| Fichier | Contenu |
|---|---|
| `P3A-metadata-schema.md` | Contrat JSON sortie P3-A |
| `python-env.md` | Mise en place env Python |
| `PROJECT_MAP.md` | Ce fichier |
| `done/` | Travail **livré** (mono-session, upload chunké, plan Matthieu = annotation/UX en code) |
| `todo/` | Plans/audits avec **travail restant** (engine P3, P2-taches, audit IA, plan Amos = docs P1, tests) |

## Démarrage
| Appli | Commande |
|---|---|
| Frontend | `cd frontend && npm install && npm run dev` |
| Backend | `cd backend && npm install && npm run start:dev` |

## Sujets retenus (source : `REPARTITION.md`)
| Pôle | Sujet | Lead (WMD) | Statut |
|---|---|---|---|
| 1 — Application & Collaboration | **1A** Lecteur de Revue augmenté | Alex | ✅ retenu |
| 2 — Infra, Sécurité & Cloud | **2A** Diffusion Zero-Trust | Enzo | ✅ retenu |
| 3 — IA & Data | **3A** Indexation sémantique (principal) + **3B** Rétention (bonus) | Rabah | ✅ retenu |

## Équipe Pôle 3 — Engine (lead : Rabah)
| Squad | Membres | Sortie |
|---|---|---|
| NLP (3A) | Rabah (API), Duval (Whisper/ffmpeg), Antoine (résumé/chapitres/mots-clés), Izlene (recherche sémantique) | JSON `docs/P3A-metadata-schema.md` |
| Data (3B) | Otman (détection rétention), Amina (modèle scikit-learn), Faycal (dashboard Streamlit/BI), Hassane (business/doc) | Dashboard + modèle documenté |

## Engine — état (microservice P3, opérationnel)
| Brique | État |
|---|---|
| API FastAPI (`/health /analyze /jobs /search`) + auth JWT + jobs async | ✅ testé E2E (11 tests) |
| Pipeline : ffmpeg → Whisper → llama.cpp (résumé/chapitres) → KeyBERT → MiniLM | ✅ |
| **Traduction multilingue + sous-titres** (NLLB-200, fr/en/es/ar extensible) | ✅ |
| Sortie | JSON contrat P3-A + `translations[]` |
| Docs | `engine/README.md`, `engine/docs/{architecture,api-contract,model-selection,api-vs-microservice}.md` |

## Décisions structurantes
- Architecture View/Core/Engine ; auth JWT partagée P1/P2 (figée J1).
- Engine = microservice Python/FastAPI, appelé par le Core (orchestration), JWT HS256 partagé.
- Modèles locaux CPU : Whisper base · Qwen2.5-1.5B (llama.cpp) · MiniLM · **NLLB-200** (traduction).
- Bloc B piloté par Amos (PM). Contrats d'interface (JWT, JSON Engine, endpoints Core) figés J1.
- ⚠️ P3-B : corrigés `data/` = évaluation seule, jamais en feature (fuite de cible).
