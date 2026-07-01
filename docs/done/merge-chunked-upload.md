# Merge + durcissement — Upload chunké (Cloudflare)

## Contexte
Branche `origin/feature/chunked-upload-cloudflare` (1 commit : `d8673d2`) ajoute
l'upload par morceaux (chunks de 10 Mo) pour contourner la limite de taille de
requête Cloudflare. Concerne `/admin/contents/upload-chunk` (admin/superadmin) et
`/contents/guest-upload-chunk` (invité), + client `admin.js` / `contents.js`.

Merge base : `a0ba7f5`. Master local est 7 commits devant origin/master ; aucun de
ces commits ne touche les fichiers de la branche -> **merge sans conflit**.

## Objectif
1. Merger la branche dans `master` (local).
2. Corriger les défauts relevés en revue avant intégration.

## Constats (revue, par gravité)
| # | Fichier | Défaut |
|---|---|---|
| 1 | upload/*.controller.ts | `MAX_SIZE` (1 Go) appliqué PAR CHUNK -> taille totale non bornée (DoS/disque) |
| 2 | guest-upload.controller.ts | `file.path` déréférencé avant le null-check `if (!file)` -> 500 |
| 3 | upload.service.ts | Uploads abandonnés -> dossiers de chunks orphelins jamais nettoyés |
| 4 | upload.controller.ts | Validation `companyId` (superadmin) APRÈS fusion complète -> upload gaspillé + fichier fusionné fuité |
| 5 | upload.service.ts | `uploadId` non lié à l'utilisateur -> injection de chunks dans un upload tiers |
| 6 | upload.service.ts | `writeStream` non fermé si un readStream échoue pendant la fusion -> fuite fd + fichier partiel |

## Décisions
- **#1** : plafond total = `MAX_UPLOAD_BYTES` (1 Go). Vérif cumulative de la somme des
  tailles des `.part` à chaque chunk (borne le disque à MAX + 1 chunk) + garde-fou
  `totalChunks`/`chunkIndex`.
- **#2** : déplacer `if (!file)` en tête, avant tout accès à `file`.
- **#3** : GC des dossiers de chunks périmés (mtime) au démarrage + intervalle.
- **#4** : résoudre/valider `companyId` AVANT `handleChunk` (échoue au 1er chunk).
- **#5** : isoler le dossier de chunks par utilisateur (`chunks/<owner>/<uploadId>`).
- **#6** : `try/catch` autour de la fusion -> `writeStream.destroy()` + suppression
  du fichier partiel et du dossier sur erreur.

## Risques
- Client existant : le contrat HTTP (champs `chunkIndex/totalChunks/uploadId`) reste
  inchangé -> pas de casse. Le plafond total peut rejeter un très gros fichier
  légitime : 1 Go = même valeur que l'ancien `/upload`, donc iso-comportement.

## Plan d'action
- [x] Merge `origin/feature/chunked-upload-cloudflare` -> master (no-ff, commit merge)
- [x] Fix #2 (ordre null-check guest)
- [x] Fix #4 (validation companyId en amont, échec au 1er chunk)
- [x] Fix #5 (isolation `chunks/<owner>/<uploadId>`) + #1 (plafond `MAX_UPLOAD_BYTES` cumulatif + bornes `totalChunks`/`chunkIndex`) + #6 (fusion `try/catch` -> destroy + nettoyage) dans `handleChunk`
- [x] Fix #3 (`sweepStaleChunks` : GC au démarrage + intervalle horaire, TTL 6 h)
- [x] Build back OK (`nest build`), 40/40 tests jest verts, eslint 0 erreur (28 warnings préexistants)
- [ ] Commit des correctifs
- [ ] Push (en attente de validation explicite)

## Avancement
- Merge fait (sans conflit : les 7 commits locaux ne touchaient aucun fichier de la branche).
- 6 correctifs appliqués côté backend (`upload.service.ts`, `upload.controller.ts`,
  `guest-upload.controller.ts`). Contrat HTTP inchangé -> aucun changement client requis.
- CRLF signalé par eslint = artefact `core.autocrlf=true` (working tree) ; le dépôt
  stocke bien du LF (`git ls-files --eol` -> `i/lf`). Normalisé en LF via `--fix`.
- Build + tests + lint OK.

## Résumé non-technique
On intègre la fonction « envoi de grosses vidéos en plusieurs morceaux » et on
bouche au passage 6 trous : une faille qui laissait envoyer des fichiers sans
limite de taille, un plantage possible du serveur, du ménage disque non fait, et
quelques cas où un envoi pouvait être gaspillé ou perturbé.
