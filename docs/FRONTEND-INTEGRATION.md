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
| `POST` | `/admin/companies/:id/invite-admin` `{ email }` | **inviter** l'admin (mdp temporaire 24 h envoyé par mail ; la réponse renvoie aussi `link` + `tempPassword`) |

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

### Onboarding d'un admin invité (1ʳᵉ connexion)
Le token d'un admin invité porte `mustChangePassword: true` et le panel est **bloqué**
(`403`) tant qu'il n'a pas changé son mot de passe temporaire :
```js
// après login avec le mot de passe temporaire reçu par mail
const res = await authFetch('/auth/change-password', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ currentPassword: tempPassword, newPassword: 'NouveauMdp2026' }),
})
const { accessToken } = await res.json()   // nouveau token, mustChangePassword = false
localStorage.setItem('hackathon_token', accessToken)
```

> **Isolation** : un admin/user ne voit/agit que dans sa `companyId`. Toute tentative
> cross-entreprise renvoie `404` (contenu masqué) ou `403`. La révocation/le retrait
> d'accès fait passer `GET /keys/:id` à `403`/`404` immédiatement.

```js
// SUPER-ADMIN : créer une entreprise puis inviter son admin (par email)
const c = await (await authFetch('/admin/companies', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Acme' }) })).json()
const invite = await (await authFetch(`/admin/companies/${c.id}/invite-admin`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'rep@acme.com' }) })).json()
// invite.invitation = { email, link, tempPassword, expiresAt }

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

---

## 9. 🆕 Récap des ajouts récents (multi-tenant, invitations, sécurité)

Cette section résume tout ce qui a été ajouté côté backend depuis la 1ʳᵉ version de ce guide.

### 9.1 Modèle d'identité enrichi
Le JWT porte désormais **`role`** (`superadmin | admin | user`), **`companyId`** et
**`mustChangePassword`**. Helpers conseillés dans `auth.js` :
```js
export function getClaims() {
  const t = getToken(); if (!t) return null
  try { return JSON.parse(atob(t.split('.')[1])) } catch { return null }
}
export const getRole       = () => getClaims()?.role ?? null
export const getCompanyId  = () => getClaims()?.companyId ?? null
export const isAdmin       = () => ['admin','superadmin'].includes(getRole())
export const isSuperAdmin  = () => getRole() === 'superadmin'
export const mustChangePwd = () => Boolean(getClaims()?.mustChangePassword)
```
La réponse de `/auth/login` renvoie aussi `user.{role,companyId,mustChangePassword}`.

### 9.2 Onboarding d'un admin invité (mot de passe temporaire 24 h)
Workflow imposé par le produit :
1. **Super-admin** invite : `POST /admin/companies/:id/invite-admin { email }`
   → réponse `{ invited, invitation:{ email, link, tempPassword, expiresAt }, delivery, message }`.
   L'email part via **Mailjet** s'il est configuré, sinon `delivery.provider === "simulated"`
   (le `link` + `tempPassword` sont quand même dans la réponse).
2. L'admin se connecte avec le **mot de passe temporaire** → `mustChangePassword: true`,
   et **tout `/admin/*` est bloqué (403)** tant qu'il n'a pas changé son mot de passe.
3. `POST /auth/change-password { currentPassword, newPassword }` (≥ 8 car., différent)
   → **nouveau token** sans le flag ; stocker ce token et continuer.
4. Au-delà de 24 h, le mot de passe temporaire est **refusé** au login (`401`).

Côté UX : si `mustChangePwd()` est vrai après login, **rediriger vers un écran
« changer mon mot de passe »** avant d'afficher le panel.

### 9.3 Back-office multi-tenant (3 niveaux) — endpoints
**Super-admin** (`role = superadmin`)
| Méthode | Endpoint | Corps |
|---|---|---|
| `GET` | `/admin/companies` | — |
| `POST` | `/admin/companies` | `{ name }` |
| `POST` | `/admin/companies/:id/invite-admin` | `{ email }` |

**Admin d'entreprise** (scoppé à sa `companyId` ; superadmin = global)
| Méthode | Endpoint | Corps |
|---|---|---|
| `GET` | `/admin/users` | — |
| `POST` | `/admin/users` | `{ username, password }` |
| `GET` | `/admin/contents` | — |
| `POST` | `/admin/contents` | `{ title }` |
| `POST` | `/admin/contents/:id/access` | `{ username }` |
| `DELETE` | `/admin/contents/:id/access/:username` | — |
| `POST` | `/admin/contents/:id/revoke` \| `/restore` | — |

> **Isolation** : un admin/user ne voit/agit que dans sa `companyId`. Tout accès
> cross-entreprise renvoie **404** (existence masquée) ou **403**. On ne peut donner
> l'accès qu'à un user **de la même entreprise** que le contenu.

### 9.4 Codes d'erreur supplémentaires
| Code | Cas |
|---|---|
| `403` | rôle insuffisant **ou** `mustChangePassword` non résolu (panel verrouillé) |
| `404` | contenu/entreprise hors de SA `companyId` (masqué) |
| `409` | email déjà admin / username déjà pris |
| `400` | email invalide, mot de passe trop court, `companyId` manquant (superadmin) |

### 9.5 Écrans suggérés selon le rôle
- **Super-admin** : liste des entreprises · créer une entreprise · inviter un admin (formulaire email) · afficher l'invitation renvoyée.
- **Admin** : (1ʳᵉ connexion → changer le mot de passe) · liste/création d'users · liste/création de contenus · gestion des droits + révocation de clé · dashboard sécurité.
- **User** : lecteur vidéo (`<SecureVideo>`) limité aux contenus autorisés.

### 9.6 Checklist complémentaire
- [ ] Helpers `getRole/getCompanyId/isSuperAdmin/mustChangePwd`
- [ ] Écran **changement de mot de passe** (redirection si `mustChangePassword`)
- [ ] Vues **super-admin** (entreprises + invitations) et **admin** (users + contenus)
- [ ] Adapter le menu/navigation au `role`
- [ ] Gérer `409`/`400` dans les formulaires (messages clairs)

---

## 10. 🆕 Dernières nouveautés (streaming, refresh tokens, bans, audit)

### 10.1 ⭐ Streaming HLS servi par le Core (same-origin → tunnel OK)
Le Core sert maintenant la vidéo chiffrée, avec l'**URI de clé réécrite en relatif**.
Plus besoin de viser `:8080` : tout passe par la même origine (donc le tunnel).

| Méthode | Endpoint | Auth | Retour |
|---|---|---|---|
| `GET` | `/videos/:contentId/index.m3u8` | non* | playlist (clé pointée sur `/keys/:id`) |
| `GET` | `/videos/:contentId/:segment.ts` | non* | segment chiffré (+ détection scraping) |

\* le flux est chiffré ; **seule la clé** (`/keys/:id`) exige le token.

**Le composant `<SecureVideo>` doit désormais pointer sur `/videos/…` (relatif)** :
```jsx
const src = `/videos/${contentId}/index.m3u8`   // même origine → marche via le tunnel
const hls = new Hls({
  xhrSetup: (xhr, url) => {
    if (url.includes('/keys/')) xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`)
  },
})
hls.loadSource(src); hls.attachMedia(video)
```
> ⚠️ **Prérequis infra (P2)** : le nginx du front doit proxifier `location /videos/ → core:3000`,
> et le conteneur `core` doit voir `media/hls` (`HLS_DIR`). Sans ça, `/videos/…` renvoie l'index SPA.

### 10.2 Refresh tokens + vrai logout
`login` et `change-password` renvoient désormais **`refreshToken`** en plus de `accessToken`.

| Méthode | Endpoint | Corps | Effet |
|---|---|---|---|
| `POST` | `/auth/refresh` | `{ refreshToken }` | nouvel `accessToken` (+ **rotation** : l'ancien refresh est invalidé) |
| `POST` | `/auth/logout` | `{ refreshToken }` | **révoque** le refresh (vrai logout, 204) |

Reco front : stocker `refreshToken` (localStorage), et sur un **401** d'`authFetch`,
tenter `/auth/refresh` → si OK rejouer la requête, sinon `logout()` + retour login.
```js
// auth.js — remplacer le logout local par un vrai logout serveur
export async function logout() {
  const rt = localStorage.getItem('hackathon_refresh')
  if (rt) await fetch(`${API}/auth/logout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  }).catch(() => {})
  localStorage.removeItem('hackathon_token')
  localStorage.removeItem('hackathon_refresh')
}
```

### 10.3 Bans d'IP (admin) — action depuis le dashboard sécu
| Méthode | Endpoint | Corps |
|---|---|---|
| `GET` | `/security/bans` | — |
| `POST` | `/security/ban` | `{ ip, reason? }` |
| `DELETE` | `/security/ban/:ip` | — |

Une IP bannie reçoit **403** sur toutes les routes (appliqué par le middleware).
UI : bouton « Bannir » à côté de chaque IP suspecte du dashboard.

### 10.4 Journal d'accès aux clés (audit)
| Méthode | Endpoint | Auth | Retour |
|---|---|---|---|
| `GET` | `/admin/audit/keys` | Bearer **admin** | `[{ ts, username, sub, contentId, ip, result, reason }]` (récents d'abord, scoppé entreprise) |

UI : table « Journal d'accès » dans le back-office (qui a lu quelle clé, quand, depuis quelle IP, accordé/refusé).

### 10.5 Récap des nouvelles routes
| Méthode | Endpoint | Auth |
|---|---|---|
| `GET` | `/videos/:id/index.m3u8` · `/videos/:id/:seg.ts` | public (chiffré) |
| `POST` | `/auth/refresh` · `/auth/logout` | public (via le refresh token) |
| `GET/POST/DELETE` | `/security/ban[s]` | admin |
| `GET` | `/admin/audit/keys` | admin |
