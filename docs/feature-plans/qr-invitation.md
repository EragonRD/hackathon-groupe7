# Feature — QR code pour les liens d'invitation (Pôle 1)

## Contexte

`InviteGuestModal.jsx` génère un lien d'invité temporaire (`/?guest=<token>`)
copiable. Un invité rejoint la revue sans compte jusqu'à expiration.

## Objectif

Afficher un **QR code** du lien pour rejoindre depuis un téléphone (scan), avec
téléchargement PNG (slide/impression).

## Constats

- Un seul point de génération de lien partageable : `InviteGuestModal.jsx`
  (`GuestUploadModal` = l'invité qui téléverse, pas de lien à partager).
- Règle projet verrouillée : **zéro dépendance réseau** (offline) → interdit
  d'utiliser une API QR externe (ex. api.qrserver.com). Génération 100 % locale.
- Icônes : `@phosphor-icons/react` uniquement.

## Décisions

- Dépendance `qrcode.react@^4` : rendu **local** (canvas), aucun appel réseau au
  runtime → respecte l'offline. 1 seul paquet ajouté, pas de dépendance
  transitive. Compatible React 19.
- `QRCodeCanvas` (et non SVG) : `canvas.toDataURL('image/png')` rend le
  téléchargement PNG trivial, sans réseau.
- **Tuile blanche** autour du QR : un QR doit rester sombre-sur-clair pour un
  scan fiable → exception assumée au thème sombre (comme la palette d'annotation).
- Couleurs QR concrètes (`#0a0c0f` sur `#ffffff`) pour le contraste de scan.

## Risques

| Risque | Mitigation |
|---|---|
| Token JWT long → QR dense | Niveau `M` + quiet zone (`marginSize=2`) ; testé sur URL ~270 car. |
| Contraste insuffisant (thème sombre) | Tuile blanche dédiée, non teintée |
| Warning EBADENGINE à l'install | Bénin ; build Vite + rendu OK (Node 20/22) |

## Plan d'action

- [✅] `npm install qrcode.react@^4`
- [✅] `InviteGuestModal.jsx` : `QRCodeCanvas` + bouton « Télécharger le QR »
- [✅] `App.css` : styles `.invite-qr*` (tuile blanche)
- [✅] Vérif : lint + build + encodage QR d'une URL d'invité réaliste

## Avancement

Livré et vérifié. QR affiché sous le lien dès génération ; téléchargement PNG
fonctionnel. Encodage validé (SVG/canvas, URL JWT longue).

## Résumé non-technique

Quand on génère un lien d'invitation, un QR code apparaît maintenant sous le
lien : l'invité le scanne avec son téléphone pour rejoindre la revue, sans avoir
à recopier une longue adresse. Un bouton permet aussi de télécharger le QR en
image (pour une présentation ou une affiche). Tout est généré sur place, sans
service externe.
