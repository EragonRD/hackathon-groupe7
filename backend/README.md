# Backend — API NestJS (Core) · Pôle 2

> Brique **Core** de la plateforme vidéo : authentification, délivrance de clé HLS
> Zero-Trust, détection anti-scraping et back-office multi-tenant.
> Contexte général : [README racine](../README.md).

---

## 🚀 Démarrage rapide

```bash
npm install
npm run start:dev          # API en watch → http://localhost:3000
```

Démo complète (chiffrement HLS + nginx + attaques) en une commande :

```bash
../scripts/demo-local.sh   # nécessite ffmpeg + nginx
```

Déploiement conteneurisé (depuis la racine) :

```bash
export JWT_SECRET=$(openssl rand -hex 32)   # OBLIGATOIRE (refus de démarrer sinon en prod)
docker compose up --build
```

---

## 🏛️ Architecture (modules)

| Module | Rôle |
|---|---|
| `auth/` | login, JWT, guards (Auth/Admin/SuperAdmin/PasswordChanged), changement de mot de passe |
| `keys/` | serveur de **clé AES éphémère** (Zero-Trust, P2-A) |
| `security/` | rate-limit, détection d'abus temps réel, dashboard, watermark (P2-B) |
| `companies/` | entreprises (tenants) |
| `contents/` | catalogue + droits d'accès par contenu (multi-tenant) |
| `admin/` | back-office (super-admin & admin d'entreprise) |
| `email/` | envoi d'invitation (simulé en dev) |
| `common/` | helpers (IP cliente, pair de confiance, types JWT) |

---

## 👥 Modèle de rôles (multi-tenant, 3 niveaux)

| Rôle | Périmètre | Peut |
|---|---|---|
| **superadmin** | global | créer des **entreprises**, **inviter** leurs admins, tout voir |
| **admin** | 1 entreprise | créer des **users** de son entreprise, gérer contenus & droits, révoquer une clé |
| **user** | 1 entreprise | accéder aux contenus que son entreprise lui autorise |

Le JWT porte : `{ sub, username, role, companyId, mustChangePassword }`.

### Comptes de démo (mot de passe `password`)
| Compte | Rôle | Entreprise |
|---|---|---|
| `root` | superadmin | — |
| `alice` | admin | `demo` (Demo Corp) |
| `bob`, `carol` | user | `demo` |

Contenu de démo : `poc` (entreprise `demo`).

---

## 🔑 Workflow d'onboarding d'une entreprise

1. Le **super-admin** crée l'entreprise puis **invite** son admin par email :
   `POST /admin/companies/:id/invite-admin { email }` → génère un **mot de passe
   temporaire valable 24 h** et « envoie » le lien au représentant (email simulé en
   dev : voir les logs ; la réponse contient aussi `link` + `tempPassword`).
2. L'**admin** se connecte avec le mot de passe temporaire. Tant qu'il ne l'a pas
   changé, le panel est **bloqué** (`403`).
3. Il appelle `POST /auth/change-password { currentPassword, newPassword }` →
   reçoit un **nouveau token** et accède à son panel.
4. Au-delà de 24 h sans activation, le mot de passe temporaire est **refusé** au login.

---

## 🌐 Référence des routes

Authentification : `Authorization: Bearer <jwt>`. Codes : `401` non/mauvais token,
`403` droits insuffisants, `404` introuvable / hors-tenant, `409` conflit, `429` rate-limit/verrou.

### Auth
| Méthode | Route | Accès | Description |
|---|---|---|---|
| `POST` | `/auth/login` | public (10/min/IP + verrou) | `{username,password}` → `{accessToken,user}` |
| `GET` | `/auth/me` | Bearer | utilisateur courant |
| `POST` | `/auth/change-password` | Bearer | `{currentPassword,newPassword}` → nouveau token |

### Zero-Trust (P2-A)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/keys/:contentId` | Bearer + droits + même entreprise + non révoqué | renvoie la **clé AES (16 octets)** |

### Sécurité (P2-B)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/security/dashboard` | Bearer **admin** | trafic, alertes, compteurs |
| `GET` | `/security/watermark` | Bearer | label de session (incrustation) |
| `ALL` | `/security/ingest` | **interne** (nginx/loopback) | comptage segments + blocage scraping |

### Back-office — Super-admin
| Méthode | Route | Description |
|---|---|---|
| `GET` | `/admin/companies` | liste des entreprises |
| `POST` | `/admin/companies` | `{name}` → crée une entreprise |
| `POST` | `/admin/companies/:id/invite-admin` | `{email}` → invite l'admin (mdp temporaire 24 h) |

### Back-office — Admin d'entreprise (scoppé, superadmin = global)
| Méthode | Route | Description |
|---|---|---|
| `GET` | `/admin/users` | users de son entreprise |
| `POST` | `/admin/users` | `{username,password}` → crée un user |
| `GET` | `/admin/contents` | contenus de son entreprise |
| `POST` | `/admin/contents` | `{title}` → crée un contenu |
| `POST` | `/admin/contents/:id/access` | `{username}` → donne l'accès (même entreprise) |
| `DELETE` | `/admin/contents/:id/access/:username` | retire l'accès |
| `POST` | `/admin/contents/:id/revoke` | 🔒 révoque la clé (lecture bloquée) |
| `POST` | `/admin/contents/:id/restore` | rétablit la clé |

> Les routes `/admin/*` exigent aussi que le mot de passe temporaire ait été changé
> (`PasswordChangedGuard`), sinon `403`.

---

## 🛡️ Sécurités en place

### Authentification & identité
- **Mots de passe** hachés en **Argon2id** (jamais en clair).
- **JWT court** (TTL `15m` par défaut), **secret fort obligatoire en prod** : le Core
  **refuse de démarrer** si `JWT_SECRET` est absent/faible/`<16` car. (`NODE_ENV=production`).
- **Algorithme épinglé `HS256`** (signature + vérification) → bloque la confusion
  d'algorithme (ex. `alg=none`).
- **Verrouillage de compte** après 5 échecs (`429`) + **rate-limit login** 10/min/IP.
- **Anti-énumération d'utilisateurs** : vérification Argon2 à **temps constant** (hash leurre).
- **Mots de passe temporaires** d'invitation à expiration **24 h** + **changement forcé**.

### Autorisation
- Guards : `AuthGuard` (JWT), `AdminGuard` (admin|superadmin), `SuperAdminGuard`,
  `PasswordChangedGuard`.
- **Isolation multi-tenant** : un admin/user ne voit/agit que dans sa `companyId` ;
  toute tentative cross-entreprise renvoie `404` (existence masquée).

### Zero-Trust (contenu)
- Diffusion **HLS chiffrée AES-128** ; la **clé n'est délivrée que sur token valide**,
  avec **droits par contenu** dynamiques et **refus par défaut**.
- **Anti path-traversal** sur `contentId` (regex + contrôle d'accès **avant** lecture).
- **Révocation de clé en direct** : couper l'accès à un contenu immédiatement.
- **Journalisation** des accès clé (`logs/key-access.log`).

### Anti-scraping & abus (temps réel)
- **Rate-limit global** 100 req/60s/IP (`@nestjs/throttler`).
- Détections : **sessions simultanées** anormales, **IP proxy/VPN** (liste hors-ligne),
  **scraping de segments** (avec **blocage réel** via `auth_request` nginx → `403`).
- **Watermark de session** dissuasif/traçable.
- **Anti-usurpation d'IP** : `X-Forwarded-For` honoré uniquement derrière un proxy de
  confiance (`TRUST_PROXY`).
- **Endpoint interne** `/security/ingest` réservé au reverse-proxy / loopback.
- **Dashboard** réservé aux admins (n'expose pas comptes/IP en public).

### Limites assumées (documentées)
Pas de TLS en local · JWT non révocable avant expiration · clé unique par contenu ·
scraping distribué · capture d'écran. Voir [`docs/P2-threat-model.md`](../docs/P2-threat-model.md).

---

## ⚙️ Variables d'environnement

> 📂 **Chargement des `.env`** : au démarrage, le Core charge automatiquement
> (via `dotenv`, voir `src/load-env.ts`) le **`.env` à la racine du dépôt** et
> `backend/.env`. Priorité : variables déjà exportées dans le shell > `.env` le plus
> proche du dossier de lancement > les autres (dotenv n'écrase jamais une variable
> existante). En **Docker**, c'est le **`.env` racine** que `docker compose` injecte.
> 👉 Conseil : mettez vos secrets dans le **`.env` racine** (commun local + Docker).
> Les `.env` sont **gitignorés** — ne jamais les committer.


| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | port d'écoute |
| `JWT_SECRET` | `dev-secret-change-me` (dev) | **secret JWT** — obligatoire et fort en prod |
| `JWT_TTL` | `15m` | durée de vie du token |
| `TRUST_PROXY` | `loopback, uniquelocal` | proxies de confiance pour `X-Forwarded-For` |
| `APP_URL` | `http://localhost:5173` | base du lien d'invitation (front) |
| `MAILJET_API_KEY` | — | clé API Mailjet (envoi des invitations) |
| `MAILJET_SECRET_KEY` | — | clé secrète Mailjet |
| `MAILJET_FROM_EMAIL` | — | expéditeur (adresse validée chez Mailjet) |
| `MAILJET_FROM_NAME` | `Plateforme Vidéo` | nom de l'expéditeur |
| `MAILJET_SANDBOX` | `false` | `true` = valide l'appel sans délivrer |
| `NODE_ENV` | — | `production` active le fail-fast du secret |

> 📧 **Email** : l'invitation est envoyée via **Mailjet** (API v3.1). Sans les 3 clés
> `MAILJET_*`, le service **retombe en simulation** (log + lien/mdp renvoyés dans la
> réponse HTTP) — la démo fonctionne donc sans compte Mailjet.

---

## 🧪 Vérifier la sécurité

```bash
../scripts/prove-zero-trust.sh        # clé : 200 avec token, 401 sans / expiré
../scripts/attacks/proxy-ip.sh        # détection IP proxy
../scripts/attacks/multi-session.sh   # sessions simultanées
../scripts/attacks/flood.sh           # rate-limit 429
../scripts/attacks/scrape-segments.sh # scraping détecté + bloqué
```

Build & lint :

```bash
npm run build && npm run lint
```

---

## 📚 Documents liés
- [`docs/P2-threat-model.md`](../docs/P2-threat-model.md) — modèle de menace
- [`docs/P2-anti-scraping.md`](../docs/P2-anti-scraping.md) — règles de détection
- [`docs/FRONTEND-INTEGRATION.md`](../docs/FRONTEND-INTEGRATION.md) — intégration front
- [`SECURITY.md`](SECURITY.md) — commandes de démo sécurité
