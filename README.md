# 🏆 Starter Hackathon · ESTIAM

Dépôt de démarrage pour le hackathon. Vous travaillez sur un projet réel de
**plateforme vidéo**. Ce starter contient deux applications minimales prêtes à
l'emploi :

| Dossier | Stack | Démarrage |
|---|---|---|
| [`frontend/`](frontend) | **React** (Vite) | `cd frontend && npm install && npm run dev` |
| [`backend/`](backend) | **NestJS** | `cd backend && npm install && npm run start:dev` |

> Ce sont des squelettes volontairement nus : à vous de les faire évoluer selon les
> sujets que vous choisissez.

> 🎁 **Avant l'événement — prefetch (coup de pouce, optionnel).** Le réseau du lieu
> peut être lent. [`scripts/prefetch.sh`](scripts/prefetch.sh) pré-télécharge des
> ressources **courantes** (dépendances du starter, images Docker, modèles
> Whisper/Ollama) pour travailler ensuite hors-ligne :
> ```bash
> ./scripts/prefetch.sh
> ```
> 🪟 **Windows :** via **WSL2** ou **Git Bash**, ou l'équivalent PowerShell natif
> [`scripts/prefetch.ps1`](scripts/prefetch.ps1)
> (`powershell -ExecutionPolicy Bypass -File scripts\prefetch.ps1`).
>
> ⚠️ **Ce n'est qu'une aide et une suggestion.** Vous êtes **libres** de choisir vos
> propres outils, modèles et images — le script ne présume rien de votre solution, et
> chaque étape est ignorable (`SKIP_NPM=1`, `SKIP_DOCKER=1`, `SKIP_MODELS=1`).

---

## 🧭 Organisation du hackathon

Le hackathon est organisé en **3 pôles**. Chaque pôle propose **2 sujets au choix
(A ou B)**. **Les 3 pôles sont obligatoires** : chaque équipe traite **un sujet par
pôle**. Les pôles sont notés **séparément et à parts égales**.

| Pôle | Sujet A | Sujet B |
|---|---|---|
| **1 — Application & Collaboration** | Lecteur de revue augmenté | Espace « Watch Together » |
| **2 — Infrastructure, Sécurité & Cloud** | Diffusion « Zero-Trust » | Détection & Anti-Scraping |
| **3 — Intelligence Artificielle & Data** | Indexation & analyse sémantique | Analyse d'audience & rétention |

Règles utiles : **React est imposé** au Pôle 1 (le lecteur vidéo reste libre), le
**déploiement local est pleinement accepté** (aucun accès cloud payant exigé), et un
**rendu partiel mais crédible** (maquette + architecture argumentée + plan de
réalisation) est valorisé.

> 📖 **Comment lire un sujet.** Chaque énoncé donne un **Défi** (le problème et la
> liberté que vous avez), des **Contraintes** (non négociables), **Ce qu'on regardera**
> (les signaux de qualité, reliés au barème) et des **Pistes** *facultatives*. Le
> périmètre, l'ambition et les idées en plus sont à vous : **ce n'est pas une liste de
> cases à cocher**, c'est un défi à relever.

---

## 🎬 Pôle 1 — Application & Collaboration

**Profils : DEV / Web.** Construire l'expérience utilisateur autour du lecteur vidéo
et de la collaboration **en temps réel** entre plusieurs utilisateurs (React imposé,
lecteur vidéo libre).

### Sujet A — Le Lecteur de Revue augmenté

**Contexte.** Les équipes internes doivent **réviser des vidéos ensemble** (montages,
supports de formation, présentations) comme on commente un document partagé.
Aujourd'hui les retours se font par e-mail (« à 1:32 le logo est trop petit ») :
imprécis et fastidieux.

**Le défi.** Faire d'un lecteur vidéo un véritable **espace de revue collaboratif** :
on **dessine sur l'image** et on **commente un instant précis**, à plusieurs et **en
direct**. À vous d'inventer les outils d'annotation, l'UX et jusqu'où pousser le temps
réel — visez l'expérience qui rendrait *vraiment* service à une équipe.

**Contraintes (non négociables).** Frontend **React** · annotations **rattachées à un
timecode** · fonctionne à **2-3 utilisateurs** dans la même salle (réseau local) ·
annotations + commentaires **exportables en JSON** propre et réutilisable · livré comme
**composant réutilisable** (source vidéo / utilisateur / session passés en props).

**Ce qu'on regardera.** La précision des retours dans le temps, la fluidité et la
cohérence à plusieurs connexions, la propreté du format d'export, l'autonomie du
composant — et l'**audace produit** (les idées qu'on n'a pas listées comptent). Une
démo multi-fenêtres soignée vaut mieux qu'une longue liste de fonctions bâclées.

**Pistes (facultatif).** Outils de dessin (flèche, formes, trait libre, texte), couleur
et suppression ; liste de commentaires triée par temps avec saut à l'instant ; curseurs
collaboratifs ; réimport du JSON.

### Sujet B — Espace « Watch Together »

**Contexte.** Pour des **présentations vidéo internes** (démos produit, formations,
lancements), on veut que **tout le monde voie exactement la même chose au même
moment**.

**Le défi.** Créer une **« salle de projection virtuelle »** : un **présentateur**
pilote la lecture, et tous les **invités** voient exactement la même chose au même
moment. Le vrai sujet, c'est la **qualité de la synchronisation** — à vous de décider
comment la rendre robuste et agréable.

**Contraintes (non négociables).** Frontend **React** · salons (rooms) avec rôles
**présentateur / invité** · les commandes du présentateur (play / pause / seek) se
répercutent chez **tous** les invités · testable à **un présentateur + 2 invités** sur
le réseau local.

**Ce qu'on regardera.** La fidélité de la synchro à plusieurs, la **resynchronisation
d'un retardataire**, la **gestion de la dérive**, l'absence de **boucle d'écho**, et un
**protocole d'échange documenté** (les événements et leur sens). Bonus pour les idées
qui dépassent le strict pilotage (chat, réactions, sondage live…).

**Pistes (facultatif).** Verrouiller les contrôles côté invité ; liste des participants
connectés ; synchroniser aussi la vitesse de lecture ; recalage si l'écart dépasse un
seuil.

---

## 🔐 Pôle 2 — Infrastructure, Sécurité & Cloud

**Profils : IT / DevOps / Cyber.** Protéger la diffusion des contenus et détecter les
abus, avec une infrastructure reproductible. **Le déploiement 100 % local est
pleinement accepté** : on évalue la qualité de la chaîne, pas le fait d'être sur le
cloud.

### Sujet A — Architecture de diffusion « Zero-Trust »

**Contexte.** Une plateforme vidéo doit **empêcher le pillage de ses contenus**.
Diffuser une vidéo en clair, c'est laisser n'importe qui télécharger les fichiers.

**Le défi.** Diffuser une vidéo que **personne ne peut piller** : flux **chiffré**, et
**clé de déchiffrement remise uniquement à un utilisateur authentifié, pour une durée
limitée** (Zero-Trust = « ne faire confiance à personne par défaut »). Le cœur, c'est
le **serveur de clés éphémères** : à vous d'en faire une vraie porte fermée.

**Contraintes (non négociables).** Diffusion **HLS** (playlist + segments) · flux
**chiffré AES-128** · clé délivrée **seulement** sur **token temporaire valide**,
**refus par défaut** sinon (401/403) · **déploiement local en une commande** accepté
(Docker-Compose ou IaC) · tourne **sans cloud payant**.

**Ce qu'on regardera.** La **preuve de sécurité** (avec token → ça lit ; sans token ou
token expiré → clé refusée), la reproductibilité de l'infra (aucune étape manuelle
obscure), et un **modèle de menace** assumé (quoi protéger, contre quoi, hypothèses,
limites — schéma à l'appui). On valorise les extensions pertinentes (rotation /
révocation de clés, droits par contenu, journalisation…).

**Pistes (facultatif).** CDN ou serveur d'origine (Nginx) jouant ce rôle ; token JWT à
TTL court ; envoi du token sur la requête de clé côté lecteur (`xhrSetup`).
> 💡 La sécurisation du serveur de clés a naturellement sa place dans votre **Core**
> (l'authentification y vit déjà).

### Sujet B — Détection des menaces & Anti-Scraping

**Contexte.** Au-delà du chiffrement, une plateforme vidéo doit **détecter les abus
en temps réel** : comptes partagés à grande échelle, accès via VPN/proxies pour
contourner des restrictions, et tentatives d'**aspiration automatisée** (scraping) du
contenu.

**Le défi.** Au-delà du chiffrement, **détecter et bloquer les abus en temps réel** :
partage de compte à grande échelle, accès via VPN/proxies, et **aspiration automatisée**
(scraping) du contenu. Construisez le **système de détection / blocage** qui observe le
trafic et réagit — à vous de choisir les signaux et la stratégie de réaction.

**Contraintes (non négociables).** Détection **en temps réel** avec **réaction visible**
(logs / dashboard) · couvrir au moins : **sessions simultanées anormales**, **IP
suspectes** (VPN/proxy), **débit de scraping** · une **démo avec scripts d'attaque**
(l'abus passe *avant*, est bloqué *après*) · règles **documentées, limites assumées**.

**Ce qu'on regardera.** La pertinence des règles (vrais positifs vs faux positifs), la
robustesse (fenêtre glissante, géoloc incohérente, CIDR / ASN…), la lisibilité de la
réaction temps réel — et l'**honnêteté technique**. ⚠️ Détecter de façon fiable une
**capture d'écran** dans un navigateur est quasi impossible : on **valorise** que vous
le disiez, visiez des signaux *best-effort* corrélés côté serveur, et proposiez un
**watermark visible** lié à la session (dissuasif et traçable).

**Pistes (facultatif).** Compteur d'IP par compte sur fenêtre glissante ; listes de
réputation (FireHOL, IP2Proxy lite) chargées hors-ligne ; détection de patterns
séquentiels sur les segments ; rate-limiting.
> 💡 Ce contrôle a sa place dans votre **Core** (NestJS) — un *rate-limiter*
> (`@nestjs/throttler`) est un point de départ naturel.

---

## 🤖 Pôle 3 — Intelligence Artificielle & Data

**Profils : DATA / IA.** Rendre le contenu vidéo exploitable et tirer des insights des
données d'usage — le tout **exécutable en local et gratuitement** (aucun service
payant requis).

### Sujet A — Indexation & analyse sémantique (GenAI & NLP)

**Contexte.** Une vidéo est une **boîte noire** pour la recherche : impossible de
retrouver « le passage où on parle de sécurité » sans la regarder. Rendre ce contenu
exploitable, c'est la base de la recherche, de l'accessibilité et de la recommandation.

**Le défi.** Rendre une vidéo — **boîte noire** pour la recherche — **exploitable** en
extrayant automatiquement son contenu : de la vidéo en entrée à des **métadonnées
riches** en sortie. Le minimum vital, c'est la transcription ; **la valeur, c'est tout
ce que vous en tirez** au-dessus.

**Contraintes (non négociables).** **Pipeline Python exécutable** (API de préférence,
notebook accepté) · de la vidéo → **JSON structuré et documenté** (langue, transcript,
**segments horodatés**, traduction, résumé, chapitres, mots-clés) · **100 % local**,
sans clé API payante · **démo** sur au moins une vidéo.

> 📐 **Format de sortie attendu** : [`docs/P3A-metadata-schema.md`](docs/P3A-metadata-schema.md)
> (contrat JSON). 🐍 Mise en place Python (suggestion, Pôle 3) : [`docs/python-env.md`](docs/python-env.md).

**Ce qu'on regardera.** Des métadonnées **réellement remplies** (pas *seulement* la
transcription), la **pertinence** des résumés / chapitres / mots-clés, la propreté du
JSON, la reproductibilité locale. On valorise ce qui rend le contenu *trouvable* :
recherche sémantique, regroupement thématique, multilingue soigné…

**Pistes (facultatif).** Extraction audio (ffmpeg) → transcription (Whisper) →
traduction → résumé / chapitres / mots-clés via LLM local (Ollama) ou NLP classique
(KeyBERT, TextRank). Modèles **légers** conseillés (CPU).

### Sujet B — Analyse d'audience & prédiction de décrochage (Data Analytics)

**Contexte.** Chaque visionnage laisse des traces (play, pause, retours en arrière,
abandons). Bien analysées, elles révèlent **où une vidéo perd son audience** et
**quelles vidéos retiennent le mieux**.

**Le défi.** Transformer des **logs de visionnage** en **insights actionnables** : *où*
une vidéo perd son audience, et *quelles* vidéos retiennent le mieux. Deux volets —
**comprendre** (analyse / visualisation) et **anticiper** (prédiction) — à vous de leur
donner du sens pour quelqu'un qui produit des contenus.

**Contraintes (non négociables).** Un **tableau de bord lisible** (BI / Streamlit ou
autre) montrant, par vidéo, ses **zones d'ennui** et sa **courbe de rétention**, et
**comparant** les vidéos · un **modèle de prédiction de rétention documenté** (cible,
features, algo, métriques type MAE / R²) · reproductible en local.

> 📂 **Données fournies** dans [`data/`](data/) : logs de visionnage + corrigé +
> [`DATA_SCHEMA.md`](data/DATA_SCHEMA.md) (schéma des colonnes **et** définition de la cible).

> ⚠️ **Les corrigés servent à *évaluer*, jamais à *alimenter* le modèle :**
> - **Prédiction** — n'utilisez **pas le score de rétention** (la valeur à prédire), ni
>   une variable qui le recopie (« position moyenne atteinte », « % de sessions qui
>   terminent »…), comme *feature* d'entrée : le modèle « devinerait » en recopiant la
>   réponse — c'est la **fuite de cible**. Appuyez-vous sur des signaux **indépendants du
>   dénouement** : catégorie, durée, engagement précoce, nombre de pauses / retours en arrière…
> - **Détection** — le **corrigé des zones d'ennui** (fourni avec le jeu de données) sert
>   **seulement à mesurer** votre détection (précision / rappel), **pas** à la produire.

**Ce qu'on regardera.** La cohérence de la détection avec le **corrigé fourni**
(précision / rappel mesurés, pas seulement affirmés), la clarté du dashboard, la rigueur du modèle (features sensées,
métriques honnêtes), et la **lecture business** des résultats (que conseiller pour
améliorer une vidéo ?).

**Pistes (facultatif).** Pics de pauses / retours-arrière / chutes de rétention par
position ; features d'**engagement précoce**, durée, catégorie, fréquence des pauses /
retours en arrière ; modèles scikit-learn (forêts, gradient boosting).

---

## 🧩 Architecture cible & intégration (Bloc B)

Le rendu n'est **pas** trois projets séparés : c'est **une seule plateforme** dont les
trois pôles s'imbriquent. C'est précisément cette imbrication qui est notée au **Bloc B
— Intégration & cohérence**. Ce dépôt est organisé comme le **produit réel**
(architecture *View / Core / Engine*) :

| Brique | Rôle | Où ça vit | Pôles qui s'y greffent |
|---|---|---|---|
| **View** | interface utilisateur | `frontend/` (React) | **P1** (revue / watch-together) ; affichage des détections (P2-B) et des insights / métadonnées (P3) |
| **Core** | API & règles métier | `backend/` (NestJS) | **P2** (auth + délivrance du token de clé AES pour P2-A ; guard / middleware anti-abus pour P2-B) ; orchestration des appels à l'Engine (P3) |
| **Engine** | traitements lourds | un service que **vous ajoutez** (ex. `engine/`, Python) | **P3** (pipeline NLP P3-A, modèle de rétention P3-B) |

**La couture à démontrer en soutenance :** un même utilisateur, authentifié par le
**Core**, ouvre une vidéo dans la **View** ; le Core applique ses règles de sécurité
(P2) et appelle l'**Engine** (P3) dont les résultats reviennent dans la View. Une démo
qui montre les trois pôles **dans la même application** (une seule identité, un seul
flux) vaut bien mieux que trois outils juxtaposés.

> 💡 **Piste P2-B :** le contrôle anti-abus a sa place dans le Core. Le vrai produit
> s'appuie sur un *rate-limiter* (`@nestjs/throttler`) — l'ajouter puis l'activer et le
> durcir dans `backend/` est un point de départ naturel.

> 📦 **Ressources fournies (optionnelles, non notées).** Le **jeu de logs de visionnage**
> (P3-B) est inclus dans [`data/`](data/) et le **prefetch des modèles** dans
> [`scripts/`](scripts/). Pour P2-A, l'organisation peut fournir un **HLS en clair** (le
> contenu à protéger) — **le chiffrer en AES-128 et en verrouiller la clé reste votre
> travail**. Ces ressources évitent la plomberie *non évaluée* ; elles n'implémentent pas
> la solution à votre place.

### 🔐 Authentification (fournie dans le Core)

Une **brique d'identité minimale** est déjà câblée dans `backend/` : c'est le prérequis
partagé par les Pôles 1 et 2, **pas un livrable noté**. À durcir librement.

- `POST /auth/login` `{ username, password }` → **JWT court** + profil utilisateur.
- `GET /auth/me` — route **protégée** d'exemple (vérifie le token, renvoie `req.user`).
- **Comptes de démo** : `alice` (admin), `bob`, `carol` — mot de passe `password`
  (hashés en **Argon2** au démarrage, comme le produit réel).
- Côté React : [`src/auth.js`](frontend/src/auth.js) (login / token / `authFetch`) et une
  démo [`src/Login.jsx`](frontend/src/Login.jsx).

**Comment chaque pôle s'en sert :** P1 → `req.user` comme **identité** du collaborateur ·
P2-A → **étendre ce token** pour ouvrir la clé AES (refus par défaut sinon) · P2-B →
rattacher chaque requête à un **compte** (sessions simultanées, blocage…). Durcissement
(inscription, refresh tokens, rôles fins, anti-bruteforce) **bienvenu mais non noté**.

---

## 📂 Structure du dépôt

```
starter-hackathon-estiam/
├── frontend/   → application React (Vite) + démo d'authentification
├── backend/    → API NestJS (Core) + authentification
├── engine/     → Engine (Pôle 3 · IA & Data) — pipeline NLP (3A) + analyse audience (3B)
├── data/       → jeu de logs de visionnage (Pôle 3-B) + DATA_SCHEMA.md
├── docs/       → format JSON P3-A + mise en place Python + plans de feature
├── media/      → vidéo d'exemple libre de droits (P1 / P2-A / P3-A) — voir media/README.md
├── scripts/    → prefetch + récupération de la vidéo (coup de pouce)
└── README.md
```

> 🤖 **Groupe 7 — branche `feat/intelligence-artificielle-data` (Pôle 3).** La brique
> **Engine** (`engine/`, Python/FastAPI, 100 % local CPU) est en cours de construction :
> transcription Whisper, résumé/chapitres/mots-clés via **llama.cpp** (Qwen2.5-1.5B GGUF),
> recherche sémantique, et analyse d'audience/rétention. Documentation : [`engine/README.md`](engine/README.md),
> plan d'exécution [`docs/feature-plans/engine-p3-ia-data.md`](docs/feature-plans/engine-p3-ia-data.md),
> choix des modèles [`engine/docs/model-selection.md`](engine/docs/model-selection.md).
> **Scope de cette branche : strictement le Pôle 3 (Engine).**

> Le **barème détaillé** est fourni séparément par l'organisation. Ce README décrit le
> **périmètre et les attendus** de chaque sujet — **la solution reste entièrement à
> imaginer**. 🚀
