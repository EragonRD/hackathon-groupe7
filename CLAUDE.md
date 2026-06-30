# Poulpium — guide projet (pour le prochain dev)

**Poulpium** est un espace de **revue vidéo collaborative** : on dessine sur
l'image et on commente un instant précis (timecode), à plusieurs et en temps
réel. Monorepo : `frontend/` (React/Vite, Pôle 1), `backend/` (NestJS, auth +
gateway temps réel), `engine/` (IA/Data, Pôle 3 — à venir).

## Démarrage

```bash
# Front
cd frontend && npm install && npm run dev
#   -> déposer un .mp4 dans frontend/public/sample.mp4 (gitignoré),
#      ou utiliser « Charger une vidéo locale » dans le catalogue.

# Back (auth)
cd backend && npm install && npm run start:dev
#   POST /auth/login  ·  comptes démo : alice / bob / carol  ·  mdp : password
```

Temps réel **multi-machines (LAN)** : `VITE_COLLAB_MODE=socket` +
`VITE_API_URL=http://<ip>:3000` (voir `frontend/.env.example`). Par défaut
(`broadcast`) la synchro est multi-fenêtres d'une seule machine.

## Architecture & feuille de route UI

Document de référence (ce qui est livré, format d'export JSON, plan futur) :

@frontend/REFONTE-UI.md

## Design system

Tokens et règles visuelles (à respecter pour toute nouvelle UI) :

@frontend/src/styles/tokens.css

Règles verrouillées : **thème sombre uniquement**, **un seul accent** (bleu),
police mono + `tabular-nums` pour les timecodes, **zéro em-dash** dans l'UI,
toute animation derrière `prefers-reduced-motion`. CSS **natif + variables**
(pas de Tailwind). Icônes : **`@phosphor-icons/react`** uniquement.

## Carte des fichiers (front) — par où commencer

| Fichier | Rôle |
|---|---|
| `frontend/src/App.jsx` | Gate d'auth + routing par état (catalogue ↔ revue) |
| `frontend/src/auth.js` | `login` / `me` / `authFetch` (JWT, parle au Core) |
| `frontend/src/Login.jsx` | Écran de connexion Poulpium (interactif, aquatique) |
| `frontend/src/components/PoulpiumMark.jsx` | Marque (poulpe SVG) ; yeux qui suivent le curseur |
| `frontend/src/components/AppShell.jsx` | Topbar + cadre applicatif |
| `frontend/src/components/Catalogue.jsx` | Choix de vidéo + import d'un fichier local |
| `frontend/src/components/VideoReview.jsx` | **Composant central réutilisable** (props `source`/`session`/`user`) |
| `frontend/src/components/DrawingCanvas.jsx` | Calque de dessin (coords normalisées 0..1) |
| `frontend/src/components/CommentPanel.jsx` | Liste des commentaires + compositeur |
| `frontend/src/lib/useReview.js` | État de session : notes, présence, curseurs, Watch Together |
| `frontend/src/lib/collab.js` | **Transport temps réel abstrait** (BroadcastChannel ⇄ socket.io, même contrat) |
| `frontend/src/lib/format.js` | Helpers purs (timecode, couleur par user, id court) |
| `frontend/src/data/videos.js` | Catalogue de démonstration |
| `frontend/src/App.css` | Tous les styles applicatifs (organisés par zone) |
| `frontend/src/index.css` | Base/reset (importe `styles/tokens.css`) |

## Conventions

- **Lint/format** avant commit : `cd frontend && npm run lint` (eslint+prettier,
  fins de ligne **LF**). Règle stricte `react-hooks/refs` : ne pas lire/écrire
  `ref.current` pendant le render (le faire dans un effet/handler).
- **Marque** : « Poulpium » (poulpe = plusieurs bras = plusieurs relecteurs sur
  une même vidéo). Le registre est **B2B pro**, pas « projet hackathon ».

## Pièges connus

- `frontend/public/sample.mp4` (~14 Mo) est **gitignoré** : chaque poste dépose
  son fichier.
- Pas de routeur : navigation par état dans `App.jsx`. Passer à `react-router`
  seulement si on veut des URLs partageables (`/review/:session`).
- `BroadcastChannel` ne traverse pas les machines : pour démontrer le LAN,
  basculer en mode `socket` (gateway `backend/src/review/`).
