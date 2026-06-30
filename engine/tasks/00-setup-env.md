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
- [ ] ❌ Créer `engine/.venv` (`python3 -m venv .venv`) + activer
- [ ] ❌ Créer `requirements.txt` : `fastapi`, `uvicorn[standard]`, `python-multipart`, `faster-whisper`, `llama-cpp-python`, `sentence-transformers`, `keybert`, `scikit-learn`, `pandas`, `numpy`, `streamlit`, `ffmpeg-python`
- [ ] ❌ Vérifier `ffmpeg` système (`ffmpeg -version`), sinon documenter l'install
- [ ] ❌ Créer l'arborescence : `app/__init__.py`, `app/main.py`, `app/nlp/`, `app/data/`, `dashboard/`
- [ ] ❌ Ajouter `engine/.gitignore` (`.venv/`, `__pycache__/`, `models/`, `*.gguf`)
- [ ] ❌ Dossier `models/` (vide, `.gitkeep`) pour GGUF + modèles Whisper
- [ ] ❌ `engine/README` : compléter la commande de démarrage réelle

## Critères « fait »
- `pip install -r requirements.txt` réussit dans le venv.
- `uvicorn app.main:app` démarre (même avec un endpoint vide).
- Aucune dépendance payante / cloud.

## Notes / pièges
- `llama-cpp-python` se compile : prévoir `build-essential`/`cmake` si l'install échoue.
- Lancer `scripts/prefetch.sh` tôt pour récupérer modèles hors-ligne.
