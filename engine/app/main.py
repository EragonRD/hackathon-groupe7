"""Engine — Pôle 3 (IA & Data). Point d'entrée FastAPI.

Détail des endpoints d'analyse : voir engine/tasks/10-api-engine.md.
Pour l'instant, seul /health est exposé (socle tâche 00).
"""

from fastapi import FastAPI

app = FastAPI(title="Engine — Pôle 3 (IA & Data)", version="0.1.0")


@app.get("/health")
def health() -> dict:
    """Sonde de vie du service Engine."""
    return {"status": "ok", "service": "engine", "pole": 3}
