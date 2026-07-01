"""Benchmark du pipeline P3-A sur une vidéo réelle (mesures, pas estimations).

Mesure, par étape : extraction audio (ffmpeg), transcription (faster-whisper base int8),
résumé (llama.cpp Qwen2.5-1.5B Q4), embeddings (MiniLM multilingue).

Usage : .venv/bin/python tests/bench_pipeline.py "media/<video>.mp4"
Produit un récap chiffré (temps + RTF + tokens/s) pour calibrer les estimations.
"""

import subprocess
import sys
import time
from pathlib import Path

VIDEO = sys.argv[1] if len(sys.argv) > 1 else "media/42 - POC Parc des Princes V1 .mp4"
WAV = "/tmp/bench_audio.wav"
MODEL_GGUF = "models/qwen2.5-1.5b-instruct-q4_k_m.gguf"


def dur_of(path: str) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path]
    )
    return float(out)


def main() -> None:
    dur = dur_of(VIDEO)
    print(f"[VIDEO] {VIDEO} | durée={dur:.1f}s")

    # 1) Extraction audio
    t = time.time()
    subprocess.run(
        ["ffmpeg", "-y", "-i", VIDEO, "-ar", "16000", "-ac", "1", "-vn", WAV],
        check=True, capture_output=True,
    )
    t_ff = time.time() - t

    # 2) Transcription (load séparé du compute)
    from faster_whisper import WhisperModel
    t = time.time()
    wm = WhisperModel("base", device="cpu", compute_type="int8")
    t_wload = time.time() - t
    t = time.time()
    segments, info = wm.transcribe(WAV, beam_size=1)
    segs = list(segments)
    t_tr = time.time() - t
    transcript = " ".join(s.text for s in segs).strip()
    n_words = len(transcript.split())

    # 3) Résumé (llama.cpp)
    from llama_cpp import Llama
    t = time.time()
    llm = Llama(model_path=MODEL_GGUF, n_ctx=4096, n_threads=4, verbose=False)
    t_lload = time.time() - t
    prompt = f"Résume en 3 phrases ce transcript:\n{transcript[:3000]}"
    t = time.time()
    out = llm.create_chat_completion(
        messages=[{"role": "user", "content": prompt}], max_tokens=200, temperature=0.2,
    )
    t_sum = time.time() - t
    usage = out.get("usage", {})
    gen_tok = usage.get("completion_tokens", 0)

    # 4) Embeddings
    from sentence_transformers import SentenceTransformer
    t = time.time()
    em = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    t_eload = time.time() - t
    texts = [s.text for s in segs] or [transcript[:200]]
    t = time.time()
    em.encode(texts)
    t_emb = time.time() - t

    rtf = t_tr / dur if dur else 0
    tok_s = gen_tok / t_sum if t_sum else 0
    print("\n========== RÉSULTATS (machine i5-1145G7, CPU) ==========")
    print(f"durée_audio_s          {dur:8.1f}")
    print(f"segments / mots        {len(segs):4d} / {n_words}")
    print(f"ffmpeg_extract_s       {t_ff:8.2f}")
    print(f"whisper_load_s*        {t_wload:8.2f}  (*inclut DL au 1er run)")
    print(f"whisper_transcribe_s   {t_tr:8.2f}   RTF={rtf:.3f} (x{1/rtf:.1f} temps réel)" if rtf else "")
    print(f"llama_load_s           {t_lload:8.2f}")
    print(f"llama_summary_s        {t_sum:8.2f}   {gen_tok} tok -> {tok_s:.1f} tok/s")
    print(f"embed_load_s*          {t_eload:8.2f}  (*inclut DL au 1er run)")
    print(f"embed_encode_s         {t_emb:8.2f}   ({len(texts)} segments)")
    total_compute = t_ff + t_tr + t_sum + t_emb
    print(f"TOTAL_compute_s        {total_compute:8.2f}  (hors chargements/DL)")
    print("========================================================")


if __name__ == "__main__":
    main()
