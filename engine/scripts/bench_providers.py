"""Banc d'essai comparatif — transcription & traduction (préparation démo).

Objectif : mesurer, pour la démo sur NAS, le meilleur compromis LATENCE / FIABILITÉ.

- TRANSCRIPTION : compare `local` (faster-whisper) vs `groq` (Whisper) — temps,
  nb de segments, présence des timestamps.
- TRADUCTION : pour un même jeu de segments, compare plusieurs (provider, modèle)
  — temps, langues réussies/total, nb d'appels HTTP, nb de 429.

Une PAUSE configurable entre candidats évite la pollution des mesures par les
limites TPM au niveau organisation (défaut 20s ; 0 pour enchaîner).

Usage :
  .venv/bin/python scripts/bench_providers.py --langs en,es,ar --pause 20
  .venv/bin/python scripts/bench_providers.py --video tests/examples/speech1.mp4 --out bench.md
"""

import argparse
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import config  # noqa: E402
from app.nlp import remote, transcribe, translate  # noqa: E402

# Candidats de TRADUCTION (provider, modèle). Adapter librement.
TRANSLATE_CANDIDATES = [
    ("groq", "meta-llama/llama-4-scout-17b-16e-instruct"),
    ("groq", "llama-3.1-8b-instant"),
    ("groq", "openai/gpt-oss-20b"),
    ("mistral", "open-mistral-nemo"),
    ("mistral", "mistral-small-latest"),
]

ENGINE_DIR = Path(config.ENGINE_DIR)
VIDEO_ROOTS = [ENGINE_DIR / "tests" / "examples", ENGINE_DIR.parent / "media"]
VIDEO_EXTS = {".mp4", ".mkv", ".mov", ".webm", ".m4v"}


def smallest_video() -> str:
    cands = []
    for root in VIDEO_ROOTS:
        if root.is_dir():
            cands += [p for p in root.rglob("*") if p.suffix.lower() in VIDEO_EXTS]
    if not cands:
        sys.exit("Aucune vidéo trouvée.")
    return str(min(cands, key=lambda p: p.stat().st_size))


def bench_asr(video: str) -> tuple[list, list[str]]:
    """Compare transcription locale vs Groq. Retourne (segments de référence, lignes de rapport)."""
    rows, ref_segments = [], None
    backends = [("local", transcribe._transcribe_local), ("groq", transcribe._transcribe_groq)]
    for name, fn in backends:
        if name == "groq" and not remote.asr_available():
            rows.append(f"| {name} | (clé absente) | - | - |")
            continue
        try:
            t0 = time.time()
            r = fn(video)
            dt = time.time() - t0
        except Exception as exc:  # noqa: BLE001
            rows.append(f"| {name} | ERREUR: {str(exc)[:40]} | - | - |")
            continue
        segs = r["segments"]
        has_ts = any(s["end"] > 0 for s in segs)
        rows.append(f"| {name} | {dt:.1f}s | {len(segs)} | {'oui' if has_ts else 'NON'} |")
        # Référence pour la traduction : on privilégie un jeu AVEC timestamps.
        if ref_segments is None or (has_ts and not any(s["end"] > 0 for s in ref_segments)):
            ref_segments = segs
    return ref_segments or [], rows


def bench_translate(segments: list, source_lang: str, langs: list[str], pause: float) -> list[str]:
    rows = []
    transcript = " ".join(s["text"] for s in segments)
    targets = [l for l in langs if l[:2] != (source_lang or "")[:2]]
    for i, (provider, model) in enumerate(TRANSLATE_CANDIDATES):
        key_ok = remote.chat_available(provider)
        if not key_ok:
            rows.append(f"| {provider} | {model} | (clé absente) | - | - | - |")
            continue
        if i and pause:
            time.sleep(pause)  # laisse le TPM se réinitialiser entre candidats
        config.TRANSLATE_PROVIDER = provider
        config.TRANSLATE_MODELS[provider] = model
        remote.reset_stats()
        t0 = time.time()
        tracks = translate.translate_all(transcript, segments, source_lang, targets)
        dt = time.time() - t0
        ok = len(tracks)
        rows.append(
            f"| {provider} | {model} | {dt:.1f}s | {ok}/{len(targets)} | "
            f"{remote.STATS['calls']} | {remote.STATS['http_429']} |"
        )
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Banc d'essai providers (démo).")
    ap.add_argument("--video", help="vidéo (défaut : la plus petite)")
    ap.add_argument("--langs", default="en,es,ar", help="langues cibles (défaut en,es,ar)")
    ap.add_argument("--pause", type=float, default=20.0, help="pause (s) entre candidats trad. (défaut 20)")
    ap.add_argument("--out", help="écrit le rapport dans un fichier .md")
    args = ap.parse_args()

    # Bench = mesure du DISTANT pur : pas de repli local qui masquerait les échecs.
    config.ALLOW_LOCAL_FALLBACK = False

    video = args.video or smallest_video()
    langs = [c.strip() for c in args.langs.split(",") if c.strip()]
    print(f"Vidéo : {video} ({os.path.getsize(video) / 1e6:.1f} Mo) | langues : {', '.join(langs)}\n")

    segments, asr_rows = bench_asr(video)
    source_lang = ""  # inconnu ici ; la traduction distante gère "the source language"
    tr_rows = bench_translate(segments, source_lang, langs, args.pause)

    out = ["# Banc d'essai providers — préparation démo", ""]
    out += [f"Vidéo : `{os.path.basename(video)}` | langues : {', '.join(langs)}", ""]
    out += ["## Transcription", "", "| Backend | Temps | Segments | Timestamps |", "|---|---|---|---|"]
    out += asr_rows + ["", "## Traduction (mêmes segments)", ""]
    out += ["| Provider | Modèle | Temps | Langues OK | Appels HTTP | 429 |", "|---|---|---|---|---|---|"]
    out += tr_rows

    report = "\n".join(out)
    print(report)
    if args.out:
        Path(args.out).write_text(report + "\n", encoding="utf-8")
        print(f"\n-> écrit dans {args.out}")


if __name__ == "__main__":
    main()
