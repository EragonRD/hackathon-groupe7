"""CLI : transcription + traduction avec CHOIX du provider (Groq / OpenRouter).

Sélectionne le provider par étape puis analyse la vidéo la PLUS PETITE en stock
(ou un fichier passé en argument). Pratique pour comparer Groq vs OpenRouter.

Rappel : la transcription (audio) n'est possible qu'avec Groq (ou local) —
OpenRouter n'expose pas d'endpoint audio. Si OpenRouter est choisi pour la
transcription, on bascule automatiquement sur Groq.

Usage :
  .venv/bin/python scripts/analyze_choice.py                 # interactif
  .venv/bin/python scripts/analyze_choice.py --transcribe groq --translate openrouter
  .venv/bin/python scripts/analyze_choice.py --video chemin.mp4 --langs en,es,ar
"""

import argparse
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import config  # noqa: E402
from app.nlp import nvidia_asr, transcribe, translate  # noqa: E402

# Transcription : groq | nvidia | local. Traduction : tout provider de chat.
ASR_CHOICES = config.ASR_PROVIDERS  # groq | nvidia | local
TRANSLATE_CHOICES = config.CHAT_PROVIDERS  # groq | openrouter | gemini | mistral
ENGINE_DIR = Path(config.ENGINE_DIR)
# Dossiers où chercher une vidéo (on ignore outputs/ = copies générées).
VIDEO_ROOTS = [
    ENGINE_DIR / "tests" / "examples",
    ENGINE_DIR.parent / "media",
    ENGINE_DIR.parent / "frontend" / "public",
]
VIDEO_EXTS = {".mp4", ".mkv", ".mov", ".webm", ".m4v"}


def smallest_video() -> str:
    candidates = []
    for root in VIDEO_ROOTS:
        if root.is_dir():
            candidates += [p for p in root.rglob("*") if p.suffix.lower() in VIDEO_EXTS]
    if not candidates:
        sys.exit("Aucune vidéo trouvée dans " + ", ".join(str(r) for r in VIDEO_ROOTS))
    return str(min(candidates, key=lambda p: p.stat().st_size))


def ask(label: str, default: str, choices) -> str:
    raw = input(f"{label} [{'/'.join(choices)}] (défaut {default}) : ").strip().lower()
    return raw or default


def resolve_providers(args) -> tuple[str, str]:
    asr = args.transcribe or (ask("Transcription", "groq", ASR_CHOICES) if args.interactive else "groq")
    if asr not in ASR_CHOICES:
        asr = "groq"
    tr = args.translate or (ask("Traduction", "groq", TRANSLATE_CHOICES) if args.interactive else "groq")
    if tr not in TRANSLATE_CHOICES:
        tr = "groq"
    return asr, tr


def main() -> None:
    ap = argparse.ArgumentParser(description="Transcription + traduction avec choix du provider.")
    ap.add_argument("--transcribe", choices=ASR_CHOICES, help="provider de transcription (groq|nvidia|local)")
    ap.add_argument("--translate", choices=TRANSLATE_CHOICES, help="provider de traduction")
    ap.add_argument("--video", help="chemin vidéo (défaut : la plus petite en stock)")
    ap.add_argument("--langs", default="en,es", help="langues cibles, ex: en,es,ar (défaut en,es)")
    args = ap.parse_args()
    # Mode interactif si aucun provider n'est fourni en argument.
    args.interactive = not (args.transcribe and args.translate)

    asr, tr = resolve_providers(args)
    langs = [c.strip() for c in args.langs.split(",") if c.strip()]

    # Applique le choix au runtime (transcribe/translate lisent config.* à l'appel).
    config.ASR_PROVIDER = asr
    config.TRANSLATE_PROVIDER = tr

    if asr == "groq" and not config.GROQ_API_KEY:
        print("[!] GROQ_API_KEY absente -> transcription en repli LOCAL (si dispo).")
    if asr == "nvidia" and not nvidia_asr.available():
        print("[!] NVIDIA_API_KEY / NVIDIA_ASR_FUNCTION_ID manquant (ou riva-client absent) "
              "-> transcription en repli LOCAL (si dispo).")
    key_by_provider = {
        "openrouter": config.OPENROUTER_API_KEY, "gemini": config.GEMINI_API_KEY,
        "mistral": config.MISTRAL_API_KEY, "groq": config.GROQ_API_KEY,
    }
    if not key_by_provider.get(tr):
        print(f"[!] Clé {tr} absente -> traduction en repli LOCAL (si dispo).")

    video = args.video or smallest_video()
    size_mb = os.path.getsize(video) / 1e6
    print(f"\n=== Vidéo : {video} ({size_mb:.1f} Mo) ===")
    print(f"    Transcription : {asr}   |   Traduction : {tr}   |   Langues : {', '.join(langs)}\n")

    t0 = time.time()
    r = transcribe.transcribe(video)
    print(f"[Transcription] {time.time() - t0:.1f}s | langue={r['language']} | "
          f"segments={len(r['segments'])} | mots={len(r['transcript'].split())}")
    for s in r["segments"][:3]:
        print(f"    [{s['start']:>6.1f}-{s['end']:<6.1f}] {s['text'][:70]}")

    t1 = time.time()
    tracks = translate.translate_all(r["transcript"], r["segments"], r["language"], langs)
    print(f"\n[Traduction] {time.time() - t1:.1f}s | {len(tracks)} piste(s)")
    for t in tracks:
        ex = t["segments"][0]["text"] if t["segments"] else ""
        print(f"    [{t['lang']}] {len(t['segments'])} sous-titres | ex: {ex[:70]}")

    print(f"\n[Total] {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
