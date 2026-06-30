"""Configuration de l'Engine (variables d'environnement + valeurs par défaut)."""

import os
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent  # engine/
MODELS_DIR = ENGINE_DIR / "models"

# --- Auth : ALIGNÉE sur le Core (backend/src/auth/auth.module.ts) ---
# Core NestJS : JwtModule HS256, secret = JWT_SECRET ?? 'dev-secret-change-me'.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
# Refus par défaut. Mettre ENGINE_REQUIRE_AUTH=false pour tester en local sans le Core.
REQUIRE_AUTH = os.getenv("ENGINE_REQUIRE_AUTH", "true").lower() != "false"

# --- Modèles (légers, CPU) — cf. docs/model-selection.md ---
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")
EMBED_MODEL = os.getenv("EMBED_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
LLM_GGUF = os.getenv("LLM_GGUF", str(MODELS_DIR / "qwen2.5-1.5b-instruct-q4_k_m.gguf"))
LLM_N_CTX = int(os.getenv("LLM_N_CTX", "4096"))
LLM_THREADS = int(os.getenv("LLM_THREADS", "4"))

# --- Traduction multilingue (sous-titres) — modèle dédié NLLB ---
NLLB_MODEL = os.getenv("NLLB_MODEL", "facebook/nllb-200-distilled-600M")
# Par défaut : le plus de langues possible (toutes celles supportées par la map NLLB).
# Surchargeable : TARGET_LANGS="fr,en,es" pour aller plus vite.
_DEFAULT_LANGS = "fr,en,es,ar,de,it,pt,nl,ru,zh,ja,ko,hi,tr,pl"
TARGET_LANGS = [c.strip() for c in os.getenv("TARGET_LANGS", _DEFAULT_LANGS).split(",") if c.strip()]

# --- Sorties : 1 dossier par vidéo (vidéo + 1 JSON par langue + métadonnées) ---
OUTPUT_DIR = os.getenv("ENGINE_OUTPUT_DIR", str(ENGINE_DIR / "outputs"))
