"""Configuration de l'Engine (variables d'environnement + valeurs par défaut)."""

import os
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent  # engine/
MODELS_DIR = ENGINE_DIR / "models"


def _load_dotenv(path: Path) -> None:
    """Charge un .env minimal (KEY=VALUE) sans écraser l'environnement existant."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_dotenv(ENGINE_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() not in ("false", "0", "no", "")


# --- Auth : ALIGNÉE sur le Core (backend/src/auth/auth.module.ts) ---
# Core NestJS : JwtModule HS256, secret = JWT_SECRET ?? 'dev-secret-change-me'.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
# Refus par défaut. Mettre ENGINE_REQUIRE_AUTH=false pour tester en local sans le Core.
REQUIRE_AUTH = os.getenv("ENGINE_REQUIRE_AUTH", "true").lower() != "false"

# --- Modèles (légers, CPU) — cf. docs/model-selection.md ---
# small = bon compromis local : ~1 Go RAM, multilingue correct (mesuré). Eviter
# distil-large-v3 (anglais-only) et medium/large (trop lents sur NAS modeste).
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")
# Threads CPU pour faster-whisper. 0 = auto (prend tous les cœurs). Sur NAS
# modeste, plafonner (ex. 3) laisse des cœurs à ffmpeg / au reste du système.
WHISPER_CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "0"))
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

# ============================================================================
# Providers IA distants (Groq / OpenRouter / Gemini) — remplacent le local.
# Chaque étape choisit SON provider INDÉPENDAMMENT ; repli local si activé.
#   ENGINE_ASR_PROVIDER       = groq | local                       (audio)
#   ENGINE_LLM_PROVIDER       = groq | openrouter | gemini | local (chat)
#   ENGINE_TRANSLATE_PROVIDER = groq | openrouter | gemini | local (chat)
# Ex. clés mixées : ASR=groq, LLM=openrouter, TRANSLATE=gemini.
# ============================================================================
# Transcription : groq (Whisper) | nvidia (Whisper via Riva gRPC) | local.
ASR_PROVIDER = os.getenv("ENGINE_ASR_PROVIDER", "groq").strip().lower()
ASR_PROVIDERS = ("groq", "nvidia", "local")
LLM_PROVIDER = os.getenv("ENGINE_LLM_PROVIDER", "groq").strip().lower()
TRANSLATE_PROVIDER = os.getenv("ENGINE_TRANSLATE_PROVIDER", "groq").strip().lower()
# Repli local automatique si l'API échoue / pas de clé (nécessite les modèles locaux).
ALLOW_LOCAL_FALLBACK = _bool("ENGINE_ALLOW_LOCAL_FALLBACK", True)

# Providers de chat supportés (OpenAI-compatible).
CHAT_PROVIDERS = ("groq", "openrouter", "gemini", "mistral")

# Le modèle de TRADUCTION peut différer de celui du RÉSUMÉ (charge de tokens plus
# lourde : penser aux modèles à fort TPD/TPM). Défaut = modèle de chat du provider.

# --- Groq (API OpenAI-compatible) ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
GROQ_LLM_MODEL = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-20b")
# Traduction : llama-4-scout = 30K TPM (absorbe le burst multi-langues), bonne
# qualité ar/zh/ja. Testé 3 langues en ~7s. (8b-instant plafonne à 6K TPM -> 429.)
GROQ_TRANSLATE_MODEL = os.getenv("GROQ_TRANSLATE_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

# --- OpenRouter (API OpenAI-compatible, chat uniquement) ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
OPENROUTER_LLM_MODEL = os.getenv("OPENROUTER_LLM_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
OPENROUTER_TRANSLATE_MODEL = os.getenv("OPENROUTER_TRANSLATE_MODEL", OPENROUTER_LLM_MODEL)

# --- Google Gemini (AI Studio, endpoint OpenAI-compatible, chat uniquement) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_BASE_URL = os.getenv(
    "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"
).rstrip("/")
GEMINI_LLM_MODEL = os.getenv("GEMINI_LLM_MODEL", "gemini-2.0-flash")
GEMINI_TRANSLATE_MODEL = os.getenv("GEMINI_TRANSLATE_MODEL", GEMINI_LLM_MODEL)

# --- Mistral (La Plateforme, endpoint OpenAI-compatible, chat uniquement) ---
# Free tier : ~1 req/s max, pas de parallélisme -> forcer une boucle SÉQUENTIELLE.
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "").strip()
MISTRAL_BASE_URL = os.getenv("MISTRAL_BASE_URL", "https://api.mistral.ai/v1").rstrip("/")
MISTRAL_LLM_MODEL = os.getenv("MISTRAL_LLM_MODEL", "mistral-small-latest")
MISTRAL_TRANSLATE_MODEL = os.getenv("MISTRAL_TRANSLATE_MODEL", "open-mistral-nemo")

# Modèle de traduction résolu par provider.
TRANSLATE_MODELS = {
    "groq": GROQ_TRANSLATE_MODEL,
    "openrouter": OPENROUTER_TRANSLATE_MODEL,
    "gemini": GEMINI_TRANSLATE_MODEL,
    "mistral": MISTRAL_TRANSLATE_MODEL,
}

# Délai mini entre appels chat par provider (s) — respecte les limites « 1 RPS »
# (Mistral free tier). 0 = pas de throttle.
CHAT_MIN_INTERVAL = {"mistral": float(os.getenv("MISTRAL_MIN_INTERVAL", "1.2"))}

# --- NVIDIA NIM / Riva (transcription Whisper via gRPC NVCF) ----------------
# ATTENTION : nécessite `pip install nvidia-riva-client`. Clé (nvapi-...) qui
# EXPIRE ~30 jours. Le function-id est à récupérer sur l'onglet « Try API » de
# https://build.nvidia.com/openai/whisper-large-v3 (bouton Get API Key / code).
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "").strip()
NVIDIA_ASR_SERVER = os.getenv("NVIDIA_ASR_SERVER", "grpc.nvcf.nvidia.com:443")
NVIDIA_ASR_FUNCTION_ID = os.getenv("NVIDIA_ASR_FUNCTION_ID", "").strip()
# "multi" = détection auto (Whisper multilingue). Sinon code type "en-US", "fr-FR".
NVIDIA_ASR_LANGUAGE = os.getenv("NVIDIA_ASR_LANGUAGE", "multi").strip()

# --- HTTP (timeouts / retries partagés par les clients distants) ---
HTTP_TIMEOUT = float(os.getenv("ENGINE_HTTP_TIMEOUT", "120"))
HTTP_RETRIES = int(os.getenv("ENGINE_HTTP_RETRIES", "2"))
# Plafond du back-off entre tentatives (évite d'attendre un long `retry-after`
# sur un modèle gratuit saturé : on échoue vite → repli / autre provider).
HTTP_MAX_BACKOFF = float(os.getenv("ENGINE_HTTP_MAX_BACKOFF", "8"))

# --- /analyze-path (test/démo) : répertoire AUTORISÉ pour l'analyse de fichiers
# locaux. Vide (défaut) => l'endpoint est DÉSACTIVÉ (403). Sinon, seuls les fichiers
# strictement à l'intérieur de ce dossier sont acceptés (anti-path-traversal /
# anti-lecture de fichiers arbitraires du conteneur comme /etc/passwd).
ANALYZE_PATH_BASE = os.getenv("ANALYZE_PATH_BASE", "").strip()
