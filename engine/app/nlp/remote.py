"""Clients IA distants (OpenAI-compatible) — Groq & OpenRouter.

- `chat()`   : complétion de chat (résumé / chapitres / traduction). Groq OU OpenRouter.
- `transcribe_audio()` : Speech-to-Text (Whisper). **Groq uniquement**
  (OpenRouter n'expose pas d'endpoint audio).

Gestion : timeout, retries avec back-off sur 429 / 5xx, erreurs explicites.
Aucune clé n'est stockée ici : tout vient de `config` (env / .env).
"""

import time

import httpx

from .. import config


class RemoteError(RuntimeError):
    """Échec d'un appel distant (permet au module appelant de basculer en local)."""


# Horodatage du dernier appel par provider (throttle « 1 RPS » type Mistral free).
_last_call: dict[str, float] = {}

# Compteurs d'instrumentation (bench) : nb d'appels HTTP et de 429 rencontrés.
STATS = {"calls": 0, "http_429": 0}


def reset_stats() -> None:
    STATS["calls"] = STATS["http_429"] = 0


def _throttle(provider: str) -> None:
    interval = config.CHAT_MIN_INTERVAL.get(provider, 0)
    if interval <= 0:
        return
    wait = interval - (time.monotonic() - _last_call.get(provider, 0))
    if wait > 0:
        time.sleep(wait)
    _last_call[provider] = time.monotonic()


# --- Résolution du provider -------------------------------------------------

def _provider_conf(provider: str) -> tuple[str, str, str]:
    """Retourne (base_url, api_key, chat_model) pour un provider chat donné."""
    if provider == "groq":
        return config.GROQ_BASE_URL, config.GROQ_API_KEY, config.GROQ_LLM_MODEL
    if provider == "openrouter":
        return config.OPENROUTER_BASE_URL, config.OPENROUTER_API_KEY, config.OPENROUTER_LLM_MODEL
    if provider == "gemini":
        return config.GEMINI_BASE_URL, config.GEMINI_API_KEY, config.GEMINI_LLM_MODEL
    if provider == "mistral":
        return config.MISTRAL_BASE_URL, config.MISTRAL_API_KEY, config.MISTRAL_LLM_MODEL
    raise RemoteError(f"Provider chat inconnu : {provider!r}")


def chat_available(provider: str | None = None) -> bool:
    provider = provider or config.LLM_PROVIDER
    if provider not in config.CHAT_PROVIDERS:
        return False
    _, key, _ = _provider_conf(provider)
    return bool(key)


def asr_available() -> bool:
    return config.ASR_PROVIDER == "groq" and bool(config.GROQ_API_KEY)


# --- Bas niveau : POST avec retries ----------------------------------------

def _post(url: str, headers: dict, *, json=None, data=None, files=None) -> dict:
    last: Exception | None = None
    for attempt in range(config.HTTP_RETRIES):
        STATS["calls"] += 1
        try:
            resp = httpx.post(
                url, headers=headers, json=json, data=data, files=files,
                timeout=config.HTTP_TIMEOUT,
            )
        except httpx.HTTPError as exc:
            last = exc
        else:
            if resp.status_code < 400:
                return resp.json()
            if resp.status_code == 429:
                STATS["http_429"] += 1
            # 429 (rate limit) / 5xx : on retente avec back-off ; sinon on abandonne.
            if resp.status_code == 429 or resp.status_code >= 500:
                last = RemoteError(f"HTTP {resp.status_code}: {resp.text[:200]}")
                if attempt == config.HTTP_RETRIES - 1:
                    break  # dernière tentative : ne pas dormir pour rien
                retry_after = resp.headers.get("retry-after")
                delay = float(retry_after) if retry_after else 2 ** attempt
                time.sleep(min(delay, config.HTTP_MAX_BACKOFF))
                continue
            raise RemoteError(f"HTTP {resp.status_code}: {resp.text[:300]}")
    raise RemoteError(f"Échec après {config.HTTP_RETRIES} tentatives : {last}")


# --- Chat (LLM) -------------------------------------------------------------

def chat(
    prompt: str,
    *,
    max_tokens: int = 256,
    temperature: float = 0.2,
    provider: str | None = None,
    model: str | None = None,
    system: str | None = None,
) -> str:
    """Complétion de chat. Lève RemoteError si pas de clé / échec réseau."""
    provider = provider or config.LLM_PROVIDER
    base_url, api_key, default_model = _provider_conf(provider)
    model = model or default_model
    if not api_key:
        raise RemoteError(f"{provider}: clé API absente")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if provider == "openrouter":
        # En-têtes recommandés par OpenRouter (facultatifs mais polis).
        headers["HTTP-Referer"] = "https://poulpium.local"
        headers["X-Title"] = "Poulpium Engine"

    body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    _throttle(provider)  # respecte un éventuel « 1 RPS » (Mistral free tier)
    data = _post(f"{base_url}/chat/completions", headers, json=body)
    try:
        return (data["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise RemoteError(f"Réponse chat inattendue: {str(data)[:200]}") from exc


# --- Transcription (Whisper via Groq) --------------------------------------

def transcribe_audio(audio_path: str, *, language: str | None = None) -> dict:
    """POST /audio/transcriptions (Groq) → {language, transcript, segments[]}.

    `response_format=verbose_json` fournit les segments horodatés.
    """
    if not config.GROQ_API_KEY:
        raise RemoteError("groq: clé API absente")
    headers = {"Authorization": f"Bearer {config.GROQ_API_KEY}"}
    form = {"model": config.GROQ_WHISPER_MODEL, "response_format": "verbose_json"}
    if language:
        form["language"] = language
    with open(audio_path, "rb") as fh:
        files = {"file": (audio_path.rsplit("/", 1)[-1], fh, "application/octet-stream")}
        data = _post(
            f"{config.GROQ_BASE_URL}/audio/transcriptions", headers, data=form, files=files
        )
    segs = [
        {
            "start": round(float(s.get("start", 0.0)), 2),
            "end": round(float(s.get("end", 0.0)), 2),
            "text": (s.get("text") or "").strip(),
        }
        for s in data.get("segments", [])
    ]
    transcript = (data.get("text") or " ".join(s["text"] for s in segs)).strip()
    return {"language": data.get("language", language or ""), "transcript": transcript, "segments": segs}
