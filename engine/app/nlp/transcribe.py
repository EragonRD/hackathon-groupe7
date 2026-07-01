"""Transcription baseline (T20 — Duval affinera).

Extraction audio ffmpeg → faster-whisper (segments horodatés + langue).
"""

import os
import subprocess
import tempfile

from ..models import get_whisper


def extract_audio(video_path: str, wav_path: str) -> None:
    """Extrait l'audio en WAV 16 kHz mono (format attendu par Whisper)."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-ar", "16000", "-ac", "1", "-vn", wav_path],
        check=True,
        capture_output=True,
    )


def transcribe(video_path: str) -> dict:
    """Retourne {language, transcript, segments[{start,end,text}]}."""
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
    return {"language": info.language, "transcript": transcript, "segments": segs}
