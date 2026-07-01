"""Tests API (T10) — rapides, sans charger les modèles."""

import jwt
from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


def _token() -> str:
    return jwt.encode(
        {"sub": 1, "username": "alice", "role": "admin"},
        config.JWT_SECRET,
        algorithm=config.JWT_ALGORITHM,
    )


def _auth() -> dict:
    return {"Authorization": f"Bearer {_token()}"}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_analyze_requires_auth():
    r = client.post("/analyze-path", json={"path": "/whatever.mp4"})
    assert r.status_code == 401


def test_analyze_rejects_forged_token():
    bad = jwt.encode({"sub": 1}, "mauvais-secret", algorithm="HS256")
    r = client.post(
        "/analyze-path", json={"path": "/x.mp4"}, headers={"Authorization": f"Bearer {bad}"}
    )
    assert r.status_code == 401


def test_analyze_valid_token_bad_path():
    # Token valide → passe l'auth ; chemin inexistant → 400 (sans lancer le pipeline)
    r = client.post("/analyze-path", json={"path": "/no/such/file.mp4"}, headers=_auth())
    assert r.status_code == 400


def test_search_unknown_job():
    r = client.post("/search", json={"job_id": "inconnu", "query": "test"}, headers=_auth())
    assert r.status_code == 404


def test_job_unknown():
    r = client.get("/jobs/inconnu", headers=_auth())
    assert r.status_code == 404
