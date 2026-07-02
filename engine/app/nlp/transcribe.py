"""Transcription — provider distant (Groq/Whisper) ou local (faster-whisper).

Sélection via `config.ASR_PROVIDER` (groq | local). Repli local automatique
si l'API échoue et que `config.ALLOW_LOCAL_FALLBACK` est vrai.

Sortie normalisée (contrat P3-A) : {language, transcript, segments[{start,end,text}]}.
"""

import os
import subprocess
import tempfile

from .. import config
from . import nvidia_asr, remote


def extract_audio(video_path: str, wav_path: str) -> None:
    """Extrait l'audio en WAV 16 kHz mono (format attendu par faster-whisper local)."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-ar", "16000", "-ac", "1", "-vn", wav_path],
        check=True,
        capture_output=True,
    )


def extract_audio_compressed(video_path: str, mp3_path: str) -> None:
    """Extrait un MP3 16 kHz mono léger (upload rapide + sous la limite de taille de l'API)."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-ar", "16000", "-ac", "1", "-vn",
         "-b:a", "48k", mp3_path],
        check=True,
        capture_output=True,
    )


def _detect_lang_from_text(text: str, fallback: str) -> str:
    """Redétecte la langue sur le TEXTE transcrit (plus fiable que la détection
    audio de Whisper small/base, qui confond parfois l'anglais accentué avec le
    gallois 'cy'). Repli sur la détection audio si le texte est trop court/échec.
    """
    text = (text or "").strip()
    if len(text) < 20:
        return fallback
    try:
        from langdetect import DetectorFactory, detect

        DetectorFactory.seed = 0  # déterminisme
        return detect(text)
    except Exception:  # noqa: BLE001 — pas de langdetect / texte inclassable
        return fallback


def _transcribe_local(video_path: str) -> dict:
    """Transcription 100 % locale (faster-whisper) — repli / mode offline."""
    from ..models import get_whisper

    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "audio.wav")
        extract_audio(video_path, wav)
        model = get_whisper()
        segments, info = model.transcribe(wav, beam_size=1, vad_filter=True)
        segs = [
            {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
            for s in segments
        ]
    transcript = " ".join(s["text"] for s in segs).strip()
    # Corrige l'etiquette de langue via le texte (fix cy/en sur accents marques).
    language = _detect_lang_from_text(transcript, info.language)
    return {"language": language, "transcript": transcript, "segments": segs}


def _transcribe_groq(video_path: str) -> dict:
    """Transcription via Groq (Whisper). Extrait un MP3 léger puis l'envoie."""
    with tempfile.TemporaryDirectory() as td:
        mp3 = os.path.join(td, "audio.mp3")
        extract_audio_compressed(video_path, mp3)
        return remote.transcribe_audio(mp3)


def _transcribe_nvidia(video_path: str) -> dict:
    """Transcription via NVIDIA Whisper (Riva gRPC). Envoie un WAV 16 kHz mono."""
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "audio.wav")
        extract_audio(video_path, wav)
        return nvidia_asr.transcribe_wav(wav)


def transcribe(video_path: str) -> dict:
    """Retourne {language, transcript, segments[{start,end,text}]}."""
    # Choix explicite du local -> on l'utilise directement (pas un repli).
    if config.ASR_PROVIDER == "local":
        return _transcribe_local(video_path)
    if config.ASR_PROVIDER == "groq" and remote.asr_available():
        try:
            return _transcribe_groq(video_path)
        except remote.RemoteError:
            if not config.ALLOW_LOCAL_FALLBACK:
                raise
    elif config.ASR_PROVIDER == "nvidia" and nvidia_asr.available():
        try:
            return _transcribe_nvidia(video_path)
        except nvidia_asr.NvidiaError:
            if not config.ALLOW_LOCAL_FALLBACK:
                raise
    # Provider distant choisi mais indisponible : en mode API strict, pas de repli.
    if not config.ALLOW_LOCAL_FALLBACK:
        raise RuntimeError(
            f"Transcription indisponible en mode API strict (provider={config.ASR_PROVIDER}, "
            "clé/config manquante et repli local désactivé)."
        )
    return _transcribe_local(video_path)
