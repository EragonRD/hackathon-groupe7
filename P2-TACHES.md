# 🔐 Pôle 2 — Infrastructure, Sécurité & Cloud · Liste des tâches

> **Brique :** Core (`backend/`, NestJS) · **Branche :** `backend-security`
> **Équipe :** Enzo (WMD, lead) · William (DAD) · Ryan (CCSN) · Gabriel (CCSN)
>
> 🎯 **Sujet retenu : A — Diffusion « Zero-Trust »** *(le sujet B figure plus bas en alternative / bonus).*

---

## ✅ Déjà fourni (à réutiliser, PAS à refaire)

L'authentification est **déjà câblée** dans `backend/src/auth/` :

- `POST /auth/login { username, password }` → **JWT court** + profil
- `AuthGuard` (header `Authorization: Bearer <token>`) → expose `req.user = { sub, username, role }`
- TTL configurable (`JWT_TTL`, défaut `15m`), secret via `JWT_SECRET`
- Comptes démo : `alice` (admin), `bob`, `carol` — mot de passe `password` (Argon2)
- Deps présentes : `@nestjs/jwt`, `argon2`
- ⛔ **Manquant** (à ajouter selon le sujet) : `@nestjs/throttler`, outillage crypto/HLS, Docker

---

## 🔐 SUJET A — Diffusion « Zero-Trust » (cœur du pôle)

### 1. Préparer le contenu HLS chiffré *(amont, hors NestJS)*
- [ ] Convertir `media/42 - POC Parc des Princes V1 .mp4` en **HLS** (`ffmpeg` → `.m3u8` + segments `.ts`)
- [ ] Chiffrer les segments en **AES-128** (clé + IV ; `#EXT-X-KEY` dans la playlist)
- [ ] L'URL de clé (`#EXT-X-KEY`) doit pointer vers le **Core**, jamais vers un fichier statique

### 2. Serveur de clés éphémères *(cœur noté — NestJS)*
- [ ] Créer le module `keys/` : `GET /keys/:contentId` **protégé par `AuthGuard`**
- [ ] Renvoyer la clé AES **uniquement si token valide** ; sinon **401 / 403 par défaut**
- [ ] Vérifier explicitement le **refus si token expiré**
- [ ] *(Bonus)* **Droits par contenu** : ce `user`/`role` a-t-il accès à CE `contentId` ?

### 3. Servir le flux HLS
- [ ] Endpoint (ou Nginx) servant `.m3u8` + segments `.ts` chiffrés
- [ ] Côté lecteur : `xhrSetup` pour **envoyer le token** sur la requête de clé *(à caler avec P1 / Alex)*

### 4. Infra reproductible
- [ ] **`docker-compose.yml`** : Core (NestJS) + origine HLS (Nginx) → **`docker-compose up` en 1 commande**
- [ ] `.env.example` (`JWT_SECRET`, `JWT_TTL`, ports…)

### 5. Preuve de sécurité *(très regardé)*
- [ ] Script/démo : **avec token → ça lit** · **sans token / expiré → clé refusée (401/403)**
- [ ] **Journalisation** des accès clé (qui · quand · quel contenu)
- [ ] *(Bonus)* **Rotation / révocation** de clés

### 6. Modèle de menace *(livrable doc)*
- [ ] **Schéma** : quoi protéger · contre quoi · hypothèses · **limites assumées**
- [ ] Document court et honnête (couvert vs non couvert)

---

## 🛡️ SUJET B — Détection & Anti-Scraping *(alternative, ou bonus d'intégration)*

> Même en faisant A, ajouter le **rate-limiter** au Core est un bon point pour le Bloc B.

- [ ] `npm i @nestjs/throttler` → **rate-limiting** global
- [ ] Détecter **sessions simultanées anormales** (compteur IP/compte, fenêtre glissante)
- [ ] Détecter **IP suspectes** (VPN/proxy — liste FireHOL / IP2Proxy chargée **hors-ligne**)
- [ ] Détecter **débit de scraping** (patterns séquentiels sur les segments `.ts`)
- [ ] **Réaction visible** : logs + petit dashboard temps réel
- [ ] **Watermark visible** lié à la session (dissuasif / traçable) *(à voir avec P1)*
- [ ] Démo avec **scripts d'attaque** (l'abus passe *avant*, bloqué *après*)
- [ ] Règles **documentées** + **limites assumées** (ex. capture d'écran ≈ indétectable)

---

## 🧩 Intégration (Bloc B — avec les autres pôles)
- [ ] Caler avec **Alex (P1)** : le lecteur React envoie le token sur la requête de clé
- [ ] Conserver le **même JWT** que l'auth existante (une seule identité)
- [ ] Valider le scénario complet : *login → ouvrir vidéo → Core délivre la clé → ça lit*

---

## 👥 Répartition interne P2

| Membre | Profil | Focus |
|---|---|---|
| **Enzo** | WMD (lead, code) | Module `keys/`, délivrance clé AES, intégration JWT |
| **William** | DAD (code) | `docker-compose` + Nginx HLS, branchement Core |
| **Ryan** | CCSN | Modèle de menace, TTL / rotation, durcissement |
| **Gabriel** | CCSN | Preuve de sécu (token / pas token), journalisation, scripts d'attaque |

---

## 📌 Décisions à figer en premier
1. **Confirmer A vs B** (recommandé : **A**, s'intègre direct au JWT déjà présent).
2. Figer le **contrat d'interface** clé ↔ lecteur avec P1 (format de la requête de clé + token).
3. Poser le **squelette `keys/`** + le **`docker-compose.yml`** dès J1.
