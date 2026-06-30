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
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # API
streamlit run dashboard/app.py  # dashboard 3B
```

## Documentation
| Doc | Contenu |
|---|---|
| `../docs/feature-plans/engine-p3-ia-data.md` | **Plan maître** (à réviser avant tout) |
| `tasks/*.md` | Répartition détaillée par tâche/membre (générés après validation du plan) |
| `../docs/python-env.md` | Mise en place de l'environnement Python |
