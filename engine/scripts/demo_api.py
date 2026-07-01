"""Démo HTTP de l'API Engine (T10) — exerce le flux complet avec un vrai token.

Pré-requis : l'API tourne (uvicorn app.main:app). Usage :
    .venv/bin/python scripts/demo_api.py "../media/<video>.mp4"
"""

import os
import sys
import time

import httpx
import jwt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import config  # noqa: E402

BASE = os.getenv("ENGINE_URL", "http://localhost:8000")
VIDEO = sys.argv[1] if len(sys.argv) > 1 else "../media/42 - POC Parc des Princes V1 .mp4"

token = jwt.encode(
    {"sub": 1, "username": "alice", "role": "admin"},
    config.JWT_SECRET,
    algorithm=config.JWT_ALGORITHM,
)
H = {"Authorization": f"Bearer {token}"}

print("1) /health            ->", httpx.get(f"{BASE}/health").json())
print("2) /analyze sans token->", httpx.post(f"{BASE}/analyze-path", json={"path": VIDEO}).status_code, "(attendu 401)")

job = httpx.post(f"{BASE}/analyze-path", json={"path": VIDEO}, headers=H).json()["job_id"]
print("3) job créé           ->", job)

while True:
    st = httpx.get(f"{BASE}/jobs/{job}", headers=H, timeout=30).json()
    if st["status"] in ("done", "error"):
        break
    time.sleep(2)

if st["status"] == "error":
    print("   ERREUR:", st["error"])
    sys.exit(1)

m = st["result"]
print("4) métadonnées:")
print("   language     :", m["language"], "| duration_sec:", m["duration_sec"], "| segments:", len(m["segments"]))
print("   summary      :", m["summary"])
print("   chapters     :", m["chapters"])
print("   keywords     :", m["keywords"])
print("   translation  :", m["translation"]["lang"], "->", m["translation"]["text"][:90], "...")

hits = httpx.post(f"{BASE}/search", json={"job_id": job, "query": "stade", "k": 2}, headers=H).json()
print("5) /search 'stade'    ->", [(round(h["score"], 3), h["start"], h["text"][:50]) for h in hits["hits"]])
print("\nOK — flux complet validé.")
