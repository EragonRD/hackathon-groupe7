# Feature — Bouton « Relancer le chiffrement » (upload en échec)

## Contexte

Quand le chiffrement HLS d'une vidéo échoue (ffmpeg : OOM, CPU, source
partiellement corrompue…), le contenu passe en statut `failed` et devient
inutilisable, sans moyen de réessayer sans ré-uploader.

## Constat bloquant

La source claire était **supprimée après l'upload dans tous les cas** (le
`finally { rm(clearPath) }` s'exécutait aussi en cas d'échec). Sans source, une
relance est impossible.

## Décisions

- **Conserver la source UNIQUEMENT en cas d'échec** : `finalizeUpload` déplace la
  source claire vers un dossier `media/pending/` (NON servi par nginx) au lieu de
  la supprimer. En cas de succès, suppression normale.
- **Pipeline post-upload unifié** : `UploadService.finalizeUpload(id, path, name)`
  remplace les 4 blocs dupliqués (upload direct, chunké, invité ×2) — chiffrement
  + (analyse IA & suppression si succès / conservation si échec). `UploadService`
  injecte `AnalysisService` (EngineModule l'exporte ; pas de cycle).
- **Relance** : `POST /admin/contents/:id/reencrypt` (membre autorisé) → re-chiffre
  depuis la source conservée ; succès = analyse + suppression source ; échec =
  reste `failed`, source gardée pour un nouvel essai. 400 si source indisponible.
- **UI** : carte `failed` du catalogue transformée en carte NON cliquable portant
  un bouton **« Relancer le chiffrement »** (imbriquer un bouton dans un bouton
  serait invalide). Après relance, le catalogue se resynchronise et poll jusqu'à
  résolution.

## Risques

| Risque | Mitigation |
|---|---|
| Source claire persistée = surface d'exposition | Dossier hors zone servie (pas sous `/hls`) ; supprimée dès succès |
| Docker : `media/pending` hors volume -> éphémère | Relance OK dans la session ; après redémarrage conteneur, message « ré-uploadez » |
| Échec ancien / crash : pas de source | Endpoint renvoie 400 explicite |

## Plan d'action

- [✅] `UploadService.finalizeUpload` + `retainSource` + `pendingSourcePath` + `reencrypt`
- [✅] Brancher les 4 sites d'upload sur `finalizeUpload` ; retrait de `encryptInBackground` (mort)
- [✅] `POST /admin/contents/:id/reencrypt`
- [✅] `contents.js#requestReencrypt` + carte `failed` actionnable dans `Catalogue`
- [✅] Vérif E2E : faux mp4 -> `failed` -> source conservée (`media/pending/<id>.mp4`)
      -> `reencrypt` renvoie `processing` ; `build` back + `lint`/`build` front

## Avancement

Livré et vérifié localement (échec forcé via faux fichier). La conservation de la
source et la relance fonctionnent de bout en bout.

## Résumé non-technique

Si la préparation (chiffrement) d'une vidéo échoue, sa vignette affiche désormais
un bouton « Relancer le chiffrement ». Le serveur garde temporairement la vidéo
d'origine juste pour ça et réessaie en un clic, sans avoir à la renvoyer.
