# État de session & Récap — Engine Pôle 3

> Branche : `feat/intelligence-artificielle-data` · Date : 2026-06-30
> **Scope strict : Pôle 3 (Engine).** On ne touche pas au code des autres pôles.

## 🎯 Où on en est (en une phrase)
Le **socle de l'Engine est opérationnel** : environnement Python CPU-only installé, API FastAPI qui répond, et le **LLM local (llama.cpp + Qwen2.5-1.5B) fonctionne** (testé). Reste à coder les pipelines (tâches 10→33).

## ✅ Fait cette session
| Sujet | Détail |
|---|---|
| Cadrage | `CLAUDE.md`, `PROJECT_MAP.md`, `SUJETS-CHOIX.md`, plan maître, 9 fiches de tâches |
| Branche | `feat/intelligence-artificielle-data` créée |
| **Setup 00** | venv (via virtualenv), deps **CPU-only**, structure `app/` + `dashboard/`, `/health` OK |
| Stack actée | FastAPI · faster-whisper · **llama.cpp** (vs Ollama) · sentence-transformers · scikit-learn · Streamlit |
| **Nettoyage disque** | ~60 Go libérés (4,4 → 63 Go) : Docker (cache+images), Unreal Engine .zip 30 Go, caches |
| Modèles | Choix consigné (`engine/docs/model-selection.md`). **GGUF Qwen2.5-1.5B Q4_K_M téléchargé** (1,1 Go) |
| Preuve | llama.cpp charge le modèle et génère ✅ ; torch 2.12.1+**cpu** (CUDA off) |

## 🧠 Décisions clés
| # | Décision | Pourquoi |
|---|---|---|
| D-LLM | **llama.cpp** (llama-cpp-python, wheel CPU) + GGUF | In-process, sans daemon, contrôle total ; demandé |
| D-Torch | torch **CPU-only** (index PyTorch CPU) | Évite ~2,5 Go CUDA inutiles (cause du disque plein) |
| D-Modèle | Qwen2.5-1.5B-Instruct Q4_K_M (repli 0.5B) | Meilleur rapport qualité/poids FR sur i5 CPU, ~4 Go RAM libre |
| D-Whisper | faster-whisper `base` int8 | Léger, horodatage natif |

## 📦 Specs machine
i5-1145G7 (8 threads) · 15 Go RAM (~4 Go libres) · **pas de GPU** · 63 Go disque libres.

## ⏳ À faire (prochaines tâches)
| Ordre | Tâche | Resp. | Fiche |
|---|---|---|---|
| 1 | API Engine (endpoints, contrat JSON) | Rabah | `engine/tasks/10-api-engine.md` |
| 2 | Transcription Whisper horodatée | Duval | `engine/tasks/20-...md` |
| 3 | Résumé/chapitres/mots-clés (llama.cpp) | Antoine | `engine/tasks/21-...md` |
| 4 | Recherche sémantique + traduction | Izlene | `engine/tasks/22-...md` |
| 5 | Rétention + zones d'ennui | Otman | `engine/tasks/30-...md` |
| 6 | Modèle prédictif (anti-fuite) | Amina | `engine/tasks/31-...md` |
| 7 | Dashboard Streamlit | Faycal | `engine/tasks/32-...md` |
| 8 | Business + doc | Hassane | `engine/tasks/33-...md` |

> ⚠️ Whisper `base` se téléchargera (~140 Mo) au 1er run de la tâche 20.

## ▶️ Reprendre le travail
```bash
cd engine && source .venv/bin/activate
uvicorn app.main:app --reload      # API → http://localhost:8000/health
```
Doc d'entrée : `engine/README.md` · Plan : `docs/feature-plans/engine-p3-ia-data.md`

## 🧹 Nettoyage disque — restant (optionnel, sur demande)
- `~/.cache/huggingface` 14 Go (modèles HF) — confirmer avant suppression.
- Volumes Docker inutilisés 2,3 Go.
- `~/.steam` 13 Go — **ne pas toucher**.
