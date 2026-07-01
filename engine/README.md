# Engine — Pôle 3 · IA & Data (Groupe 7)

**Microservice** Python/FastAPI de l'architecture *View / Core / Engine*. Transforme une vidéo en **JSON riche** (transcription, résumé, chapitres, mots-clés, **sous-titres multilingues**) et expose la **recherche sémantique**. 100 % local, CPU, sans clé API payante.

> 📐 Schéma : [`docs/architecture.png`](docs/architecture.png) (source [`docs/architecture.md`](docs/architecture.md)).
> 🔌 Interface pour le Core : [`docs/api-contract.md`](docs/api-contract.md).

## Rôle
| Squad | Sujet | Entrée → Sortie |
|---|---|---|
| **NLP** | 3A — Indexation & analyse sémantique | Vidéo → JSON (langue, transcript, segments horodatés, **traductions multilingues**, résumé, chapitres, mots-clés) |
| **Data** | 3B — Audience & rétention | `../data/*.csv` → dashboard + modèle prédictif — voir [`dashboard/RECAP-P3B.md`](dashboard/RECAP-P3B.md) |

## Stack (CPU-only)
| Besoin | Modèle / outil | Empreinte |
|---|---|---|
| API | FastAPI + Uvicorn | — |
| Extraction audio | ffmpeg | — |
| Transcription | faster-whisper `base` (int8) | ~140 Mo |
| Résumé / chapitres | llama.cpp · **Qwen2.5-1.5B Q4_K_M** | ~1 Go |
| Mots-clés | KeyBERT (MMR) | réutilise l'embedder |
| Recherche sémantique | sentence-transformers · MiniLM multilingue | ~470 Mo |
| **Traduction / sous-titres** | **NLLB-200-distilled-600M** (200 langues) | ~2,5 Go |

> Détail & justification : [`docs/model-selection.md`](docs/model-selection.md).

## Installation (opérationnel ✅)
```bash
cd engine
# venv (python3-venv absent → virtualenv, sans sudo)
python3 -m pip install --user virtualenv
python3 -m virtualenv .venv && source .venv/bin/activate
pip install --upgrade pip
# torch CPU-only AVANT le reste (évite ~2,5 Go de CUDA inutiles)
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
```
> Pré-requis système : `ffmpeg`. Modèles téléchargés au 1er usage (Whisper, MiniLM, NLLB) ; GGUF dans `models/`.

> ⚠️ **Token Hugging Face (possiblement nécessaire).** Les modèles se téléchargent depuis le Hub.
> En cas de **limite de débit** (`429` / *"unauthenticated requests"*) ou de modèle gated, exporte un token :
> ```bash
> export HF_TOKEN=hf_xxxxxxxx     # https://huggingface.co/settings/tokens
> ```
> `huggingface_hub` le lit automatiquement. Une fois les modèles en cache local, le token n'est plus requis (100 % offline).

## Utilisation

### CLI (le plus simple) — 1 dossier par vidéo, JSON toujours produit
```bash
.venv/bin/python scripts/analyze_file.py "/chemin/video.mp4"
# → engine/outputs/<video>/ : la vidéo + <video>_meta.json + <video>_trad_<lang>.json (par langue)

# réduire les langues (défaut = 15) pour aller plus vite :
TARGET_LANGS="fr,en,es,ar" .venv/bin/python scripts/analyze_file.py "video.mp4"
# forcer la régénération (ignore le cache) :
FORCE=1 .venv/bin/python scripts/analyze_file.py "video.mp4"
```
> 💾 **Cache** : si le dossier de la vidéo existe déjà, rien n'est régénéré (re-run ≈ 12 s).
> Si on ajoute des langues, **seules les manquantes** sont traduites (incrémental).

### API REST
```bash
uvicorn app.main:app --reload                         # http://localhost:8000
.venv/bin/python scripts/demo_api.py "../data/speech1.mp4"   # démo flux complet
```
| Méthode | Endpoint | Auth | Rôle |
|---|---|---|---|
| GET | `/health` | non | sonde de vie |
| POST | `/analyze` | oui | upload vidéo (multipart) → job |
| POST | `/analyze-path` | oui | analyse fichier local → job |
| GET | `/jobs/{id}` | oui | statut + résultat (contrat) |
| POST | `/search` | oui | recherche sémantique |

Auth = `Authorization: Bearer <JWT du Core>` (HS256, `JWT_SECRET`). Bypass local : `ENGINE_REQUIRE_AUTH=false`.

## Format de sortie (contrat P3-A + multilingue)
```json
{
  "video": "...", "language": "en", "duration_sec": 574.6,
  "transcript": "...", "segments": [{ "start", "end", "text" }],
  "translation": { "lang": "fr", "text": "..." },
  "translations": [
    { "lang": "fr", "text": "...", "segments": [{ "start", "end", "text" }] },
    { "lang": "en", "...": "..." }, { "lang": "es", "...": "..." }, { "lang": "ar", "...": "..." }
  ],
  "summary": "...", "chapters": [{ "title", "start" }], "keywords": ["..."],
  "generated_at": "2026-06-30T..."
}
```
`translations[].segments` = **sous-titres horodatés** par langue. Contrat : [`../docs/P3A-metadata-schema.md`](../docs/P3A-metadata-schema.md).

## Variables d'environnement
| Var | Défaut | Rôle |
|---|---|---|
| `JWT_SECRET` | `dev-secret-change-me` | **doit** matcher le Core |
| `ENGINE_REQUIRE_AUTH` | `true` | `false` = bypass auth (local) |
| `TARGET_LANGS` | `fr,en,es,ar,de,it,pt,nl,ru,zh,ja,ko,hi,tr,pl` | langues de sous-titres (max par défaut) |
| `ENGINE_OUTPUT_DIR` | `engine/outputs` | dossier racine des sorties |
| `FORCE` (CLI) | — | `FORCE=1` ignore le cache |
| `HF_TOKEN` | — | token Hugging Face si rate-limit au téléchargement des modèles |
| `WHISPER_MODEL` | `base` | modèle transcription |
| `LLM_GGUF` | `models/qwen2.5-1.5b-instruct-q4_k_m.gguf` | LLM |
| `LLM_THREADS` | `4` | threads llama.cpp |

## Performance (mesurée — i5-1145G7, CPU)
| Vidéo | Total | Détail |
|---|---|---|
| 87 s | ~40 s | transcription RTF 0,069 |
| 9,6 min (4 langues) | ~230 s | dont ~160 s traduction 172 seg × 4 |

Détail : [`tests/ESTIMATIONS.md`](tests/ESTIMATIONS.md).

## Tests
```bash
.venv/bin/python -m pytest tests/ -q       # 11 tests : API + contrat + E2E
```
Plan complet : [`tests/TEST-PLAN.md`](tests/TEST-PLAN.md).

## Structure
```
engine/
├── Dockerfile · .dockerignore   conteneurisation (microservice)
├── app/                      API FastAPI
│   ├── main.py               endpoints + jobs async
│   ├── config.py auth.py schemas.py models.py pipeline.py output.py
│   └── nlp/                  transcribe · summarize · search · translate
├── dashboard/                Streamlit 3B (placeholder)
├── models/                   GGUF + caches (ignorés par git)
├── outputs/                  résultats par vidéo (ignorés par git)
├── scripts/                  analyze_file.py · demo_api.py
├── tasks/                    répartition (1 .md par membre)
├── tests/                    pytest + bench + examples/ (corpus vidéos)
└── docs/                     api-contract · model-selection · architecture
```

## Documentation
| Doc | Contenu |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) / `.png` | schéma du pipeline (HD) |
| [`docs/api-contract.md`](docs/api-contract.md) | interface API Engine↔Core (pour le Core) |
| [`docs/model-selection.md`](docs/model-selection.md) | choix des modèles légers |
| [`docs/api-vs-microservice.md`](docs/api-vs-microservice.md) | API vs microservice (soutenance) |
| [`tests/TEST-PLAN.md`](tests/TEST-PLAN.md) · [`tests/ESTIMATIONS.md`](tests/ESTIMATIONS.md) | tests · perf |
| [`../docs/feature-plans/engine-p3-ia-data.md`](../docs/feature-plans/engine-p3-ia-data.md) | plan maître |

## Statut
| Tâche | État |
|---|---|
| 00 — Setup CPU-only | ✅ |
| 10 — API Engine (auth, jobs, orchestration) | ✅ testé E2E |
| Traduction multilingue + sous-titres (NLLB) | ✅ |
| 30-33 — Data 3B (rétention, modèle, dashboard) | ✅ F1=0.711 · Ridge MAE=0.069 ([RECAP](dashboard/RECAP-P3B.md)) |
| 20/21/22 — affinage NLP | ❌ à venir (autres membres) |
