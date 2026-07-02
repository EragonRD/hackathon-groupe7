# Engine — Pôle 3 · IA & Data (Groupe 7)

**Microservice** Python/FastAPI de l'architecture *View / Core / Engine*. Transforme une vidéo en **JSON riche** (transcription, résumé, chapitres, mots-clés, **sous-titres multilingues**) et expose la **recherche sémantique** + la **traduction à la demande**. Calcul lourd **déporté sur API gratuites** (Groq par défaut ; OpenRouter / Gemini / Mistral / NVIDIA sélectionnables) avec **repli local** ; seul l'embedding (MiniLM) reste toujours local. Aucune clé API **payante**.

> 📐 Schéma : [`docs/architecture.png`](docs/architecture.png) (source [`docs/architecture.md`](docs/architecture.md)).
> 🔌 Interface pour le Core : [`docs/api-contract.md`](docs/api-contract.md).

## Rôle
| Squad | Sujet | Entrée → Sortie |
|---|---|---|
| **NLP** | 3A — Indexation & analyse sémantique | Vidéo → JSON (langue, transcript, segments horodatés, **traductions multilingues**, résumé, chapitres, mots-clés) |
| **Data** | 3B — Audience & rétention | `../data/*.csv` → dashboard + modèle prédictif ✅ (voir [`docs/business-3b.md`](docs/business-3b.md)) |

## Stack (hybride : API distante + repli local)
| Besoin | Défaut (distant) | Repli local | Empreinte locale |
|---|---|---|---|
| API | FastAPI + Uvicorn | — | — |
| Extraction audio | ffmpeg | ffmpeg | — |
| Transcription | **Groq** `whisper-large-v3-turbo` | **faster-whisper `small`** (int8, **UNIQUE modèle local de transcription**) + `langdetect` | ~480 Mo |
| Résumé / chapitres | **Groq** `openai/gpt-oss-20b` | llama.cpp · Qwen2.5-1.5B Q4_K_M | ~1 Go |
| Traduction / sous-titres | **Groq** `llama-4-scout` | NLLB-200-distilled-600M | ~2,5 Go |
| Recherche sémantique + mots-clés | — | MiniLM multilingue (**toujours local**) + KeyBERT | ~470 Mo |

> Providers par étape via `.env` (`ENGINE_ASR/LLM/TRANSLATE_PROVIDER`) — cf. [`.env.example`](.env.example).
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
> Pré-requis système : `ffmpeg`. **Config** : copier [`.env.example`](.env.example) → `.env` et renseigner les clés (Groq, etc.). En mode API (défaut), seul **MiniLM** se télécharge au 1er usage ; les modèles locaux de repli (Whisper `small`, NLLB, GGUF) ne se chargent qu'en repli/offline.

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

### Dashboard & modèle prédictif (Data 3B)
```bash
python scripts/run_analysis_3b.py             # pipeline -> engine/outputs/data-3b/
streamlit run dashboard/app.py                # dashboard interactif (4 onglets)
uvicorn app.data.api.main:app --reload --port 8010   # (bonus) API JSON, docs sur /docs
```
Détail méthodo, métriques et guide de repro : [`docs/business-3b.md`](docs/business-3b.md).
Code réutilisable : `app/data/` (rétention, détection, modèle, descriptif, conseils business).

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
| `ENGINE_ASR_PROVIDER` | `groq` | `groq` \| `nvidia` \| `local` (transcription) |
| `ENGINE_LLM_PROVIDER` | `groq` | `groq` \| `openrouter` \| `gemini` \| `mistral` \| `local` |
| `ENGINE_TRANSLATE_PROVIDER` | `groq` | idem chat |
| `ENGINE_ALLOW_LOCAL_FALLBACK` | `true` | `false` = 100 % API strict (aucun modèle local) |
| `WHISPER_MODEL` | `small` | **unique** modèle local de transcription |
| `WHISPER_CPU_THREADS` | `0` | 0 = auto ; plafonner (ex. 3) sur NAS |
| `GROQ_TRANSLATE_MODEL` | `llama-4-scout` | modèle de traduction Groq |
| `LLM_GGUF` | `models/qwen2.5-1.5b-instruct-q4_k_m.gguf` | LLM local (repli) |

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
├── app/
│   ├── main.py               API FastAPI 3A — endpoints + jobs async
│   ├── config.py auth.py schemas.py models.py pipeline.py output.py
│   ├── nlp/                  transcribe · summarize · search · translate
│   └── data/                 3B — retention · hotspots · model · descriptive · recommend
│       └── api/               (bonus) API FastAPI JSON pour la partie 3B
├── dashboard/                Streamlit 3B (`streamlit run dashboard/app.py`)
├── models/                   GGUF + caches (ignorés par git)
├── outputs/                  résultats par vidéo + data-3b/ (ignorés par git)
├── scripts/                  analyze_file.py · demo_api.py · run_analysis_3b.py
├── tasks/                    répartition (1 .md par membre)
├── tests/                    pytest + bench + examples/ (corpus vidéos)
└── docs/                     api-contract · model-selection · architecture · business-3b
```

## Documentation
| Doc | Contenu |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) / `.png` | schéma du pipeline (HD) |
| [`docs/api-contract.md`](docs/api-contract.md) | interface API Engine↔Core (pour le Core) |
| [`docs/model-selection.md`](docs/model-selection.md) | choix des modèles légers |
| [`docs/api-vs-microservice.md`](docs/api-vs-microservice.md) | API vs microservice (soutenance) |
| [`tests/TEST-PLAN.md`](tests/TEST-PLAN.md) · [`tests/ESTIMATIONS.md`](tests/ESTIMATIONS.md) | tests · perf |
| [`docs/business-3b.md`](docs/business-3b.md) | lecture business + repro Data (3B) |
| [`../docs/feature-plans/engine-p3-ia-data.md`](../docs/feature-plans/engine-p3-ia-data.md) | plan maître |

## Statut
| Tâche | État |
|---|---|
| 00 — Setup CPU-only | ✅ |
| 10 — API Engine (auth, jobs, orchestration) | ✅ testé E2E |
| Traduction multilingue + sous-titres (NLLB) | ✅ |
| 20/21/22 — affinage NLP | ❌ à venir (autres membres) |
| 30-33 — Data 3B (rétention, modèle, dashboard, business) | ✅ |
