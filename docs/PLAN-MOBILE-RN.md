# Plan — Application mobile Poulpium (React Native)

> Portage mobile de la View (Pôle 1) en **React Native**, en **conservant les
> règles verrouillées du frontend web** (design system, contrats, architecture
> temps réel). On ne réécrit pas la logique : on réutilise le JS pur existant.

## 1. Objectif

App mobile (Android en priorité, iOS possible) qui rejoint une session de revue
vidéo collaborative : lecture vidéo chiffrée, annotations au timecode, commentaires,
présence temps réel. Même Core NestJS, mêmes contrats.

## 2. Règles frontend à respecter (report 1:1)

| Règle verrouillée (web) | Traduction React Native |
|---|---|
| Thème **sombre uniquement** | `theme.js` = objet dérivé de `tokens.css` (mêmes hex). Pas de mode clair. |
| **Un seul accent** (bleu `#3d6dfd`) | Constante unique `theme.accent`. Interdit d'introduire d'autres couleurs UI (les couleurs d'annotation restent une donnée, pas de l'UI). |
| Timecodes **mono + tabular-nums** | `fontVariant: ['tabular-nums']` + police mono embarquée (SFMono indispo → **JetBrains Mono** via `expo-font`). |
| **Zéro em-dash** dans l'UI | Règle lint conservée (voir §7). |
| Animations derrière `prefers-reduced-motion` | RN : `AccessibilityInfo.isReduceMotionEnabled()` → gate les animations `Reanimated`. |
| CSS natif + variables (pas de Tailwind) | `StyleSheet` + objet `theme` (pas de lib UI lourde type NativeBase). |
| Icônes **Phosphor uniquement** | `phosphor-react-native` (même famille que `@phosphor-icons/react`). |
| Rayons/espacement (échelle `--s-*`, `--r-*`) | Reportés dans `theme.space` / `theme.radius`. |

Livrable clé de cette étape : **`src/theme.js`** = transcription fidèle de
`frontend/src/styles/tokens.css` (source de vérité du langage visuel).

## 3. Ce qui se réutilise (JS pur → portable quasi tel quel)

| Fichier web | Statut portage | Adaptation |
|---|---|---|
| `lib/format.js` | ✅ tel quel | aucune (helpers purs). |
| `auth.js` | ⚠️ léger | remplacer `localStorage` → `expo-secure-store` ; `window.dispatchEvent('auth:expired')` → émetteur d'événements RN (ou callback). `fetch` OK. |
| `lib/collab.js` | ⚠️ adapter socket only | **BroadcastChannel n'existe pas** en RN → garder **uniquement l'adapter `socket.io`** (déjà écrit) ; `import.meta.env` → `expo-constants` / `process.env`. |
| `lib/useReview.js` | ✅ logique réutilisable | hook React standard ; ne touche pas au DOM → portable. Vérifier qu'il ne lit pas `window`. |
| `data/videos.js` | ✅ | données. |

## 4. Ce qui doit être réécrit (web-only → équivalent natif)

| Brique web | Techno web | Équivalent React Native |
|---|---|---|
| Lecteur vidéo HLS chiffré (`SecureVideo` + `hls.js`) | `hls.js` + `xhrSetup` (header `Authorization` sur `/keys/`) | **`react-native-video`** (ExoPlayer/AVPlayer, HLS natif) avec `source.headers` OU proxy de clé. ⚠️ point technique n°1 (voir §6). |
| Calque de dessin (`DrawingCanvas`, coords 0..1) | `<canvas>` | **`@shopify/react-native-skia`** (perf) ou `react-native-svg`. Coordonnées **normalisées 0..1** conservées → mapping identique. |
| Compositeur / listes (`CommentPanel`) | DOM + CSS | `FlatList` + `TextInput`. Tri par temps identique. |
| `AppShell`, `Catalogue`, `Login` | DOM/CSS | Composants RN (`View`/`Pressable`/`Text`), styles depuis `theme`. |
| Raccourcis clavier (`⌘/Ctrl+↵`, J/K/L) | events clavier | non pertinents en tactile → gestes (double-tap seek, etc.). |
| Import/export JSON (fichier) | `<input type=file>` / download | `expo-document-picker` / `expo-file-system` + partage. Même format `{version,session,notes[]}`. |

## 5. Stack cible

- **Expo (managed) + expo-router** — build Android/iOS sans Xcode/Android Studio lourds, OTA, `expo-secure-store`, `expo-font`, `expo-video`/`react-native-video`.
- **React 19 / React Native 0.7x**, JS (pas TS obligatoire, cohérent avec le web JS).
- Libs : `socket.io-client`, `react-native-video`, `@shopify/react-native-skia`, `phosphor-react-native`, `react-native-reanimated`, `expo-secure-store`, `expo-font`.

Arbo proposée :
```
mobile/
  app/            (expo-router : login, catalogue, review/[session])
  src/
    theme.js      (⟵ tokens.css)
    lib/          (format.js, collab.js[socket], useReview.js  ⟵ réutilisés)
    auth.js       (⟵ adapté SecureStore)
    components/   (VideoPlayer, DrawingLayer, CommentList, AppShell...)
```

## 6. Points techniques à valider tôt (risques)

1. **HLS AES + header `Authorization` sur la requête de clé.**
   `react-native-video` permet des `headers` globaux sur la source, mais ils
   s'appliquent à **toutes** les requêtes (playlist, segments, clé) — acceptable
   ici (le Core ignore le header sur nginx). Si insuffisant : petit **proxy de clé**
   local, ou lecteur custom. ➜ **POC à faire en premier.**
2. **Dessin fluide** : Skia recommandé (60 fps au trait) vs SVG (plus simple mais
   lourd si beaucoup de points). Garder les coords normalisées → compat web/mobile.
3. **Temps réel** : uniquement `socket.io` (pas de BroadcastChannel). Nécessite le
   Core lancé + `VITE_COLLAB_MODE=socket` équivalent (`EXPO_PUBLIC_COLLAB_MODE`).
4. **Fuseau des timecodes / tabular-nums** : embarquer une police mono (SFMono absent).

## 7. Qualité / conventions (report du web)

- Lint : ESLint + Prettier, **LF**, règle « zéro em-dash », `react-hooks`.
- Tests : Vitest → **Jest + @testing-library/react-native** (les tests de `format.js`
  et `collab.js` se portent presque tels quels).
- Registre **B2B pro**, marque « Poulpium », thème sombre verrouillé.

## 8. Plan d'exécution (checklist)

- [ ] P0 — `mobile/` Expo + `theme.js` (⟵ tokens.css) + police mono + navigation.
- [ ] P0 — **POC lecteur HLS chiffré** (header clé) sur le contenu `poc`. *(risque n°1)*
- [ ] P1 — `auth.js` (SecureStore) + écran Login câblé sur `POST /auth/login`.
- [ ] P1 — Catalogue + ouverture d'une session.
- [ ] P1 — Réutiliser `useReview.js` + `collab.js` (socket) : présence + notes.
- [ ] P2 — `DrawingLayer` (Skia, coords 0..1) rattaché au timecode.
- [ ] P2 — `CommentList` (FlatList, tri par temps, saut à l'instant, réponses).
- [ ] P3 — Import/Export JSON (même contrat), états chargement/erreur/vide.
- [ ] P3 — Accessibilité (reduce motion, contraste AA), Watch Together (optionnel).

## 9. Résumé non technique

On refait l'app Poulpium pour téléphone en réutilisant au maximum le code déjà
écrit pour le web (connexion, temps réel, formats). Le look reste identique
(sombre, un seul bleu, chiffres alignés). Les seules vraies réécritures : le
lecteur vidéo et l'outil de dessin, car le web et le mobile ne les gèrent pas
pareil. Le premier vrai risque à tester tout de suite = la lecture de la vidéo
chiffrée sur mobile.
