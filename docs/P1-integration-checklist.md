# P1 — Checklist d'intégration Bloc B (couture P1 ↔ P2 ↔ P3)

> Livrable F du `todo/PLAN-AMOS.md`. Points à vérifier avec les autres pôles pour la
> « couture » notée au Bloc B. Source technique : `docs/FRONTEND-INTEGRATION.md`
> (endpoints Core), `docs/ETAT-PROJET.md` (état d'intégration), `docs/P3A-metadata-schema.md`
> (contrat Engine). Interlocuteurs : **Enzo** (P2/Core), **Rabah** (P3/Engine).

## État de départ (audit `ETAT-PROJET.md`)
- **P2 ↔ P3** : ✅ fait. Orchestration Core → Engine réelle (service `engine` en Docker,
  JWT de service partagé, analyse par `contentId`).
- **P1 ↔ P3** : ⚠️ **à brancher**. Les métadonnées IA (transcription, chapitres,
  hotspots) ne sont pas encore affichées dans la View. C'est le principal reste-à-faire.

## 1. Lecture du flux chiffré (P1 ↔ P2)
| # | Point à vérifier | Réf | ☐ |
|---|---|---|---|
| 1.1 | La `source` de `VideoReview` peut être un flux HLS chiffré `/videos/:id/index.m3u8` (même origine) | FI §10.1 | ☐ |
| 1.2 | Lecteur `hls.js` avec `xhrSetup` : le token n'est joint QUE sur `/keys/...` | FI §2, §10.1 | ☐ |
| 1.3 | Scénario Zero-Trust : connecté = lit ; déconnecté/rechargé = clé refusée (401/403) | FI §2 | ☐ |
| 1.4 | Watermark de session incrusté (`GET /security/watermark`) | FI §3 | ☐ |
| 1.5 | Révocation de clé en direct (`/admin/contents/:id/revoke`) coupe la lecture | FI §5 | ☐ |
| 1.6 | Prérequis infra : nginx front proxifie `/videos/` → `core:3000`, `HLS_DIR` monté | FI §10.1 | ☐ |

## 2. Métadonnées IA (P1 ↔ P3, via le Core) — le gros du reste-à-faire
| # | Point à vérifier | Réf | ☐ |
|---|---|---|---|
| 2.1 | Le front raisonne **par `contentId`** (jamais `job_id`) | FI §11 | ☐ |
| 2.2 | Poll `GET /contents/:id/metadata` : 200 (prêt) / 202 (en cours) / 404 (non analysé) / 409 (erreur) | FI §11 | ☐ |
| 2.3 | `chapters[]` affichés en **marqueurs de timeline** (saut au timecode) | contrat P3-A | ☐ |
| 2.4 | `translations[lang].segments` affichés en **sous-titres** (dont RTL arabe) | contrat P3-A | ☐ |
| 2.5 | `summary` + `keywords` affichés sous le titre | contrat P3-A | ☐ |
| 2.6 | Recherche sémantique `POST /contents/:id/search` → liste de hits → saut au timecode | FI §11 | ☐ |
| 2.7 | Dégradation propre si l'Engine est absent (409 `{status:'error'}`) : pas de page cassée | FI §11 | ☐ |
| 2.8 | Contrat JSON calé avec Rabah = `docs/P3A-metadata-schema.md` (source de vérité) | — | ☐ |

## 3. Identité unique traversante
| # | Point à vérifier | Réf | ☐ |
|---|---|---|---|
| 3.1 | Un seul login (`alice`) traverse View → Core → Engine (même JWT) | FI §0, §11 | ☐ |
| 3.2 | Rôles/`companyId` respectés de bout en bout (mêmes droits que `/keys`) | FI §5, §11 | ☐ |
| 3.3 | Scénario « une identité, un flux » répété pour la démo | ETAT-PROJET | ☐ |

## 4. Tableau de suivi (à remplir par le PM)
| Action | Qui | Échéance | État |
|---|---|---|---|
| Brancher l'affichage metadata dans `VideoReview` (2.3–2.6) | Alex + Rabah | | ⬜ |
| Vérifier proxy nginx `/videos/` + `HLS_DIR` (1.6) | Enzo | | ⬜ |
| Répétition démo « une identité, un flux » (3.3) | Amos | | ⬜ |
| Confirmer profondeur P3-B rétention (hotspots) | Rabah | | ⬜ |

> FI = `docs/FRONTEND-INTEGRATION.md`. Cette checklist ne réimplémente rien : elle
> pointe l'existant (côté Core, déjà livré) et ce qui reste à câbler côté View.
