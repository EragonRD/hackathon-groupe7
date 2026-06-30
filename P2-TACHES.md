# 🔐 Pôle 2 — Infrastructure, Sécurité & Cloud · Liste des tâches

> **Brique :** Core (`backend/`, NestJS) · **Branche :** `backend-security`
> **Équipe :** Enzo (WMD, lead) · William (DAD) · Ryan (CCSN) · Gabriel (CCSN)
>
> 🎯 **On traite LES DEUX sujets :**
> **A — Diffusion « Zero-Trust »** *(chiffrement + serveur de clés)*
> **B — Détection & Anti-Scraping** *(détection d'abus temps réel)*
>
> Les deux vivent dans le même Core : A protège **l'accès au contenu**, B protège **contre l'abus**. Ils se complètent.

---

## ✅ Déjà fourni (à réutiliser, PAS à refaire)

L'authentification est **déjà câblée** dans `backend/src/auth/` :

- `POST /auth/login { username, password }` → **JWT court** + profil
- `AuthGuard` (header `Authorization: Bearer <token>`) → expose `req.user = { sub, username, role }`
- TTL configurable (`JWT_TTL`, défaut `15m`), secret via `JWT_SECRET`
- Comptes démo : `alice` (admin), `bob`, `carol` — mot de passe `password` (Argon2)
- Deps présentes : `@nestjs/jwt`, `argon2`
- ⛔ **À ajouter :** `@nestjs/throttler` (sujet B), outillage crypto/HLS (sujet A), Docker

---

## 🔐 SUJET A — Diffusion « Zero-Trust »

### A1. Préparer le contenu HLS chiffré *(amont, hors NestJS)*
- [x] Convertir `media/42 - POC Parc des Princes V1 .mp4` en **HLS** (`ffmpeg` → `.m3u8` + segments `.ts`)
- [x] Chiffrer les segments en **AES-128** (clé + IV ; `#EXT-X-KEY` dans la playlist)
- [x] L'URL de clé (`#EXT-X-KEY`) doit pointer vers le **Core**, jamais vers un fichier statique

### A2. Serveur de clés éphémères *(cœur noté — NestJS)*
- [x] Créer le module `keys/` : `GET /keys/:contentId` **protégé par `AuthGuard`**
- [x] Renvoyer la clé AES **uniquement si token valide** ; sinon **401 / 403 par défaut**
- [x] Vérifier explicitement le **refus si token expiré**
- [x] *(Bonus)* **Droits par contenu** : ce `user`/`role` a-t-il accès à CE `contentId` ?

### A3. Servir le flux HLS
- [x] Endpoint (ou Nginx) servant `.m3u8` + segments `.ts` chiffrés
- [ ] Côté lecteur : `xhrSetup` pour **envoyer le token** sur la requête de clé *(à caler avec P1 / Alex)*

### A4. Infra reproductible
- [x] **`docker-compose.yml`** : Core (NestJS) + origine HLS (Nginx) → **`docker-compose up` en 1 commande**
- [x] `.env.example` (`JWT_SECRET`, `JWT_TTL`, ports…)

### A5. Preuve de sécurité *(très regardé)*
- [x] Script/démo : **avec token → ça lit** · **sans token / expiré → clé refusée (401/403)**
- [x] **Journalisation** des accès clé (qui · quand · quel contenu)
- [ ] *(Bonus)* **Rotation / révocation** de clés

### A6. Modèle de menace *(livrable doc)*
- [x] **Schéma** : quoi protéger · contre quoi · hypothèses · **limites assumées**
- [x] Document court et honnête (couvert vs non couvert)

---

## 🛡️ SUJET B — Détection & Anti-Scraping

### B1. Socle rate-limiting
- [ ] `npm i @nestjs/throttler` → **rate-limiting** global sur le Core
- [ ] Brancher chaque requête à un **compte** (via `req.user` du JWT existant)

### B2. Règles de détection *(au moins ces 3, temps réel)*
- [ ] **Sessions simultanées anormales** : compteur IP/compte sur **fenêtre glissante**
- [ ] **IP suspectes** (VPN/proxy) : liste de réputation **FireHOL / IP2Proxy** chargée **hors-ligne**
- [ ] **Débit de scraping** : détection de **patterns séquentiels** sur les segments `.ts`
- [ ] *(Bonus)* géoloc incohérente, CIDR / ASN, corrélation multi-signaux

### B3. Réaction & visibilité
- [ ] **Réaction visible** : logs structurés + **petit dashboard temps réel**
- [ ] Stratégie de blocage (throttle → block → ban temporaire) documentée
- [ ] **Watermark visible** lié à la session (dissuasif / traçable) *(à voir avec P1)*

### B4. Démo d'attaque
- [ ] **Scripts d'attaque** (multi-session, scraping de segments, IP proxy)
- [ ] Montrer : l'abus **passe AVANT**, est **bloqué APRÈS**

### B5. Documentation
- [ ] Règles **documentées** + **limites assumées**
- [ ] ⚠️ Assumer que la **capture d'écran** est quasi indétectable → signaux *best-effort* + watermark

---

## 🧩 Intégration (Bloc B — avec les autres pôles)
- [ ] Caler avec **Alex (P1)** : le lecteur React envoie le token sur la requête de clé (A) et porte le watermark (B)
- [ ] Conserver le **même JWT** que l'auth existante (une seule identité pour A **et** B)
- [ ] Valider le scénario complet : *login → ouvrir vidéo → Core délivre la clé (A) + surveille l'abus (B) → ça lit*

---

## 👥 Répartition interne P2 *(sur les 2 sujets)*

| Membre | Profil | Sujet A (Zero-Trust) | Sujet B (Anti-Scraping) |
|---|---|---|---|
| **Enzo** | WMD (lead, code) | Module `keys/`, délivrance clé AES, intégration JWT | Architecture du `throttler` + middleware de détection |
| **William** | DAD (code) | `docker-compose` + Nginx HLS, chiffrement ffmpeg | Dashboard temps réel + intégration des règles |
| **Ryan** | CCSN | Modèle de menace, TTL / rotation, durcissement | Règles VPN/proxy (listes réputation), fenêtre glissante |
| **Gabriel** | CCSN | Preuve de sécu (token / pas token), journalisation | **Scripts d'attaque** + mesure vrais/faux positifs |

---

## 📌 Décisions à figer en premier
1. Figer le **contrat d'interface** clé ↔ lecteur avec P1 (format de la requête de clé + token).
2. Poser les **squelettes** : module `keys/` (A) + module `security`/`throttler` (B) dès J1.
3. Préparer le **`docker-compose.yml`** commun (Core + Nginx) qui sert les deux sujets.
