# 🔌 Plan d'implémentation Front ↔ Backend (P1 ↔ Core/P2)

Guide pour le dev **frontend (React, Pôle 1)** afin de se connecter au **backend (Core NestJS, Pôle 2)** :
authentification, lecture de la **vidéo chiffrée Zero-Trust**, watermark et dashboard sécurité.

> Base déjà fournie : [`frontend/src/auth.js`](../frontend/src/auth.js) (login / token / `authFetch`)
> et [`frontend/src/Login.jsx`](../frontend/src/Login.jsx). **On réutilise et on étend ce helper**, on ne le réécrit pas.

---

## 0. Architecture & ports

| Service | URL | Rôle |
|---|---|---|
| **Core (NestJS)** | `http://localhost:3000` | Auth, **clé AES**, sécurité, watermark |
| **HLS (nginx)** | `http://localhost:8080` | Playlist `.m3u8` + segments `.ts` chiffrés |

⚠️ La **clé de déchiffrement** n'est servie QUE par le Core (`:3000/keys/...`) sur token valide.
nginx (`:8080`) sert la vidéo chiffrée mais **refuse la clé** (404). C'est le cœur du Zero-Trust.

### Config d'environnement
Créer `frontend/.env.local` :
```
VITE_API_URL=http://localhost:3000
VITE_HLS_URL=http://localhost:8080
```
`auth.js` lit déjà `VITE_API_URL`. Ajouter une constante pour le HLS.

---

## 1. Authentification (déjà en place — à étendre)

### Endpoint
`POST /auth/login` — body `{ username, password }`
- **Succès (201)** → `{ accessToken: "<jwt>", user: { id, username, role } }`
- **401** identifiants invalides · **429** trop de tentatives (rate-limit 10/min) ou **compte verrouillé** (5 échecs)

> `role` vaut `"admin"` (alice) ou `"member"` (bob, carol). Sert à afficher/masquer l'admin.

### Route protégée d'exemple
`GET /auth/me` (header `Authorization: Bearer <token>`) → l'utilisateur courant.

### À implémenter côté front
1. Gérer le **429** au login (afficher « trop de tentatives, réessayez dans quelques minutes »).
2. Un **intercepteur 401** : si une réponse `authFetch` renvoie 401 → token expiré (TTL 15 min) → `logout()` + redirection login.
3. Exposer `role` dans le contexte d'auth (pour les pages admin).

```js
// auth.js — petit ajout suggéré
export function getClaims() {
  const t = getToken()
  if (!t) return null
  try { return JSON.parse(atob(t.split('.')[1])) } catch { return null }   // { role, companyId, ... }
}
export function getRole() { return getClaims()?.role ?? null }
export function isAdmin() { return ['admin', 'superadmin'].includes(getRole()) }
export function isSuperAdmin() { return getRole() === 'superadmin' }
```

---

## 2. ⭐ Lecture de la vidéo chiffrée (le point central)

La playlist contient une ligne :
```
#EXT-X-KEY:METHOD=AES-128,URI="http://localhost:3000/keys/poc",IV=0x...
```
Quand le lecteur veut déchiffrer, il appelle cette URL de clé. **Il faut y joindre le token.**

> 🚫 La balise `<video>` HTML native **ne peut pas** ajouter d'en-tête `Authorization` sur la requête de clé.
> ✅ **Il faut [hls.js](https://github.com/video-dev/hls.js)** (ou un service worker). Le sujet autorise un lecteur libre.

### Installation
```bash
cd frontend && npm install hls.js
```

### Composant `<SecureVideo>` (réutilisable, props : `contentId`)
```jsx
import { useEffect, useRef } from 'react'
import Hls from 'hls.js'
import { getToken } from './auth'

const HLS_URL = import.meta.env.VITE_HLS_URL ?? 'http://localhost:8080'

export default function SecureVideo({ contentId = 'poc' }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    const src = `${HLS_URL}/hls/${contentId}/index.m3u8`
    if (!Hls.isSupported()) return

    const hls = new Hls({
      // 🔑 On joint le JWT UNIQUEMENT sur la requête de clé (/keys/...)
      xhrSetup: (xhr, url) => {
        if (url.includes('/keys/')) {
          xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`)
        }
      },
    })
    hls.loadSource(src)
    hls.attachMedia(video)

    hls.on(Hls.Events.ERROR, (_e, data) => {
      // 401/403 sur la clé => accès refusé (token absent/expiré ou pas les droits)
      if (data.response?.code === 401 || data.response?.code === 403) {
        console.warn('Accès vidéo refusé :', data.response.code)
      }
    })
    return () => hls.destroy()
  }, [contentId])

  return <video ref={videoRef} controls style={{ width: '100%' }} />
}
```

### Endpoint clé (pour info — appelé par hls.js, pas par toi directement)
`GET /keys/:contentId` (Bearer) → **16 octets bruts** (`application/octet-stream`)
- **200** clé livrée · **401** sans/mauvais token · **403** pas les droits sur ce contenu · **404** contenu inconnu

### Test de bout en bout
1. Lancer la chaîne backend : `./scripts/demo-local.sh` (ou `docker compose up`).
2. Se connecter (alice / password), monter `<SecureVideo contentId="poc" />`.
3. La vidéo se lit. **Déconnecte-toi → recharge → la lecture échoue** (clé refusée) = preuve Zero-Trust.

---

## 3. Watermark de session (dissuasif, traçable)

`GET /security/watermark` (Bearer) → `{ label, username, sub, ts }`
`label` = `"alice#1 2026-06-30T..."`. À **incruster en surimpression** du lecteur.

```jsx
// au montage, récupérer le label puis l'afficher par-dessus la vidéo
const res = await authFetch('/security/watermark')
const { label } = await res.json()
// <div style={{ position:'absolute', opacity:.4, pointerEvents:'none' }}>{label}</div>
```

---

## 4. Dashboard sécurité (admin uniquement)

`GET /security/dashboard` (Bearer **admin**) → 
```json
{
  "generatedAt": "...",
  "thresholds": { ... },
  "counters": { "recentRequests": 0, "activeAlerts": 0, "uniqueIps": 0, "segmentRequests": 0 },
  "recentTraffic": [ { "ts","ip","account","path", ... } ],
  "alerts": [ { "ts","type","account","ip","detail","action" } ]
}
```
- **401** sans token · **403** si le compte n'est pas `admin`.
- Type d'alertes : `multi_session`, `proxy_ip`, `segment_scrape` ; `action` ∈ `flag` | `block`.
- Poller toutes les **2 s** (`setInterval`). Une page HTML de référence existe déjà : `backend/public/security.html`.

> Réutilise la logique de `security.html` mais en React si tu intègres le dashboard dans l'app.

---

## 5. Back-office multi-tenant (3 niveaux) ✅

Le token porte `role` ∈ `superadmin | admin | user` **et** `companyId`. L'UI s'adapte au rôle.

### Niveau 1 — SUPER-ADMIN (gère les entreprises et leurs admins)
| Méthode | Endpoint | Effet |
|---|---|---|
| `GET` | `/admin/companies` | liste des entreprises |
| `POST` | `/admin/companies` `{ name }` | créer une entreprise |
| `POST` | `/admin/companies/:id/admins` `{ username, password }` | créer un **admin** d'entreprise |

### Niveau 2 — ADMIN d'entreprise (scoppé à SA `companyId`)
| Méthode | Endpoint | Effet |
|---|---|---|
| `GET` | `/admin/users` | utilisateurs de **son** entreprise |
| `POST` | `/admin/users` `{ username, password }` | créer un **user** dans son entreprise |
| `GET` | `/admin/contents` | contenus de son entreprise `{ id, title, companyId, allowedUsernames[], revoked }` |
| `POST` | `/admin/contents` `{ title }` | créer un contenu |
| `POST` | `/admin/contents/:id/access` `{ username }` | donner l'accès (même entreprise) |
| `DELETE` | `/admin/contents/:id/access/:username` | retirer l'accès |
| `POST` | `/admin/contents/:id/revoke` \| `/restore` | 🔒 révoquer / rétablir la clé |

### Niveau 3 — USER
Pas d'accès `/admin/*` (→ `403`). Lit uniquement les contenus que son entreprise/admin autorise.

> **Isolation** : un admin/user ne voit/agit que dans sa `companyId`. Toute tentative
> cross-entreprise renvoie `404` (contenu masqué) ou `403`. La révocation/le retrait
> d'accès fait passer `GET /keys/:id` à `403`/`404` immédiatement.

```js
// SUPER-ADMIN : créer une entreprise puis son admin
const c = await (await authFetch('/admin/companies', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Acme' }) })).json()
await authFetch(`/admin/companies/${c.id}/admins`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'boss', password: 'secret123' }) })

// ADMIN : créer un user dans son entreprise + gérer les droits
await authFetch('/admin/users', { method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'dave', password: 'davepass' }) })
await authFetch('/admin/contents/poc/access', { method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'dave' }) })
await authFetch('/admin/contents/poc/revoke', { method: 'POST' }) // couper la clé en direct
```

---

## 6. Récap des endpoints

| Méthode | Endpoint | Auth | Retour |
|---|---|---|---|
| `POST` | `/auth/login` | non | `{ accessToken, user }` |
| `GET` | `/auth/me` | Bearer | utilisateur courant |
| `GET` | `/keys/:contentId` | Bearer (+droits) | 16 octets (clé AES) |
| `GET` | `/security/watermark` | Bearer | `{ label, username, sub, ts }` |
| `GET` | `/security/dashboard` | Bearer **admin** | état sécurité (JSON) |
| `GET`/`POST` | `/admin/companies[...]` | Bearer **superadmin** | entreprises + leurs admins |
| `GET`/`POST` | `/admin/users` | Bearer **admin** | users de son entreprise |
| `GET`/`POST` | `/admin/contents` | Bearer **admin** | contenus de son entreprise |
| `POST`/`DELETE` | `/admin/contents/:id/access[...]` | Bearer **admin** | gérer les droits |
| `POST` | `/admin/contents/:id/revoke` \| `/restore` | Bearer **admin** | révoquer / rétablir la clé |
| `GET` | `:8080/hls/:id/index.m3u8` | non* | playlist HLS |

\* la playlist/segments sont servis sans token (chiffrés) ; **seule la clé exige le token**.

### Codes d'erreur à gérer
| Code | Sens | Réaction front |
|---|---|---|
| 401 | token absent/expiré/invalide | `logout()` + retour login |
| 403 | pas les droits (contenu ou admin) | message « accès refusé » |
| 404 | contenu/clé inconnu | message « contenu introuvable » |
| 429 | rate-limit / compte verrouillé | message « trop de tentatives » |

---

## 7. Checklist d'implémentation (ordre conseillé)

- [ ] Ajouter `VITE_HLS_URL` + helpers `getRole()` / `isAdmin()` dans `auth.js`
- [ ] Intercepteur **401** global (token expiré → logout)
- [ ] Installer `hls.js`, créer `<SecureVideo>` avec `xhrSetup` (token sur `/keys/`)
- [ ] Vérifier le scénario Zero-Trust (connecté = lit / déconnecté = refusé)
- [ ] Incruster le **watermark** sur le lecteur
- [ ] (admin) Page **dashboard sécurité** (poll 2 s)
- [ ] Gérer proprement 401/403/404/429 (UX)
- [ ] (option) Back-office admin

---

## 8. Prérequis côté backend (à demander à P2)
- Le Core doit tourner (`./scripts/demo-local.sh` lance tout : Core + nginx + HLS chiffré).
- **CORS** est déjà ouvert pour le dev (le front Vite peut appeler `:3000` et `:8080`).
- Comptes de démo (mot de passe `password`) :
  - `root` → **superadmin** (global)
  - `alice` → **admin** de l'entreprise « Demo Corp » (`companyId = "demo"`)
  - `bob`, `carol` → **users** de Demo Corp
- Le contenu de démo est `contentId = "poc"` (appartient à `demo`).

> En cas de souci CORS/clé/HLS, pinguer **Enzo / l'équipe P2** : c'est leur périmètre.
