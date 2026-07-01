# 🧭 Brief complet — App mobile Poulpium (React Native) · pour Gemini

> **Tu es Gemini.** Mission : construire l'application **mobile React Native** de
> **Poulpium** (revue vidéo collaborative), en **portant fidèlement le design
> system et les règles du frontend web existant**. Ce document est **autoportant** :
> il contient les valeurs visuelles exactes, les wireframes, les contrats de
> données, les endpoints, et la cartographie du code réutilisable. Ne dévie pas
> des règles verrouillées (§2). Registre **B2B pro**, jamais « projet hackathon ».
>
> Priorité : **excellence visuelle**. L'app doit paraître un outil pro type
> Frame.io : sombre, dense, précis, un seul accent, chiffres alignés.

---

## 1. Produit en une phrase

Sur mobile, un relecteur **rejoint une session**, **regarde une vidéo** (flux HLS
chiffré Zero-Trust), **dessine sur l'image** et **commente un instant précis
(timecode)**, à plusieurs et **en temps réel** (présence, curseurs, Watch Together).

Écrans : **Login → Catalogue → Revue vidéo** (+ Admin, Surveillance, Docs pour les admins).

---

## 2. 🔒 Règles VERROUILLÉES (non négociables)

1. **Thème sombre uniquement.** Aucun mode clair. Fonds off-black (jamais `#000`).
2. **Un seul accent : bleu `#3d6dfd`.** Interdit d'introduire une 2e couleur d'UI.
   (Les couleurs de dessin sont une *donnée* utilisateur, pas de l'UI — exception légitime.)
3. **Timecodes / compteurs : police mono + `tabular-nums`** (chiffres à chasse fixe,
   ne « sautillent » pas). `fontVariant: ['tabular-nums']` en RN.
4. **Zéro em-dash (—) dans l'UI.** Utiliser « : » ou une reformulation.
5. **Toute animation derrière reduce-motion** (`AccessibilityInfo.isReduceMotionEnabled()`).
6. **Styles natifs** (`StyleSheet` + objet `theme`), pas de framework UI lourd (pas de
   Tailwind/NativeBase). Le `theme` dérive de `tokens.css` (valeurs ci-dessous).
7. **Icônes : Phosphor uniquement** (`phosphor-react-native`). Poids par défaut `bold`/`regular`.
8. **Contraste WCAG AA** sur tous les libellés.

---

## 3. 🎨 Design tokens (valeurs EXACTES — transcris tel quel dans `src/theme.js`)

### Surfaces (off-black)
| Token | Hex | Usage |
|---|---|---|
| `bg` | `#0a0c0f` | fond appli |
| `bg1` | `#101319` | panneaux |
| `bg2` | `#161a21` | cartes/champs |
| `bg3` | `#1d222b` | survol/élevé |
| `bgInset` | `#07090c` | zones enfoncées (timeline, vidéo) |

### Traits
| Token | Valeur |
|---|---|
| `line` | `rgba(255,255,255,0.07)` |
| `lineStrong` | `rgba(255,255,255,0.13)` |

### Texte
| Token | Hex |
|---|---|
| `text` | `#e9ebef` |
| `textDim` | `#9aa2ae` |
| `textFaint` | `#5d646f` |

### Accent (UNIQUE)
| Token | Hex |
|---|---|
| `accent` | `#3d6dfd` |
| `accentStrong` | `#5b85ff` |
| `accentSoft` | `rgba(61,109,253,0.15)` |
| `accentLine` | `rgba(61,109,253,0.45)` |
| `accentInk` (texte sur accent) | `#ffffff` |

### Sémantique (sens réel uniquement, jamais décoratif)
| Token | Hex | Sens |
|---|---|---|
| `ok` / `live` | `#2ec27e` | succès / en direct |
| `warn` | `#f5a623` | avertissement |
| `danger` | `#ff5b5b` | erreur / destructif |

### Rayons · Espacement · Ombres · Motion
```js
radius = { sm: 6, md: 10, lg: 14, pill: 999 }        // panneaux/champs = md ; ronds = pill
space  = { 1:4, 2:8, 3:12, 4:16, 5:24, 6:32, 7:48 }
shadow = { s1:'0 1px 2px rgba(0,0,0,.5)', s2:'0 10px 34px rgba(0,0,0,.55)', pop:'0 16px 50px rgba(0,0,0,.6)' }
ease   = 'cubic-bezier(0.16,1,0.3,1)'   // durée par défaut 180ms (Reanimated Easing.bezier)
```

### Typographie
- **Sans** (UI) : système (`San Francisco` iOS / `Roboto` Android) — RN par défaut, ne rien embarquer.
- **Mono** (timecodes, compteurs, IDs) : **embarquer JetBrains Mono** via `expo-font`
  (SFMono indispo hors Apple). Toujours avec `fontVariant:['tabular-nums']`.

### Palette d'annotation (DONNÉE de dessin — 6 couleurs, distinctes de l'accent)
| Nom | Hex |
|---|---|
| amber | `#f5a623` |
| red | `#ff5b5b` |
| green | `#2ec27e` |
| cyan | `#29c5e6` |
| violet | `#b07bff` |
| white | `#f4f6fa` |

### Couleurs de participant (déterministes, cf. `format.colorForUser`)
`['#4d9bff','#2ec27e','#f5a623','#ff5b7f','#b07bff','#29c5e6','#ff8a3d','#5be0b0']`
→ hash de l'id/pseudo modulo 8. Le même user a toujours la même couleur (avatars, curseurs).

---

## 4. 🧩 Composants UI (spéc + mapping RN)

| Composant | Rôle | RN |
|---|---|---|
| **Button** | `primary` (fond accent, texte blanc gras), `ghost` (bordure `line`, fond transparent), `quiet` (texte seul), `icon` (rond, `radius.pill`) | `Pressable` + états `:active` (scale 0.98), `:disabled` (opacity 0.5) |
| **Badge** | pastille statut ; `badge-accent` = fond `accentSoft`, texte `accentStrong` | `View`+`Text` |
| **Avatar** | pastille ronde, **initiales** (`format.initials`, max 2 lettres), couleur = `colorForUser` | `View` rond `radius.pill` |
| **Topbar / AppShell** | marque à gauche (poulpe), titre centré, actions à droite, **rangée de présence** (avatars empilés, chevauchés -8px) | `SafeAreaView` header |
| **Timecode** | mono + tabular-nums, format `M:SS` ou `H:MM:SS` (`format.formatTime`) | `Text` mono |
| **Input** | champ avec icône à gauche, fond `bg2`, focus → bordure `accentLine` | `TextInput` |
| **PoulpiumMark** | logo poulpe SVG, **yeux qui suivent** (web) → version statique/animée légère en RN | `react-native-svg` |

Marque : **« Poulpium »** (poulpe = plusieurs bras = plusieurs relecteurs). Lockup =
mot + tag. Accent bleu sur le mot.

---

## 5. 🗺️ Écrans & wireframes

### 5.1 Login (registre « aquatique » discret, pro)
Web : panneau gauche « hero » animé (bulles, spotlight, features cliquables) + carte
de connexion à droite. **Mobile : empilé** (hero compact en haut, carte en dessous).

```
┌──────────────────────────────┐
│        🐙  Poulpium           │   marque + tagline
│   revue vidéo collaborative   │
│   · dessine · commente · live │   3 features (icônes Phosphor)
├──────────────────────────────┤
│  Connexion                    │
│  ┌────────────────────────┐   │
│  │ 👤  identifiant         │   │   input + icône
│  └────────────────────────┘   │
│  ┌────────────────────────┐   │
│  │ 🔒  mot de passe    👁  │   │   input + toggle visibilité
│  └────────────────────────┘   │
│  [   Se connecter  →   ]      │   btn-primary pleine largeur
│  alice / bob / carol · pwd    │   comptes démo (discret, textDim)
└──────────────────────────────┘
```
- Bulles/animations **derrière reduce-motion**.
- Erreurs claires (non techniques) : 401 → « Identifiant ou mot de passe incorrect. » ;
  429 → « Trop de tentatives. Réessayez dans quelques minutes. »

### 5.2 Catalogue
```
┌──────────────────────────────┐
│ Poulpium        [Admin][Surv] │  topbar (Admin/Surv si isAdmin)
├──────────────────────────────┤
│ ┌──────────┐  ▶  chiffré 🔒   │  carte SAMPLE (jouable) mise en avant
│ │  thumb   │  Séquence démo    │
│ └──────────┘  Présentation     │
│                                │
│ Catalogue                      │
│ ┌────┐ ┌────┐  (grille 2 col)  │  CATALOGUE_META : cartes DÉSACTIVÉES
│ │v01 │ │v05 │  opacity réduite  │  (métadonnées seules, pas de faux
│ └────┘ └────┘  « métadonnées »  │   contenu jouable) + durée mono
└──────────────────────────────┘
```
- Cartes non jouables : **désactivées visuellement** (pas de faux play). Durée en mono.
- Vignettes : `https://picsum.photos/seed/<id>/480/270` (placeholder assumé).

### 5.3 Revue vidéo (écran central)
```
┌──────────────────────────────┐
│ ‹ Retour   Titre    ●live 3   │  topbar + présence
├──────────────────────────────┤
│                               │
│        [ VIDÉO + calque       │  lecteur HLS + overlay dessin
│          de dessin ]          │  (curseurs distants nommés)
│                               │
├──────────────────────────────┤
│ ▮▮▮╍╍╍╍◆╍╍╍╍╍╍╍╍╍╍◆╍╍╍╍ 1:23 │  TIMELINE : marqueurs ◆ = commentaires
├──────────────────────────────┤
│ ▷  ‹‹  ›› | outils dessin |🎨 │  contrôles + barre d'outils + couleurs
├──────────────────────────────┤
│ Commentaires (triés par temps)│  panneau (onglet/bottom-sheet en mobile)
│  0:12 alice  « logo trop … »  │  saut à l'instant au tap
│    ↳ bob « à agrandir »        │  réponses, ✔ résolu, ♥ like
└──────────────────────────────┘
```
- **Timeline** : marqueurs `◆` cliquables à chaque note (couleur de la note), tête de
  lecture, `bgInset`. Tap sur marqueur = seek au timecode.
- **Barre d'outils dessin** : 7 outils (§8), 6 couleurs (§3), coordonnées **0..1**.
- **Mobile** : le panneau commentaires devient un **bottom-sheet** (drag up) ou onglet
  « Commentaires / Vidéo », pour préserver la place à l'écran.

### 5.4 Panneau commentaires (détail)
- Liste **triée par timecode croissant**.
- Filtres : tous / non résolus / à moi. Chaque note : avatar+nom (couleur user),
  timecode (mono, saut au tap), texte, **miniatures de dessins**, réponses,
  toggle **résolu** (`ok`), **like** (♥ + compteur), suppression (auteur ou admin).
- Compositeur : `TextInput` + sélection d'outils ; envoi.

### 5.5 Admin (si `isAdmin()`), Surveillance, Docs
- **Admin** : onglets Entreprises / Utilisateurs / Contenus (multi-tenant). Tables denses.
- **Surveillance** (SecurityDashboard) : métriques sécurité, bans IP, watermark, changements.
- **Docs** : page statique d'aide.
- Ces écrans sont **secondaires** pour la V1 mobile (peuvent être des vues simplifiées).

---

## 6. 🔌 API backend (Core NestJS · `http://<host>:3000`)

| Méthode + route | Auth | Rôle |
|---|---|---|
| `POST /auth/login` | non | `{username,password}` → `{accessToken, user:{id,username,role}}`. 401 / 429 (rate-limit 10/min, lock 5 échecs). TTL token 15 min. |
| `POST /auth/refresh` | oui | rafraîchit le token |
| `POST /auth/logout` | oui | |
| `GET /auth/me` | oui | user courant (réhydratation) |
| `POST /auth/change-password` | oui | 1re connexion admin invité (`mustChangePassword`) |
| `GET /contents` | oui | liste des contenus autorisés (multi-tenant) |
| `GET /keys/:contentId` | oui | **16 octets bruts** de la clé AES (Zero-Trust). 401/403/404 |
| `GET /stream/:contentId/index.m3u8` | (selon) | playlist HLS chiffrée |
| `GET /stream/:contentId/:segment` | (selon) | segments `.ts` |
| `GET /security/dashboard` `.../changes` `.../bans` `.../watermark` | admin | surveillance |
| `POST /security/ban` · `DELETE /security/ban/:ip` | admin | |
| `/admin/companies` `/admin/users` `/admin/contents` (+ CRUD) | admin/superadmin | multi-tenant |

`role` ∈ `superadmin | admin | user/member`. Claims JWT décodables sans réseau
(affichage uniquement) : `{ role, companyId, mustChangePassword }`.

### ⭐ Point CENTRAL : lecture HLS chiffrée
La playlist contient `#EXT-X-KEY:METHOD=AES-128,URI=".../keys/:id",IV=0x...`.
Le lecteur doit joindre `Authorization: Bearer <jwt>` **sur la requête de clé**.
- Web : `hls.js` + `xhrSetup`.
- **RN** : `react-native-video` avec `source.headers = { Authorization: 'Bearer '+token }`
  (s'applique à toutes les requêtes de la source — OK ici). Si insuffisant : petit
  **proxy de clé local** (fetch la clé avec header, sert en `http://127.0.0.1`).
  ➜ **À prototyper EN PREMIER** (risque n°1).

---

## 7. 📦 Contrats de données temps réel (identiques au web — respecte-les)

### Objet « note » (commentaire + dessins rattachés à un timecode)
```json
{
  "id": "a1b2c3d4",
  "time": 42.7,
  "author": { "id": "1", "name": "alice", "color": "#4d9bff" },
  "text": "Le logo est trop petit ici.",
  "color": "#f5a623",
  "resolved": false,
  "likes": [{ "id": "2", "name": "bob" }],
  "replies": [
    { "id": "r1e2p3", "author": {"id":"2","name":"bob","color":"#29c5e6"},
      "text": "à agrandir", "createdAt": "2026-06-30T10:01:00.000Z" }
  ],
  "shapes": [ /* voir §8 */ ],
  "createdAt": "2026-06-30T09:59:00.000Z"
}
```

### Export / Import JSON (réutilisable, même format)
```json
{ "version": 1, "session": "demo-42c", "exportedAt": "…ISO…", "notes": [ /* notes */ ] }
```

### Bus temps réel (transport abstrait — cf. §10). Types de messages :
| type | sens |
|---|---|
| `join` / `presence` / `leave` | présence (ping 3s, timeout 9s) |
| `cursor` | curseur distant `{x,y (0..1), name, color}` (throttle 55ms) |
| `note:add` / `note:reply` / `note:resolve` / `note:remove` / `note:like` / `note:update` | mutations de notes |
| `sync:state` | envoi de l'état complet `{notes}` au nouveau venu (et réimport) |
| **Watch Together** : `wt:claim` `wt:release` `wt:state` `wt:playback` `wt:heartbeat` | présentateur pilote play/pause/seek ; invités suivent (contrôles verrouillés) ; retardataire resynchronisé ; recalage de dérive |

Règle d'or : **un transport ne réémet jamais à l'émetteur** ; chaque message porte
`from` (id auteur) et on ignore ses propres messages.

---

## 8. ✏️ Outil de dessin (coordonnées normalisées 0..1)

7 outils : `cursor` (navigation), `pen`, `eraser`, `arrow`, `rect`, `ellipse`, `text`.
Formes (`shapes[]` d'une note) :
```json
{ "tool":"arrow",   "color":"#f5a623", "from":{"x":0.4,"y":0.3}, "to":{"x":0.55,"y":0.42} }
{ "tool":"rect",    "color":"#f5a623", "from":{"x":0.1,"y":0.1}, "to":{"x":0.3,"y":0.25} }
{ "tool":"ellipse", "color":"#29c5e6", "from":{"x":0.5,"y":0.4}, "to":{"x":0.7,"y":0.6} }
{ "tool":"text",    "color":"#f4f6fa", "at":{"x":0.45,"y":0.2}, "value":"À revoir" }
{ "tool":"pen",     "color":"#ff5b5b", "points":[{"x":0.2,"y":0.2},{"x":0.22,"y":0.23}] }
```
- **Coordonnées 0..1** = indépendantes de la résolution → se mappent à l'identique
  entre web et mobile, et entre participants. **Conserver ce système.**
- Web : `<canvas>`. **RN : `@shopify/react-native-skia`** (60 fps au trait) ; SVG possible
  mais moins fluide sur les traits `pen`.
- `eraser` : supprime les formes touchées. `text` : ouvre une saisie au point tapé.

---

## 9. 🔁 Code JS réutilisable (à porter, ne pas réécrire la logique)

| Fichier web | Port | Adaptation mobile |
|---|---|---|
| `frontend/src/lib/format.js` | ✅ tel quel | aucune (helpers purs : `formatTime`, `colorForUser`, `initials`, `timeAgo`, `shortId`) |
| `frontend/src/lib/useReview.js` | ✅ hook | remplacer `localStorage` → `AsyncStorage` ; `window.addEventListener('beforeunload')` → `AppState` ; `crypto.randomUUID` fallback déjà géré |
| `frontend/src/lib/collab.js` | ⚠️ socket only | **supprimer l'adapter BroadcastChannel** (inexistant en RN) ; garder l'adapter `socket.io` ; `import.meta.env` → `process.env.EXPO_PUBLIC_*` |
| `frontend/src/auth.js` | ⚠️ léger | `localStorage` → `expo-secure-store` ; `window.dispatchEvent('auth:expired')` → événement RN / callback ; `fetch` OK |
| `frontend/src/data/videos.js` | ✅ | données catalogue |

## 10. 🌐 Temps réel en RN
Uniquement **socket.io** (le web a BroadcastChannel en plus, pas le mobile). Le Core
expose une **gateway `ReviewGateway`** qui relaie les messages par room `session`
(`client.to(room).emit` → pas d'écho serveur), auth JWT best-effort au handshake.
Config : `EXPO_PUBLIC_API_URL=http://<ip>:3000`, `EXPO_PUBLIC_COLLAB_MODE=socket`.
`socket.io-client` fonctionne en RN sans modification.

---

## 11. 🛠️ Stack & arborescence cible

- **Expo (managed) + expo-router**, React Native 0.7x, **JS** (cohérent avec le web JS).
- Libs : `socket.io-client`, `react-native-video` (HLS), `@shopify/react-native-skia`
  (dessin), `phosphor-react-native`, `react-native-reanimated` (anim + reduce-motion),
  `expo-secure-store`, `expo-font` (JetBrains Mono), `@react-native-async-storage/async-storage`,
  `expo-document-picker` + `expo-file-system` (import/export JSON), `react-native-svg`.
```
mobile/
  app/                     # expo-router : index(login) · catalogue · review/[session] · admin · dashboard
  src/
    theme.js               # ⟵ §3 (source de vérité visuelle)
    auth.js                # ⟵ web adapté (SecureStore)
    lib/ { format.js, collab.js(socket), useReview.js }   # ⟵ réutilisés
    components/ { AppShell, PoulpiumMark, VideoPlayer, DrawingLayer, Timeline,
                  Toolbar, CommentList, CommentComposer, Avatar, Button, Badge, Input }
    data/videos.js
  assets/fonts/JetBrainsMono-*.ttf
```

---

## 12. ✅ Critères d'acceptation (par écran)

- **Global** : 100% sombre ; un seul bleu d'accent ; timecodes mono+tabular-nums ;
  aucun em-dash ; animations coupées si reduce-motion ; icônes Phosphor ; contraste AA.
- **Login** : login réel `POST /auth/login` ; erreurs 401/429 claires ; token en SecureStore ; réhydratation `GET /auth/me`.
- **Catalogue** : SAMPLE jouable en avant ; cartes méta désactivées (pas de faux play) ; durées mono.
- **Revue** : vidéo HLS chiffrée lit (clé authentifiée) ; timeline avec marqueurs cliquables ;
  dessin 7 outils / 6 couleurs en coords 0..1 ; commentaires triés par temps + saut au timecode ;
  présence + curseurs distants nommés ; Watch Together (présentateur pilote, invités suivent).
- **Temps réel** : 2 appareils sur le même `session` (mode socket) voient notes/présence en direct.
- **Import/Export** : JSON `{version,session,notes[]}` produit et relu à l'identique.

---

## 13. ⚠️ Risques à traiter en priorité (ordre)

1. **HLS AES + header sur la requête de clé** (§6) → POC lecteur avant tout le reste.
2. **Fluidité du dessin** (Skia vs SVG) → valider `pen` à 60 fps.
3. **Temps réel socket only** → Core doit tourner ; pas de démo LAN sans gateway.
4. **Police mono embarquée** (tabular-nums) → sinon les timecodes « sautillent ».

---

## 14. 📎 Références dans le repo (à lire pour le détail)

- `frontend/src/styles/tokens.css` — design system source.
- `frontend/REFONTE-UI.md` — features livrées + format d'export.
- `docs/FRONTEND-INTEGRATION.md` — auth + lecture HLS chiffrée (exemple `SecureVideo`).
- `frontend/src/lib/{format,collab,useReview}.js`, `frontend/src/auth.js` — code à porter.
- `frontend/src/components/{VideoReview,DrawingCanvas,CommentPanel,Catalogue,AppShell}.jsx` — comportements de référence.
- `CLAUDE.md` — guide projet + conventions.
- `docs/PLAN-MOBILE-RN.md` — plan d'exécution résumé (complémentaire à ce brief).
