# 🧑‍💻 Plan de travail — Matthieu (P1 · Annotation & UX)

> Profil : DAD (codeur). Lead pôle : Alex. Branche : `feat/refonte-ui-revue`.
> **Lis ça avant de coder** : une grosse partie de ce qui t'était assigné dans
> `REPARTITION.md` est **déjà fait** par la refonte d'Alex. Ne le réécris pas.
> Ce plan ne liste que ce qui **reste réellement** dans ta lane (annotation / UX).

---

## ✅ Déjà fait (ne pas refaire)

Dans `frontend/src/` :
- **Dessin au timecode** : `components/DrawingCanvas.jsx` — outils `pen` (trait
  libre), `arrow`, `rect`, 6 couleurs, **coordonnées normalisées 0..1**, DPR-aware,
  `ResizeObserver`.
- **Commentaires** : `components/CommentPanel.jsx` — liste **triée par temps**,
  **saut à l'instant** (`selectNote` → `seekTo`), suppression (auteur ou admin),
  compositeur avec `⌘/Ctrl+↵`.
- **Export / Import JSON** : `components/VideoReview.jsx` (`exportJSON` / `importJSON`),
  format versionné `{ version, session, exportedAt, notes[] }`.
- **Temps réel local** : `lib/useReview.js` + `lib/collab.js` (présence, curseurs,
  diffusion des notes) — **via `BroadcastChannel`** (multi-fenêtres **même machine**).

➡️ Donc : flèche / cadre / trait / couleur / liste triée / saut / réimport = **OK**.

---

## 🎯 Ce qui reste pour toi (par priorité)

### P1 — Outil **Texte** (manque explicite du sujet)
Le sujet liste « flèche, formes, trait libre, **texte** ». Le texte n'existe pas.
- Ajouter l'outil `text` à `TOOLS` dans `VideoReview.jsx` (icône Phosphor, ex. `TextT`).
- Dans `DrawingCanvas.jsx` : au clic en mode `text`, poser un point `{x,y}` normalisé,
  afficher un petit champ de saisie en overlay (position = point × taille affichée),
  produire une shape `{ tool:'text', color, at:{x,y}, value }`. Gérer le rendu dans
  `drawShape` (`ctx.fillText`, taille de police relative à la hauteur du canvas).
- **DoD** : on tape un texte sur l'image, il s'affiche au bon endroit à toute taille,
  il part dans la note, il se resynchronise dans une 2ᵉ fenêtre, il est dans l'export JSON.

### P2 — Outil **Ellipse / cercle**
« formes » au pluriel : ajouter `ellipse` à côté de `rect`.
- `TOOLS` dans `VideoReview.jsx` + branche `s.tool === 'ellipse'` dans `drawShape`
  (`ctx.ellipse(cx, cy, rx, ry, …)` à partir de `from`/`to`).
- **DoD** : ellipse dessinée, normalisée, synchronisée, exportée.

### P3 — **Éditer** une note existante (aujourd'hui : supprime/recrée)
- Bouton « Modifier » sur une note sélectionnée → charge `note.shapes` dans
  `draftShapes` + `note.text` dans `text` + ré-épingle `note.time`, puis met à jour.
- Ajouter `updateNote(id, patch)` dans `lib/useReview.js` (mutation + diffusion
  `note:add` avec le même `id` → l'upsert par id gère le remplacement, pas de doublon).
- **DoD** : on rouvre une note, on ajoute une flèche, on enregistre, les autres
  fenêtres voient la version modifiée (pas une 2ᵉ note).

### P4 — **Réponses (fil de discussion)** + **Résolu / non résolu** + **Filtres**
- Champ `replies: [{ id, author, text, createdAt }]` et `resolved: boolean` sur la note.
- `CommentPanel.jsx` : sous-fil sous chaque note + champ réponse ; toggle « Résolu ».
- Barre de filtres : **par auteur**, **état (résolu/ouvert)**, **« mes commentaires »**.
- Côté `useReview.js` : messages `note:reply` et `note:resolve` (même logique upsert/diffusion).
- **DoD** : une réponse et un changement d'état se propagent en direct ; les filtres
  fonctionnent ; tout reste dans l'export.

### P5 — **Navigation clavier** sur la timeline
- Sur le scrubber (`VideoReview.jsx`) : `←/→` = ±5 s, `Shift+←/→` = marqueur précédent/suivant,
  `Home/End` = début/fin. Marqueurs `tabbable`.
- **DoD** : on pilote la lecture et on saute de commentaire en commentaire au clavier.

### P6 — États **chargement / erreur / vide**
- `VideoReview.jsx` : skeleton tant que `loadedmetadata` n'a pas fired ; écouter
  l'event `error` du `<video>` → message « source illisible » (utile pour le futur
  flux chiffré P2). `Catalogue.jsx` : message clair si aucune vidéo.
- **DoD** : aucune page blanche ; chaque état a un retour visuel.

---

## 🚫 Hors de ta lane (c'est à Alex)
- **LAN socket.io** (gateway `@WebSocketGateway` côté `backend/`) — gap n°1 pour la note,
  c'est le temps réel multi-machines. L'adapter front existe déjà dans `collab.js`
  (`VITE_COLLAB_MODE=socket`), mais **le serveur n'existe pas**. Ne pars pas dessus
  sans qu'Alex te le délègue explicitement.
- **Watch Together (sujet B)** : présentateur/invité + sync play/pause/seek — décision
  de périmètre en attente côté Alex.

## ▶️ Comment travailler / tester
- Tout ce qui est ci-dessus est **pur front, sans dépendance backend** → tu peux
  démarrer tout de suite, en parallèle d'Alex.
- `cd frontend && npm install && npm run dev`. Dépose un `.mp4` dans
  `frontend/public/sample.mp4` (ignoré par git) **ou** « Charger une vidéo locale ».
- Démo collab : ouvre **2 fenêtres** du même navigateur sur la même session.
- Avant de pousser : `npm run lint` dans `frontend/`. Commits petits et ciblés sur
  `feat/refonte-ui-revue` (ou une sous-branche par tâche, à voir avec Alex).
