# Tâche 00 — Socle environnement Python · Responsable : Rabah

## Objectif
Poser un environnement Python reproductible, 100 % local, et la structure de code de l'Engine. Pré-requis de **toutes** les autres tâches.

## Entrées / Sorties
| Entrées | Sorties |
|---|---|
| Dépôt, `python3.10` | `engine/.venv/`, `engine/requirements.txt`, arborescence `app/`, `dashboard/` |

## Dépendances
Aucune (tâche fondatrice). Bloque 10→33.

## Étapes (checklist)
- [x] ✅ Créer `engine/.venv` (via **virtualenv** — `python3.10-venv` absent) + activer
- [x] ✅ Créer `requirements.txt` (fastapi, uvicorn, python-multipart, faster-whisper, llama-cpp-python, sentence-transformers, keybert, scikit-learn, pandas, numpy, streamlit, ffmpeg-python)
- [x] ✅ Vérifier `ffmpeg` système → présent (4.4.2)
- [x] ✅ Créer l'arborescence : `app/__init__.py`, `app/main.py` (+ `/health`), `app/nlp/`, `app/data/`, `dashboard/app.py`
- [x] ✅ Ajouter `engine/.gitignore`
- [x] ✅ Dossier `models/` (`.gitkeep`)
- [x] ✅ `engine/README` : commande de démarrage réelle (virtualenv)
- [x] ✅ Install **core** (fastapi/uvicorn/pandas/numpy/scikit-learn/ffmpeg-python) + boot `/health` validé
- [x] ✅ Install **CPU-only** (torch+cpu, faster-whisper, llama-cpp-python wheel CPU, sentence-transformers, keybert, streamlit)

## Critères « fait »
- [x] `uvicorn app.main:app` démarre, `/health` → `{"status":"ok",...}` ✅
- [x] Toutes les dépendances installées, imports OK, `torch.cuda.is_available()==False` ✅
- [x] Aucune dépendance payante / cloud ✅

## ✅ Tâche 00 TERMINÉE

## Constats / pièges rencontrés
- `python3.10-venv` (ensurepip) **absent** → contournement **sans sudo** : `pip install --user virtualenv` puis `virtualenv .venv`.
- `cmake` absent : si `llama-cpp-python` ne trouve pas de wheel, `sudo apt install cmake`.
- `ffmpeg` 4.4.2 présent.
- Lancer `scripts/prefetch.sh` tôt pour récupérer modèles hors-ligne.
