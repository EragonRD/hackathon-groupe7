"""API FastAPI bonus — expose les analyses et prédictions P3-B (tâches 30-33).

⚠️ Hors périmètre officiel : le livrable demandé par les fiches de tâche est
le dashboard Streamlit (`dashboard/app.py`). Cette API est un ajout bonus
pour un consommateur front qui préfère du JSON. Tourne sur un port distinct
de l'API Engine principale (P3-A, `app/main.py`, port 8000).

Lancer (depuis `engine/`) :
  uvicorn app.data.api.main:app --reload --port 8010

Docs interactives : http://localhost:8010/docs (Swagger) ou /redoc
"""
from __future__ import annotations
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.data.api.routers import kpis, videos, categories, comparison, predictions

app = FastAPI(
    title="Engine — Pôle 3-B (Data/Rétention) — API bonus",
    description=(
        "API d'exposition des analyses d'audience & de rétention : métriques "
        "par vidéo, zones d'ennui détectées, analyses par catégorie, et "
        "prédictions (rétention, intervalle d'ennui, risque d'abandon). "
        "Bonus d'intégration hors périmètre officiel des tâches 30-33."
    ),
    version="1.0.0",
)

# Origines autorisées : liste séparée par des virgules dans CORS_ORIGINS
# (ex. "https://front.exemple.com,http://localhost:5173" — 5173 = Vite/frontend).
# Par défaut "*" pour faciliter le développement — à restreindre en production.
_origins = os.environ.get("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _origins == "*" else [o.strip() for o in _origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(kpis.router)
app.include_router(videos.router)
app.include_router(categories.router)
app.include_router(comparison.router)
app.include_router(predictions.router)


@app.get("/", tags=["Santé"], summary="Vérification de disponibilité")
def root() -> dict:
    return {"status": "ok", "docs": "/docs"}
