# README — Soutenance Poulpium (Groupe 7 · ESTIAM)

Plateforme de **revue vidéo collaborative** — architecture **View / Core / Engine**.
Ce document sert de **guide de soutenance** : d'abord la présentation, puis le
lancement de chaque brique avec ses `.env`.

> Prérequis généraux : **Node ≥ 18** (testé 22), **Python ≥ 3.11**, **ffmpeg**,
> **git**. Tout tourne **100 % en local** (aucun service cloud payant requis).

---

## 1. Lancer la présentation

Un **serveur unique, identique sur Windows / macOS / Linux** (Node natif, zéro
dépendance à installer). Depuis la **racine du dépôt** :

```bash
node docs/presentations/serve-presentation.mjs
```

Le navigateur s'ouvre sur un **index cliquable** de toutes les présentations
(port **8090** par défaut). Navigation dans un deck : flèches **← / →**.

Options :

```bash
node docs/presentations/serve-presentation.mjs --port 9000   # changer de port
node docs/presentations/serve-presentation.mjs --no-open      # ne pas ouvrir le navigateur
```

- **Windows** : `PowerShell` ou `cmd`, même commande (`node docs\presentations\serve-presentation.mjs`).
- **Réseau** : le serveur affiche aussi une URL `http://<ip-LAN>:8090/` pour
  projeter depuis un autre poste.

> ℹ️ **Pourquoi un serveur et pas un double-clic sur le `.html` ?** Le deck
> principal intègre le **dashboard Engine dans une iframe** (slide interactive) ;
> en `file://` l'iframe est bloquée. En `http://`, tout s'affiche.

> ⚠️ Pour que la **slide dashboard** du deck principal soit vivante, lancez
> d'abord le dashboard Engine (voir §3.3) :
> `cd engine && streamlit run dashboard/app.py`

---

## 2. Les présentations

Toutes dans `docs/presentations/`.

| Deck | Fichier | Contenu |
|---|---|---|
| **Soutenance (principal)** | `Poulpium-Soutenance.html` | Deck **complet fusionné** : garde + équipe + P1 + P2 + P3 + **dashboard interactif** + bonus + prod + démo. **À utiliser le jour J.** |
| Page de garde — équipe | `Page-de-Garde-Groupe7.html` | Trombinoscope des 15 membres par pôle. |
| Pôle 1 — View | `P1-Frontend-Soutenance.html` | Lecteur de revue, annotation, temps réel, Watch Together. |
| Pôle 2 — Core | `P2-Backend-Soutenance.html` | Zero-Trust (clé AES éphémère), anti-abus, audit + scans grype/trivy. |
| Pôle 3 — Engine | `P3-IA-Soutenance.html` | Pipeline NLP, rétention & prévision. |
| Déploiement | `William-Deploiement.html` | Cloudflare Tunnel, docker compose + GHCR, Watchtower. |

**Script de passage (mot à mot)** : `docs/presentations/soutenance-script.md`
(qui parle, quand, sur quelle slide — ~15 min + démo).

---

## 3. Lancer l'application (démo live)

### Vue d'ensemble des ports

| Brique | Techno | Port | Rôle |
|---|---|---|---|
| Présentation | Node | **8090** | Serveur des decks (ce README §1) |
| **Core** (backend) | NestJS | **3000** | Auth, clé AES, orchestration, flux HLS |
| **View** (frontend) | React/Vite | **5173** | Interface de revue |
| **Engine** (API) | FastAPI | **8000** | Pipeline IA (transcription, résumé…) |
| Dashboard Engine | Streamlit | **8501** | Rétention & prévision (slide interactive) |
| Engine data API *(bonus)* | FastAPI | **8010** | API JSON des données 3-B |

**Ordre de démarrage conseillé** : Core → Engine → Frontend.

---

### 3.1 Core — backend (NestJS · port 3000)

```bash
cd backend
npm install
cp .env.example .env        # puis éditer (voir ci-dessous)
npm run start:dev           # http://localhost:3000
```

**`backend/.env`** — le fichier d'exemple est vide ; voici un `.env` **prêt pour la démo locale** :

```dotenv
# --- Obligatoire ---
# Secret de signature JWT (HS256). En prod : fort et secret.
#   Générer : openssl rand -hex 32
JWT_SECRET=dev-secret-change-me-32-chars-minimum
# Durée de vie des tokens d'accès.
JWT_TTL=15m

# --- Réseau / intégration ---
PORT=3000                              # port d'écoute du Core
APP_URL=http://localhost:5173          # origine du frontend (liens d'invitation)
ENGINE_URL=http://localhost:8000       # URL de l'Engine (Pôle 3)

# --- Encodage / stockage ---
# Dossier des rendus HLS chiffrés (défaut interne si absent).
# HLS_DIR=./media/hls
# Nombre d'encodages ffmpeg simultanés (borne la charge CPU).
MAX_CONCURRENT_ENCODES=2

# --- Divers (valeurs par défaut correctes en local) ---
NODE_ENV=development
# TRUST_PROXY=loopback, uniquelocal    # derrière un proxy/tunnel en prod
# MONO_SESSION=false                   # true = une seule session active par compte

# --- E-mails (OPTIONNEL — invitations par mail via Mailjet) ---
# Laisser vide pour désactiver l'envoi (aucun impact sur la démo).
# MAILJET_API_KEY=
# MAILJET_SECRET_KEY=
# MAILJET_FROM_EMAIL=no-reply@exemple.com
# MAILJET_FROM_NAME=Plateforme Vidéo
# MAILJET_SANDBOX=true
```

> **ffmpeg requis** côté Core : il ré-encode chaque upload en HLS chiffré. Si
> `ffmpeg` n'est pas dans le PATH, l'upload reste bloqué en « chiffrement » puis
> `failed`. Vérifier : `ffmpeg -version`.

**Comptes de démo** (mot de passe : `password`) : `alice` (admin), `bob`, `carol`.

---

### 3.2 View — frontend (React/Vite · port 5173)

```bash
cd frontend
npm install
cp .env.example .env.local   # puis éditer si besoin
npm run dev                  # http://localhost:5173
```

**`frontend/.env.local`** :

```dotenv
# URL du Core. En LAN multi-postes : mettre l'IP de la machine du backend
# (ex. http://192.168.1.42:3000), PAS localhost.
VITE_API_URL=http://localhost:3000

# Serveur HLS (playlist .m3u8 + segments chiffrés). La CLÉ, elle, n'est servie
# QUE par le Core sur jeton valide (cœur du Zero-Trust).
VITE_HLS_URL=http://localhost:8080

# Transport temps réel :
#   broadcast (défaut) -> multi-fenêtres d'UNE machine, 100% offline, sans backend.
#   socket             -> LAN 2-3 machines via la gateway socket.io du Core.
VITE_COLLAB_MODE=broadcast
```

> Build de production : `npm run build` → `frontend/dist/` (servi par nginx en prod).

---

### 3.3 Engine — IA & Data (FastAPI · port 8000 + dashboard 8501)

```bash
cd engine
python3 -m venv .venv
# Activer : macOS/Linux -> source .venv/bin/activate | Windows -> .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env          # puis renseigner au moins une clé (voir ci-dessous)

# API IA (transcription, résumé, chapitres) :
uvicorn app.main:app --reload --port 8000        # http://localhost:8000

# Dashboard rétention (slide interactive du deck) :
streamlit run dashboard/app.py                   # http://localhost:8501
```

**`engine/.env`** — providers **par étape** (mixables). Au moins **une clé** selon le provider choisi :

```dotenv
# Provider par étape : groq | openrouter | gemini | local
ENGINE_ASR_PROVIDER=groq          # transcription (groq ou local ; OpenRouter/Gemini = pas d'audio)
ENGINE_LLM_PROVIDER=groq          # résumé / chapitres
ENGINE_TRANSLATE_PROVIDER=groq    # traduction

# true  = repli LOCAL auto si l'API échoue/absente (modèles locaux requis).
# false = 100 % API strict (mots-clés + recherche sémantique locale désactivés).
ENGINE_ALLOW_LOCAL_FALLBACK=true

# --- Clés API (renseigner celle(s) du/des provider(s) choisi(s)) ---
GROQ_API_KEY=                     # https://console.groq.com/keys
OPENROUTER_API_KEY=               # https://openrouter.ai/keys
GEMINI_API_KEY=                   # https://aistudio.google.com/apikey

# --- Auth service (le Core signe un token de service en HS256) ---
# DOIT valoir le MÊME secret que backend/.env JWT_SECRET.
# JWT_SECRET=dev-secret-change-me-32-chars-minimum
# Bypass auth en local (démo sans token) :
ENGINE_REQUIRE_AUTH=false

# --- Transcription LOCALE (si ENGINE_ASR_PROVIDER=local) ---
WHISPER_MODEL=small               # ~1 Go RAM, multilingue correct
WHISPER_COMPUTE=int8
WHISPER_CPU_THREADS=3
```

> 💡 **100 % local, sans clé API** : mettre les 3 providers à `local` et
> `ENGINE_ALLOW_LOCAL_FALLBACK=true` (installe les modèles locaux, CPU). Plus
> lent au premier passage, puis mis en cache. Voir `engine/README.md` pour
> l'install complète (torch CPU, llama.cpp).

---

## 4. Tout lancer en une fois (Docker — optionnel)

Si Docker est disponible, l'ensemble (Core + Frontend + HLS + Engine) se lance
via **docker compose** :

```bash
docker compose up --build
```

- Frontend : http://localhost:5174 · Core : http://localhost:3000 · HLS : http://localhost:8080
- Renseigner les variables sensibles (`JWT_SECRET`, clés Engine) dans un `.env`
  à la racine ou dans l'environnement avant `up`.

---

## 5. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| **« Source vidéo illisible »** après upload | `ffmpeg` absent, ou vidéo encore en **chiffrement** | Vérifier `ffmpeg -version` ; attendre la fin (barre « Chiffrement… X% » dans le catalogue) |
| Slide **dashboard blanche** dans le deck | Streamlit pas lancé | `cd engine && streamlit run dashboard/app.py` (port 8501) |
| **Port déjà utilisé** (présentation) | 8090 occupé | `node docs/presentations/serve-presentation.mjs --port 9000` |
| L'IA ne répond pas | Aucune clé API et fallback désactivé | Renseigner une clé (`GROQ_API_KEY`) **ou** passer les providers en `local` + `ENGINE_ALLOW_LOCAL_FALLBACK=true` |
| Autres postes ne voient pas la vidéo (LAN) | `VITE_API_URL=localhost` | Mettre l'IP LAN du backend dans `frontend/.env.local`, et `VITE_COLLAB_MODE=socket` |

---

*Groupe 7 — Poulpium · « plusieurs bras sur une même vidéo ».*
