"""Transcription via NVIDIA Whisper hébergé (Riva gRPC, NVCF).

Contrairement à Groq/OpenRouter, l'endpoint cloud NVIDIA n'est PAS OpenAI-
compatible : c'est du gRPC Riva. Nécessite `nvidia-riva-client` et un
`function-id` (onglet « Try API » de build.nvidia.com/openai/whisper-large-v3).

Sortie normalisée (contrat P3-A) : {language, transcript, segments[{start,end,text}]}.
Les segments sont reconstruits à partir des `results` offline de Riva
(un result ~ une utterance), horodatés via les word time offsets (ms).
"""

from .. import config


class NvidiaError(RuntimeError):
    pass


def available() -> bool:
    return bool(config.NVIDIA_API_KEY and config.NVIDIA_ASR_FUNCTION_ID)


def transcribe_wav(wav_path: str) -> dict:
    """Transcrit un WAV 16 kHz mono via Riva. Lève NvidiaError si indisponible."""
    if not available():
        raise NvidiaError("NVIDIA_API_KEY ou NVIDIA_ASR_FUNCTION_ID manquant")
    try:
        import riva.client
    except ImportError as exc:  # noqa: BLE001
        raise NvidiaError("paquet manquant : pip install nvidia-riva-client") from exc

    auth = riva.client.Auth(
        uri=config.NVIDIA_ASR_SERVER,
        use_ssl=True,
        metadata_args=[
            ["function-id", config.NVIDIA_ASR_FUNCTION_ID],
            ["authorization", f"Bearer {config.NVIDIA_API_KEY}"],
        ],
    )
    asr = riva.client.ASRService(auth)
    rec_config = riva.client.RecognitionConfig(
        language_code=config.NVIDIA_ASR_LANGUAGE,
        max_alternatives=1,
        enable_automatic_punctuation=True,
        enable_word_time_offsets=True,
    )
    with open(wav_path, "rb") as fh:
        audio = fh.read()
    try:
        resp = asr.offline_recognize(audio, rec_config)
    except Exception as exc:  # noqa: BLE001 — remonte proprement pour repli
        raise NvidiaError(f"Riva offline_recognize: {exc}") from exc

    segs: list[dict] = []
    language = "" if config.NVIDIA_ASR_LANGUAGE == "multi" else config.NVIDIA_ASR_LANGUAGE[:2]
    for res in getattr(resp, "results", []):
        alts = getattr(res, "alternatives", None)
        if not alts:
            continue
        alt = alts[0]
        text = (alt.transcript or "").strip()
        if not text:
            continue
        words = getattr(alt, "words", None) or []
        if words:
            start = words[0].start_time / 1000.0
            end = words[-1].end_time / 1000.0
        else:
            start = end = round(segs[-1]["end"], 2) if segs else 0.0
        segs.append({"start": round(start, 2), "end": round(end, 2), "text": text})
        lang = _lang_str(getattr(res, "language_code", "") or getattr(alt, "language_code", ""))
        if lang and not language:
            language = lang

    transcript = " ".join(s["text"] for s in segs).strip()
    return {"language": language, "transcript": transcript, "segments": segs}


def _lang_str(value) -> str:
    """Normalise le code langue Riva (champ potentiellement répété/liste) en 'xx'."""
    if isinstance(value, (list, tuple)):
        value = value[0] if value else ""
    elif not isinstance(value, str) and hasattr(value, "__len__"):
        value = value[0] if len(value) else ""  # RepeatedScalarContainer gRPC
    return str(value)[:2].lower()
