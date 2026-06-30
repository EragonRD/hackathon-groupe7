# Engine — Pôle 3 · IA & Data (Groupe 7)

Brique **Engine** de l'architecture *View / Core / Engine*. Service **Python** appelé par le **Core** (NestJS), qui renvoie ses résultats à la **View** (React).

## Rôle
| Squad | Sujet | Entrée → Sortie |
|---|---|---|
| **NLP** | 3A — Indexation & analyse sémantique | Vidéo → **JSON riche** (langue, transcript, segments horodatés, traduction, résumé, chapitres, mots-clés) |
| **Data** | 3B — Audience & rétention | `data/*.csv` → **dashboard** (rétention, zones d'ennui) + **modèle prédictif** |

## Stack envisagée (à valider)
| Besoin | Choix proposé | Local/gratuit |
|---|---|---|
| API | FastAPI + Uvicorn | ✅ |
| Extraction audio | ffmpeg | ✅ |
| Transcription | Whisper (faster-whisper, CPU) | ✅ |
| Résumé/chapitres | **llama.cpp** (llama-cpp-python, GGUF) ou NLP classique | ✅ |
| Mots-clés | KeyBERT / TextRank | ✅ |
| Recherche sémantique | sentence-transformers (embeddings) | ✅ |
| Modèle rétention | scikit-learn | ✅ |
| Dashboard | Streamlit | ✅ |

> 100 % local, aucune clé API payante. Modèles légers (CPU).

## Contrat de sortie
- 3A : `../docs/P3A-metadata-schema.md` (contrat JSON imposé).
- 3B : ⚠️ corrigés `../data/` = **évaluation seule**, jamais en feature (fuite de cible).

## Structure (cible — à construire)
```
engine/
├── README.md            ← ce fichier
├── tasks/               ← répartition détaillée (1 fichier .md par tâche/membre)
├── requirements.txt     ← dépendances Python (à créer)
├── app/                 ← API FastAPI (à créer)
│   ├── main.py
│   ├── nlp/             ← pipeline 3A
│   └── data/            ← analyse + modèle 3B
└── dashboard/           ← Streamlit 3B (à créer)
```

## Démarrage (cible — non encore opérationnel)
```bash
cd engine
# 1) venv — python3-venv absent → on passe par virtualenv (sans sudo)
python3 -m pip install --user virtualenv
python3 -m virtualenv .venv
source .venv/bin/activate
pip install --upgrade pip

# 2) torch CPU-only AVANT le reste (évite ~2,5 Go de wheels CUDA inutiles)
pip install torch --index-url https://download.pytorch.org/whl/cpu

# 3) reste des dépendances (+ wheel llama.cpp CPU pré-compilé, pas de cmake)
pip install -r requirements.txt \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu

# 4) lancer
uvicorn app.main:app --reload   # API       → http://localhost:8000
streamlit run dashboard/app.py  # dashboard 3B
```
> ⚠️ **Ordre important** : installer `torch` CPU **en premier** fige la version CPU ; sinon `sentence-transformers` retire la variante CUDA (~2,5 Go).
> Pré-requis système : `ffmpeg` (présent ✅). Modèles → voir `docs/model-selection.md`.

## Statut setup (tâche 00) — ✅ opérationnel
| Élément | État |
|---|---|
| venv + dépendances CPU-only | ✅ installé |
| `torch` | 2.12.1+**cpu** (CUDA off) |
| API `/health` | ✅ répond |
| Modèle LLM | `Qwen2.5-1.5B-Instruct Q4_K_M` → `models/` |

## Documentation
| Doc | Contenu |
|---|---|
| `../docs/feature-plans/engine-p3-ia-data.md` | **Plan maître** (à réviser avant tout) |
| `tasks/*.md` | Répartition détaillée par tâche/membre (générés après validation du plan) |
| `../docs/python-env.md` | Mise en place de l'environnement Python |
