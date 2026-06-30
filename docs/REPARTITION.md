# 👥 Répartition des tâches — Hackathon ESTIAM (Groupe 7)

> Objectif : livrer **les 3 pôles** (1 sujet par pôle, notés à parts égales) **+ le Bloc B
> d'intégration** (la couture View → Core → Engine, notée séparément).
> Règle d'or : **1 WMD à la tête de chaque pôle** pour encadrer et coder avec les profils
> non-codeurs (CCSN, BDAI, SAP).
>
> ✅ Répartition issue du **sondage de préférences** des membres.

---

## 🧠 Lecture des profils (qui sait faire quoi)

| Profil | Membres | Sait coder ? | Mission naturelle |
|---|---|---|---|
| **WMD** — Web & Mobile Dev | Alex, Rabah, Enzo | ✅ Full-stack | **Leads de pôle** : architecture + code |
| **DAD** — Dév. Applicatif & Data | William, Matthieu | ✅ Codeurs | Renfort code (front/back) |
| **BDAI** — Big Data & IA | Duval, Antoine, Otman, Izlene, Amina | 🐍 Python seulement | Pipeline IA / Data (Engine) |
| **CCSN** — Cloud, Cybersécu, Système, Réseau | Ryan, Gabriel | ❌ (concepts réseau/sécu) | Modèle de menace, infra, tests d'attaque |
| **SAP** | Amos (MBA), Hassane, Faycal | ❌ (logiciel/BI/data) | BI, doc, business, dashboard, coordination |

**15 personnes** réparties en 3 pôles.

---

## 🗺️ Vue d'ensemble de la répartition

| Pôle | Brique | Lead (WMD) | Équipe | Effectif |
|---|---|---|---|---|
| **P1 — Application & Collaboration** | View (`frontend/`) | **Alex** | Matthieu, Amos | 3 |
| **P2 — Infra, Sécurité & Cloud** | Core (`backend/`) | **Enzo** | William, Ryan, Gabriel | 4 |
| **P3 — IA & Data** | Engine (`engine/` à créer) | **Rabah** | Duval, Antoine, Otman, Izlene, Amina, Hassane, Faycal | 8 |
| **Bloc B — Intégration / PM** | la couture + soutenance | (les 3 leads) | **Amos (PM)** | transverse |

> Chaque pôle a **son WMD lead** + **au moins 2 codeurs**. P3 est plus gros car il concentre
> les **5 BDAI Python-only** + 2 SAP/BI → on le découpe en **2 squads** (NLP et Data).

---

## 🎬 Pôle 1 — Application & Collaboration · `frontend/` (React)

**Lead : Alex (WMD)** — pose l'archi React et le temps réel, encadre Matthieu et Amos.

### 👉 Sujet recommandé : **A — Lecteur de Revue augmenté**
> Plus d'« audace produit » (annotation + dessin + commentaire au timecode, en direct).
> *Repli plus sûr si le temps réel coince : **B — Watch Together** (synchro présentateur/invités).*

### Répartition interne
| Membre | Rôle | Tâches |
|---|---|---|
| **Alex** (WMD, lead) | Archi & temps réel | Composant `<VideoReview>` réutilisable (props : source/user/session), couche WebSocket (sync à 2-3 users en réseau local), **export JSON** propre |
| **Matthieu** (DAD) | Outils d'annotation + UX | Calque de dessin sur la vidéo (flèche/forme/trait/texte/couleur) rattaché au **timecode**, liste de commentaires triée par temps + saut à l'instant, **réimport** JSON |
| **Amos** (SAP, MBA) | Produit & doc | Scénarios d'usage, format d'export documenté (réutilisable), **lecture business** de la démo, appui soutenance (rôle PM transverse) |

**Livrable clé :** démo multi-fenêtres (2-3 navigateurs) + composant autonome + format d'export documenté.

---

## 🔐 Pôle 2 — Infrastructure, Sécurité & Cloud · `backend/` (NestJS)

**Lead : Enzo (WMD)** — écrit le code NestJS/Docker ; les CCSN apportent la cyber/réseau, William renforce le code.

### 👉 Sujet recommandé : **A — Diffusion « Zero-Trust »**
> S'intègre directement au Core : le **token JWT** (déjà câblé) ouvre la **clé AES-128** ;
> refus par défaut sinon. Démo de sécurité limpide.
> *Alternative : **B — Détection & Anti-Scraping** (rate-limiter `@nestjs/throttler`, dashboard temps réel) si l'équipe préfère le volet détection.*

### Répartition interne
| Membre | Rôle | Tâches |
|---|---|---|
| **Enzo** (WMD, lead) | Serveur de clés | Endpoint NestJS de délivrance de clé AES **sur token valide uniquement** (401/403 sinon), TTL court, chiffrement HLS AES-128 |
| **William** (DAD) | Infra & intégration | `docker-compose` **déploiement en 1 commande**, Nginx/origine HLS, branchement au Core (auth) |
| **Ryan** (CCSN) | Sécu & menace | **Modèle de menace** (quoi/contre quoi/limites + schéma), TTL/rotation/révocation de clés, durcissement |
| **Gabriel** (CCSN) | Tests & preuve | **Preuve de sécurité** (avec token → lit ; sans/expiré → refus), journalisation des accès clé, scénarios d'attaque |

**Livrable clé :** `docker-compose up` qui marche, preuve « token = lit / pas de token = refusé », schéma de menace.

---

## 🤖 Pôle 3 — Intelligence Artificielle & Data · `engine/` (Python, à créer)

**Lead : Rabah (WMD)** — crée le service `engine/`, l'API d'orchestration (appelée par le Core) et encadre les BDAI/SAP.

### 👉 Stratégie : **2 squads** (le pôle a 8 personnes)
- **Squad NLP — Sujet A** (transcription → JSON riche) = **sujet noté principal**.
- **Squad Data — Sujet B** (rétention + dashboard) = enrichit la View et le Bloc B (insights).
> On présente **A comme sujet du pôle** ; **B vient en bonus d'intégration** (alimente la couture). L'inverse reste possible selon l'équipe.

### Squad NLP — Sujet A · *Indexation & analyse sémantique*
| Membre | Rôle | Tâches |
|---|---|---|
| **Rabah** (WMD, lead) | API Engine | Service Python (API de préf.), contrat **JSON** ([`docs/P3A-metadata-schema.md`](P3A-metadata-schema.md)), branchement au Core |
| **Duval** (BDAI) | Transcription | ffmpeg (extraction audio) → **Whisper** local, segments **horodatés**, détection de langue |
| **Antoine** (BDAI) | Résumé/chapitres | Résumé + chapitres via LLM local (Ollama) ou NLP classique, **mots-clés** (KeyBERT/TextRank) |
| **Izlene** (BDAI) | Recherche sémantique | Embeddings + recherche « le passage où on parle de X », multilingue/traduction |

### Squad Data — Sujet B · *Analyse d'audience & rétention*
| Membre | Rôle | Tâches |
|---|---|---|
| **Otman** (BDAI) | Analyse & détection | À partir de [`data/`](../data/) : **courbe de rétention**, **zones d'ennui**, mesure précision/rappel vs corrigé |
| **Amina** (BDAI) | Modèle prédictif | Modèle scikit-learn (forêts/boosting), features **sans fuite de cible**, métriques MAE/R² |
| **Faycal** (SAP) | Dashboard | Tableau de bord (Streamlit/BI), comparaison entre vidéos, visualisations |
| **Hassane** (SAP) | Business & doc | **Lecture business** (quoi conseiller pour améliorer une vidéo), doc reproductible |

**Livrables clés :** A → JSON structuré + démo sur 1 vidéo · B → dashboard reproductible + modèle documenté.
**Rappel ⚠️ :** les corrigés servent à **évaluer**, jamais à **alimenter** le modèle (fuite de cible).

---

## 🧩 Bloc B — Intégration & cohérence (transverse)

**PM : Amos (MBA SAP)** — coordonne, suit le planning, prépare la **soutenance** ; garant de la « couture » (tout en contribuant à P1).
**Comité technique :** les 3 leads (Alex, Enzo, Rabah).

**La couture à démontrer :** *un même utilisateur, authentifié par le Core, ouvre une vidéo dans la View ;
le Core applique la sécurité (P2) et appelle l'Engine (P3) ; les résultats reviennent dans la View.*

| Action | Qui | Quand |
|---|---|---|
| Auth unique (JWT `auth/login`) partagée P1/P2 | Enzo + Alex | Dès J1 |
| View affiche détections (P2-B) + insights/métadonnées (P3) | Alex + Rabah | Mi-parcours |
| Core orchestre les appels à l'Engine | Enzo + Rabah | Mi-parcours |
| Scénario de démo « une seule identité, un seul flux » | Amos + leads | Avant soutenance |

---

## 📅 Suggestion de cadence

1. **J1 matin — cadrage commun.** Chaque pôle confirme son sujet (A/B), les 3 leads + Amos figent les **contrats d'interface** (forme du JWT, schéma JSON Engine, endpoints Core).
2. **J1–J2 — build en parallèle** dans chaque pôle (squelettes `frontend/` et `backend/` déjà fournis, `engine/` à créer).
3. **Mi-parcours — première couture** : login partagé + un appel Engine de bout en bout.
4. **Avant soutenance — intégration finale + répétition démo** (Amos pilote), nettoyage des exports JSON et de la doc.

---

## ✅ Récap express

- **Alex (WMD)** → lead P1 · **Matthieu (DAD)** → annotation/UX · **Amos (SAP)** → produit/doc/PM.
- **Enzo (WMD)** → lead P2 · **William (DAD)** → infra/code · **Ryan & Gabriel (CCSN)** → menace/preuve.
- **Rabah (WMD)** → lead P3 · **Duval, Antoine, Izlene (BDAI)** → NLP · **Otman, Amina (BDAI), Faycal & Hassane (SAP)** → Data.
- **Amos (MBA SAP)** → PM / intégration / soutenance (transverse).
