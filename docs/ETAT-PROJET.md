# État global du projet — Groupe 7 (Hackathon ESTIAM)

> MàJ : 2026-07-01 · Branche de référence : `master` (= `origin/master`, `e7359d4`)
> Vue transverse des 3 pôles. Détail P3 : voir `docs/context-state.md`.

## Vue d'ensemble

Plateforme vidéo **Poulpium** — architecture **View / Core / Engine**. Les 3 sujets
retenus (un par pôle) sont **tous livrés et sur `master`**.

| Pôle | Sujet retenu | Statut | Sur master |
|---|---|---|---|
| 1 — View (React) | 1A · Lecteur de Revue augmenté | ✅ livré | ✅ |
| 2 — Core (NestJS) | 2A · Diffusion Zero-Trust | ✅ livré | ✅ |
| 3 — Engine (Python) | 3A · Indexation sémantique (+3B rétention bonus) | ✅ 3A / ⚠️ 3B à confirmer | ✅ |

## Intégration des branches (audit git)

| Branche | Absent de master | État |
|---|---|---|
| `feat/intelligence-artificielle-data` (P3) | 0 | ✅ **fusionnée** |
| `feat/refonte-ui-revue` (P1) | 1 | ⚠️ quasi fusionnée — 1 commit récent à réconcilier |
| `feat/refonte-ui-revue-matthieu` | 0 | ✅ fusionnée |
| `feat/mobile-app` | 3 | ❌ **non fusionnée** (app mobile — cf. piste Capacitor) |

## Détail par pôle

### P1 — Lecteur de Revue augmenté (View)
Dessin + commentaire au timecode en temps réel, Watch Together, curseurs distants,
export/import JSON, catalogue + upload local, **invités temporaires** (lien
partageable, entrée sans login), **upload par invité**, suppression de contenu (admin).

### P2 — Diffusion Zero-Trust (Core) — notre pôle
| Brique | État |
|---|---|
| HLS AES-128 + `/keys/:id` gardé par token JWT | ✅ |
| Anti-scraping (SecurityMiddleware, fenêtre glissante, bans IP persistés) | ✅ |
| Multi-tenant 3 niveaux (superadmin / admin / user), ACL dynamique | ✅ |
| Invitations + mot de passe temporaire 24h + email Mailjet | ✅ |
| Upload vidéo → chiffrement ffmpeg async (file d'attente, max concurrent) | ✅ |
| Orchestration Core → Engine (analyse IA par `contentId`) | ✅ |
| Refresh tokens (rotation) + double protection anti-bruteforce | ✅ |
| **Capture Guard** (détection heuristique + watermark + occultation) | ✅ |
| Persistance sur **volumes Docker nommés** | ✅ |
| Dashboard de surveillance (alertes temps réel) | ✅ |
| Qualité : 2 rounds de code-review (16 findings corrigés), 37/37 tests | ✅ |

### P3 — Engine IA & Data (Python/FastAPI)
- **3A** ✅ opérationnel : API `/health /analyze /jobs /search`, pipeline
  ffmpeg → Whisper → llama.cpp (résumé/chapitres) → KeyBERT → MiniLM, +
  traduction/sous-titres multilingues NLLB-200. 11 tests. Contrat `docs/P3A-metadata-schema.md`.
- **3B** (rétention, bonus) : squad Data assignée — **profondeur à confirmer**
  (⚠️ corrigés `data/` = évaluation seule, jamais en feature).

### Bloc B — Intégration
- **P2 ↔ P3** ✅ : orchestration Core→Engine réelle (service `engine` dans
  `docker-compose`, JWT de service partagé HS256, analyse par `contentId`).
- **P1 ↔ P3** ⚠️ : affichage front des métadonnées IA (transcription cliquable,
  hotspots de rétention) — prévu, **à brancher** (cf. `frontend/REFONTE-UI.md` #6).

## Tâches en attente / risques

| # | Sujet | Priorité |
|---|---|---|
| 1 | `feat/mobile-app` non fusionnée (3 commits) — décider intégration | Moyenne |
| 2 | `feat/refonte-ui-revue` : 1 commit récent à réconcilier | Basse |
| 3 | P3-B rétention : confirmer la profondeur livrée | Moyenne |
| 4 | Bloc B P1↔P3 : afficher transcription + hotspots dans la View | Moyenne |
| 5 | Piste « écran noir » : décidée en heuristique web (Capture Guard) ; option native = Electron/Capacitor (hors périmètre local strict) | Info |

## Prérequis démo (100 % local)

- `frontend/public/sample.mp4` déposé sur chaque poste (gitignoré).
- `JWT_SECRET` fort exporté ; clés Mailjet en `.env` (sinon simulation log).
- Amorçage du volume `poulpium_media` avec la démo HLS (commande de migration
  fournie lors du passage aux volumes nommés).
- `docker compose up` (services : core, frontend, hls, engine).

## Décisions structurantes

- Architecture View/Core/Engine ; JWT HS256 partagé P1/P2/P3 (figé J1).
- Engine = microservice FastAPI appelé par le Core (orchestration).
- Modèles locaux CPU uniquement (aucune clé API payante).
- Protection capture : heuristique web assumée (pas de DRM matériel — non
  auto-hébergeable) + watermark de traçabilité + occultation sur perte de focus.
- Persistance = volumes Docker nommés (hors dépôt).
