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
| **Annotation** | `components/DrawingCanvas.jsx` : trait libre / flèche / cadre / ellipse / texte, 6 couleurs, **coordonnées normalisées** (s'adaptent à toute taille et se mappent entre fenêtres), rattachées au **timecode**. |
| **Commentaires** | `components/CommentPanel.jsx` : liste **triée par temps**, saut à l'instant, suppression (auteur ou admin), édition d'une note, réponses, statut résolu/non résolu, filtres, compositeur (texte + dessins) avec `⌘/Ctrl+↵`. |
| **Temps réel** | `lib/useReview.js` + `lib/collab.js` : présence, **curseurs distants**, diffusion des notes. Deux transports au **même contrat** : `BroadcastChannel` (multi-fenêtres, offline) **et** `socket.io` → **LAN 2-3 machines** via la gateway du Core. |
| **Watch Together** | Un participant **prend la présentation** : ses play/pause/seek se répercutent chez les invités (contrôles verrouillés), retardataire **resynchronisé**, **dérive recalée** (seuil 0,4 s), anti-écho par drapeau. Messages `wt:*` sur le même bus. |
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
      "resolved": false,
      "replies": [
        {
          "id": "r1e2p3",
          "author": { "id": "2", "name": "bob", "color": "#29c5e6" },
          "text": "Je confirme, à agrandir.",
          "createdAt": "2026-06-30T10:01:00.000Z"
        }
      ],
      "shapes": [
        { "tool": "arrow", "color": "#f5a623", "from": {"x":0.4,"y":0.3}, "to": {"x":0.55,"y":0.42} },
        { "tool": "rect",  "color": "#f5a623", "from": {"x":0.1,"y":0.1}, "to": {"x":0.3,"y":0.25} },
        { "tool": "ellipse", "color": "#29c5e6", "from": {"x":0.5,"y":0.4}, "to": {"x":0.7,"y":0.6} },
        { "tool": "text", "color": "#f4f6fa", "at": {"x":0.45,"y":0.2}, "value": "À revoir" },
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

- **Mono-machine** : adapter `BroadcastChannel` → démo multi-fenêtres réelle,
  100 % offline, aucun backend.
- **LAN, 2-3 machines** *(implémenté)* : adapter `socket.io` (`VITE_COLLAB_MODE=socket`,
  `VITE_API_URL=http://<ip>:3000`). Côté Core, `ReviewGateway`
  (`backend/src/review/`) relaie les messages aux membres de la room `session`
  (`client.to(room).emit` → pas d'écho serveur), avec auth JWT best-effort au
  handshake. **Aucune ligne d'UI à changer** : même contrat de transport.

## Démarrage

```bash
cd frontend && npm install && npm run dev
# Vidéo de démo : déposez un .mp4 dans frontend/public/sample.mp4
# (ignoré par git). Sinon, "Charger une vidéo locale" dans le catalogue.
```

---

# Plan futur pour le reste de l'UI

Par ordre de valeur pour la soutenance. Les briques 1–2 sont les plus payantes.

### 1. ~~Brancher le temps réel LAN (socket.io)~~ — ✅ FAIT
- `ReviewGateway` (`backend/src/review/`) relaie les messages par room `session` ;
  adapter socket activé dans `collab.js` (`VITE_COLLAB_MODE=socket`).
- **Watch Together** (sujet B) livré par-dessus : présentateur/invité, sync
  play/pause/seek, resync retardataire, recalage de dérive, anti-écho.
- *Reste possible* : promotion auto du présentateur à la déconnexion (aujourd'hui
  un invité « reprend la main » manuellement), offset d'horloge NTP-like si on
  veut viser < 0,2 s entre machines.

### 2. Robustesse de la session de revue
- Ajouter des conflits d'édition explicites si deux fenêtres modifient la même note simultanément.
- Ajouter l'historique d'une note (création, édition, résolution) si nécessaire pour la soutenance.
- Prévoir une migration de stockage local si le format `notes[]` évolue encore.

### 3. États & accessibilité (déjà amorcés, à compléter)
- États de **chargement** (vidéo), **erreur** (source illisible),
  **vide** (présents). Ajouter : reconnexion socket, conflit d'import.
- Navigation **clavier** présente sur la timeline (flèches = ±5s, marqueurs
  tabulables). Ajouter la navigation clavier complète des outils.
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
