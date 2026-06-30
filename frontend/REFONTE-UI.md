# Refonte UI — Lecteur de Revue augmenté (Pôle 1)

Refonte complète du `frontend/` : on remplace le starter Vite par un véritable
**espace de revue vidéo collaboratif** (dessin + commentaire au timecode, en
direct), au langage visuel *dark studio* (type Frame.io).

## Ce qui est livré (fonctionnel)

| Zone | Détail |
|---|---|
| **Design system** | `src/styles/tokens.css` : thème sombre verrouillé, **un seul accent** (bleu), échelle de rayons/espacement, mono + `tabular-nums` pour les timecodes. CSS natif, **zéro dépendance réseau** (offline-friendly). |
| **Auth** | `Login.jsx` redessiné, câblé sur le Core (`POST /auth/login`). Réhydratation au rechargement via `GET /auth/me` (`auth.js#me`). |
| **Catalogue** | `Catalogue.jsx` : vidéo locale réelle (`public/sample.mp4`), **charger une vidéo locale** (drag & drop), + métadonnées de `data/videos.csv` (cartes désactivées tant que le fichier n'est pas fourni — pas de faux contenu). |
| **VideoReview** | `components/VideoReview.jsx` : **composant autonome réutilisable** (props `source` / `session` / `user`). Lecteur custom, timeline avec **marqueurs de commentaires**, barre d'outils. |
| **Annotation** | `components/DrawingCanvas.jsx` : trait libre / flèche / cadre, 6 couleurs, **coordonnées normalisées** (s'adaptent à toute taille et se mappent entre fenêtres), rattachées au **timecode**. |
| **Commentaires** | `components/CommentPanel.jsx` : liste **triée par temps**, saut à l'instant, suppression (auteur ou admin), compositeur (texte + dessins) avec `⌘/Ctrl+↵`. |
| **Temps réel** | `lib/useReview.js` + `lib/collab.js` : présence, **curseurs distants**, diffusion des notes, **synchro multi-fenêtres** via `BroadcastChannel` (offline, sans backend). |
| **Export / Import** | JSON propre `{ version, session, exportedAt, notes[] }`, réimportable. |

### Format d'export (réutilisable)

```json
{
  "version": 1,
  "session": "demo-42c",
  "exportedAt": "2026-06-30T10:00:00.000Z",
  "notes": [
    {
      "id": "a1b2c3d4",
      "time": 42.7,
      "author": { "id": "1", "name": "alice", "color": "#4d9bff" },
      "text": "Le logo est trop petit ici.",
      "color": "#f5a623",
      "shapes": [
        { "tool": "arrow", "color": "#f5a623", "from": {"x":0.4,"y":0.3}, "to": {"x":0.55,"y":0.42} },
        { "tool": "rect",  "color": "#f5a623", "from": {"x":0.1,"y":0.1}, "to": {"x":0.3,"y":0.25} },
        { "tool": "pen",   "color": "#ff5b5b", "points": [{"x":0.2,"y":0.2}, {"x":0.22,"y":0.23}] }
      ],
      "createdAt": "2026-06-30T09:59:00.000Z"
    }
  ]
}
```

> Coordonnées **normalisées 0..1** → indépendantes de la résolution d'affichage.

## Architecture temps réel (point clé)

L'UI ne dépend **jamais** d'un transport concret. `createTransport(session)`
expose un contrat unique : `post(msg)` / `subscribe(fn)` / `close()`.

- **Aujourd'hui** : adapter `BroadcastChannel` → démo multi-fenêtres réelle,
  100 % offline, aucun backend à écrire.
- **Demain (LAN, 2-3 machines)** : adapter `socket.io` déjà esquissé dans
  `collab.js` (import dynamique, `VITE_COLLAB_MODE=socket`). Côté Core, une
  `@WebSocketGateway` relaie les messages aux membres de la room `session`.
  **Aucune ligne d'UI à changer.**

## Démarrage

```bash
cd frontend && npm install && npm run dev
# Vidéo de démo : déposez un .mp4 dans frontend/public/sample.mp4
# (ignoré par git). Sinon, "Charger une vidéo locale" dans le catalogue.
```

---

# Plan futur pour le reste de l'UI

Par ordre de valeur pour la soutenance. Les briques 1–2 sont les plus payantes.

### 1. Brancher le temps réel LAN (socket.io) — *priorité haute*
- Implémenter la `@WebSocketGateway` côté `backend/` (rooms = `session`, relai
  `socket.to(room).emit`). Activer l'adapter socket de `collab.js`.
- **Pourquoi** : le sujet demande 2-3 utilisateurs **sur le réseau local** ;
  `BroadcastChannel` ne couvre que le multi-fenêtres d'une même machine.
- **Risque** : dérive d'horloge / ordre des messages → ajouter un `seq` et un
  `lastWriteWins` par note.

### 2. Robustesse de la session de revue
- **Réponses / fil de discussion** par note (champ `replies[]`).
- **Résolu / non résolu** par commentaire (filtre dans le panneau).
- **Filtres** : par auteur, par état, "mes commentaires".
- Édition d'une note existante (re-dessin), aujourd'hui on supprime/recrée.

### 3. États & accessibilité (déjà amorcés, à compléter)
- États de **chargement** (skeleton vidéo), **erreur** (source illisible),
  **vide** (présents). Ajouter : reconnexion socket, conflit d'import.
- Navigation **clavier** complète sur la timeline (flèches = ±5s, marqueurs
  tabulables) et les outils.
- Vérifier le contraste WCAG AA sur tous les libellés (audit rapide à faire).

### 4. Catalogue & gestion de contenu
- Vraies **vignettes** générées (capture d'une frame), durées lues à la volée.
- Tri / recherche / filtre par catégorie (les données `videos.csv` existent).
- Page "mes revues récentes" (sessions ouvertes, persistées localement).

### 5. Lecteur
- Vitesses de lecture (0.5× / 1× / 2×), **avance image par image** (utile en
  revue), plein écran, raccourcis (J/K/L, `,`/`.`).
- Mini-aperçu au survol de la timeline.

### 6. Intégration inter-pôles (Bloc B)
- **Pôle 2 (Zero-Trust)** : si la vidéo est chiffrée HLS, demander la clé AES au
  Core avec le token → la `source` du `VideoReview` devient un flux protégé.
- **Pôle 3 (IA)** : afficher la **transcription** sous la timeline, cliquable
  (saut à l'instant) ; superposer les **hotspots de rétention** sur la barre.

### 7. Finitions produit
- Curseurs collaboratifs nommés (fait, à fiabiliser), **réactions** (emoji au
  timecode), **panneau participants**.
- Thème : rester **sombre verrouillé** (cohérence). Pas de mode clair sauf
  demande explicite.

## Dette / points à surveiller
- `public/sample.mp4` (14 Mo) est **ignoré par git** (`frontend/.gitignore`) :
  chaque poste doit déposer son fichier.
- Pas de routeur : navigation par état (`App.jsx`). Suffisant à 2 vues ; passer
  à `react-router` si on ajoute des URLs partageables (`/review/:session`).
- `BroadcastChannel` ne fonctionne pas entre machines : ne pas démontrer le LAN
  sans avoir branché socket.io (brique 1).
