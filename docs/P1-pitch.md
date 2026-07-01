# P1 — Trame de soutenance (Poulpium)

> Livrable E du `todo/PLAN-AMOS.md`. Plan des slides + qui parle quand + timing.
> Sources : `docs/ETAT-PROJET.md` (état réel), `docs/PROJECT_MAP.md` (leads),
> `docs/P1-demo-scenario.md` (démo). Un deck existe déjà :
> `docs/presentations/P1-Frontend-Soutenance.html` (à aligner sur ce plan).

## Intervenants (leads, cf. PROJECT_MAP)
Alex (P1 · View), Enzo (P2 · Core/Zero-Trust), Rabah (P3 · Engine IA), Amos (PM · Bloc B, fil rouge).

## Format cible
~10 min de présentation + démo live. Viser **8-10 slides**. La démo est le cœur : ne
pas sur-parler avant.

## Déroulé slide par slide

| # | Slide | Contenu clé | Qui | Durée |
|---|---|---|---|---|
| 1 | **Titre / accroche** | « Poulpium — la revue vidéo collaborative, précise et souveraine » | Amos | 20 s |
| 2 | **Problème** | Retours par e-mail : imprécis, fastidieux, non traçables (« à 1:32… ») | Amos | 40 s |
| 3 | **Solution** | Retour ancré au **timecode** + annotation visuelle + collaboration temps réel + export réutilisable | Alex | 40 s |
| 4 | **DÉMO LIVE** ⭐ | Suivre `P1-demo-scenario.md` : annoter en direct → sync multi-fenêtres → saut au timecode → Watch Together → export/import | Alex | 3-4 min |
| 5 | **Architecture** | Schéma **View / Core / Engine** ; **une seule identité (JWT)** traverse les 3 pôles | Amos | 40 s |
| 6 | **P2 — Diffusion Zero-Trust** | HLS chiffré AES-128, clé servie sous token (jamais par le CDN), watermark, anti-scraping, dashboard | Enzo | 60 s |
| 7 | **P3 — IA & Data** | Transcription, chapitres, mots-clés, recherche sémantique, **sous-titres multilingues** (local, CPU, sans clé payante) | Rabah | 60 s |
| 8 | **Bloc B — la couture** | Une identité → flux chiffré P2 → métadonnées P3 affichées dans la View. Orchestration Core→Engine réelle | Amos | 40 s |
| 9 | **Limites assumées** | (voir ci-dessous) — honnêteté = crédibilité | Amos | 30 s |
| 10 | **Next steps / clôture** | Data 3B (rétention), affichage complet des hotspots, durcissements sécurité | Amos | 20 s |

## Le moment démo (à répéter)
Deux instants « whaou » (cf. `P1-demo-scenario.md`) :
1. **Synchronisation en direct** entre fenêtres (étape 3 du scénario).
2. **Round-trip export → réimport** fidèle (étape 8).
Prévoir un **plan B** si le réseau/LAN flanche : rester en mode multi-fenêtres
(`broadcast`, 100 % offline).

## Ce qui est réellement livré (à afficher sans surjouer)
- **P1** : dessin/commentaire au timecode, temps réel (multi-fenêtres + LAN socket.io),
  Watch Together, export/import, invités, upload.
- **P2** : Zero-Trust HLS, multi-tenant 3 niveaux, refresh tokens, Capture Guard, dashboard.
- **P3** : pipeline 3A (transcription → résumé/chapitres → mots-clés → recherche →
  traduction NLLB), testé ; sous-titres en cours de branchement dans la View.

## Limites assumées (à dire, pas à cacher)
- **Anti-capture** : heuristique web + watermark + occultation, **pas de DRM matériel**
  (non auto-hébergeable). Choix conscient.
- **LAN multi-machines** : implémenté (socket.io) mais dépend d'un réseau fiable le jour J.
- **P3-B (rétention)** : **bonus non livré** (dashboard = placeholder). À présenter comme
  perspective, pas comme fait.
- **Mono-session** : « dernier login gagne » avec reconnexion sans identifiants (arbitrage
  UX/sécurité documenté).

## Message de clôture
« Une plateforme de revue vidéo **précise, collaborative et souveraine** : la valeur P1
(collaboration) rendue **sûre** par P2 (Zero-Trust) et **intelligente** par P3 (IA locale),
le tout **100 % auto-hébergeable**. »
