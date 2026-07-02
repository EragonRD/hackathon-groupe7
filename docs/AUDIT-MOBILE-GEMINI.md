# Audit — travail de Gemini (app mobile RN) · branche `feat/mobile-app`

Date : 2026-07-01 · Commit : `0866f49 feat(mobile): add React Native Expo mobile app`
Périmètre : `mobile/` (68 fichiers). Audit pointilleux vs `docs/GEMINI-BRIEF-MOBILE.md`.

## Verdict

Bon **squelette** : `theme.js` fidèle aux tokens, portage propre de `auth.js` /
`useReview.js` / `collab.js` / `format.js`, écrans Login/Catalogue/Revue câblés.
**Mais non livrable en l'état** : le **template Expo par défaut n'a pas été nettoyé**
(casse le lint, double `app/`, double thème), l'**annotation est décâblée** (le dessin
ne fait rien), et le **point critique HLS+clé n'est pas validé**. Fonctionnalités du
brief partiellement présentes.

## 🔴 Bloquants

| # | Fichier | Problème |
|---|---|---|
| B1 | `mobile/app/` **et** `mobile/src/app/` | **Deux racines de routes** expo-router. `app/` (racine) gagne → tout `src/app/*` (tabs du template : `explore.tsx`, `index.tsx`, `_layout.tsx`) est **mort**, mais reste versionné, ambigu, et avec `typedRoutes:true`+`reactCompiler:true` c'est un piège. |
| B2 | `src/hooks/use-color-scheme.web.ts:11` | **Erreur lint** (`react-hooks/set-state-in-effect`) = fichier du **template jamais utilisé**. Le livrable ne passe pas `expo lint`. |
| B3 | `app/review/[session].js:118-126` | **Annotation décâblée** : `<DrawingLayer shapes={[]} onAddShape={()=>{}} onClear={()=>{}} />`. On ne dessine rien, rien n'est stocké dans les notes ni diffusé. La fonctionnalité centrale du produit est **non fonctionnelle**. |
| B4 | `src/components/SecureVideo.js:17` | **HLS chiffré non validé** (= risque n°1 du brief). URL `${API}/videos/${id}/index.m3u8` : côté web c'est un proxy Vite ; le Core expose `GET /stream/:id/index.m3u8` (pas `/videos`). **Chemin probablement faux**. De plus `headers:{Authorization}` sur `react-native-video` n'est **pas garanti** de s'appliquer à la requête de **clé AES** (ExoPlayer) : à prouver, pas juste écrire. |

## 🟠 Élevés

| # | Fichier | Problème |
|---|---|---|
| E1 | `src/components/DrawingLayer.js` | **Un seul outil** (`pen`) sur les 7 requis (arrow/rect/ellipse/text/eraser absents). Aucun sélecteur d'outil dans l'UI (`tool` reste `'pen'`). |
| E2 | `DrawingLayer.js:11-24,47` | **Mapping de coordonnées faux** : `e.x/e.y` sont **relatifs au Canvas**, divisés par `Dimensions.get('window')` (écran entier) → normalisation incohérente, et rendu re-mappé sur `window` alors que le canvas est dans `playerContainer` (plus petit). Les dessins ne tomberont pas au bon endroit, ni entre appareils (viole le contrat 0..1). Devrait utiliser `onLayout` de la vue vidéo. |
| E3 | `app/review/[session].js` | **Temps réel de revue incomplet** : `sendCursor` jamais appelé (pas de curseurs distants), Watch Together à moitié câblé (réception OK, mais pas de `claimPresenter`, pas de verrouillage des contrôles invités, `presenterId`/`isPresenter` inutilisés). |
| E4 | `mobile/` | **Résidus du template** versionnés : `src/constants/theme.ts` (2e source de thème), `global.css`, `components/{animated-icon,app-tabs,themed-text,themed-view,web-badge,external-link,hint-row,ui/collapsible}`, `hooks/use-color-scheme*`, assets tutoriel, `LICENSE`. Bruit + incohérence (deux thèmes). |
| E5 | `mobile/{CLAUDE.md,AGENTS.md,.claude/settings.json}` | **Scaffolding d'agent commité** dans le livrable produit. À retirer. |

## 🟡 Moyens

| # | Emplacement | Problème |
|---|---|---|
| M1 | `app/index.js:23-28,40-45` | `mustChangePassword` **non géré** (TODO) : redirige vers catalogue quoi qu'il arrive → un admin invité contournerait l'écran de changement (le Core bloquera /admin en 403, mais l'UX est cassée). |
| M2 | Export / Import JSON | **Absent** (brief requis : `{version,session,notes[]}` + `expo-document-picker` en deps mais inutilisé). |
| M3 | `app/index.js:15,18` | `reduceMotion` lu mais **jamais utilisé** (règle reduce-motion non appliquée ; ceci dit quasi aucune animation présente). |
| M4 | Marque | Logo = **emoji 🐙** (`app/index.js:67`) au lieu du `PoulpiumMark` SVG (yeux qui suivent). Registre visuel affaibli. |
| M5 | Auth | `me()` rappelé indépendamment sur chaque écran (index/catalogue/review) → 3 appels réseau, pas de contexte d'auth partagé. |
| M6 | `app/catalogue.js:74-78` | Boutons **Admin/Surv** = simple texte non cliquable (pas d'écrans admin/dashboard/docs ; le brief les tolère « simplifiés » mais ici ils sont inertes). |

## 🟢 Faibles (lint : 20 warnings)

- Imports inutilisés : `SecureVideo`(`View`), `DrawingLayer`(`Circle`,`Rect`), `collab`(`PREFIX`).
- `auth.js:73` `==` au lieu de `===` ; `catch(e)` non utilisés (auth, useReview).
- `useReview.js:210` `react-hooks/exhaustive-deps` (dépendance `self`) — connu et volontaire côté web, à annoter.

## ✅ Points forts (à conserver)

- `src/theme.js` : **transcription fidèle** de `tokens.css` (hex exacts, radius, space, ink, ombres iOS/Android). Bonne base.
- Portage correct de `auth.js` (SecureStore, polyfill `atob`, refresh-token + retry 401, `DeviceEventEmitter('auth:expired')`), `useReview.js` (AsyncStorage + AppState), `collab.js` (socket only), `format.js`.
- `app/_layout.js` : chargement police **JetBrains Mono** + splash + fond `theme.bg`.
- Timecodes en `globalStyles.textMono` (mono) sur timeline/commentaires. Palette de 6 couleurs de dessin issue de `theme.ink`. Présence (avatars empilés, point live) présente.
- Contrats respectés : notes triées par temps, marqueurs timeline cliquables (seek), mode `socket`.

## Recommandation (ordre)

1. **Nettoyer le template** : supprimer `src/app/`, `src/constants/theme.ts`, `global.css`,
   composants/hooks/asset du template, `LICENSE`, `CLAUDE.md`/`AGENTS.md`/`.claude` → `expo lint` vert. (B1,B2,E4,E5)
2. **POC HLS chiffré** : corriger l'URL (`/stream/...` ou proxy) et **prouver** que la clé
   AES part avec le `Authorization` (sinon proxy de clé local). (B4)
3. **Recâbler l'annotation** : `DrawingLayer` reçoit/émet les shapes des notes ; corriger
   le mapping 0..1 via `onLayout` de la vidéo ; ajouter les 7 outils + sélecteur. (B3,E1,E2)
4. **Compléter le temps réel** : curseurs (`sendCursor`), Watch Together (claim + verrou invités). (E3)
5. Export/Import JSON, `mustChangePassword`, PoulpiumMark, warnings lint. (M1,M2,M4,F*)

> ⚠️ Ce fichier a été ajouté au working tree ; le finaliseur automatique de surveillance
> l'inclura dans le prochain commit/push si laissé en place.
