"""CLI : analyse une vidéo locale via le pipeline P3-A et exporte le JSON (contrat).

Usage : .venv/bin/python scripts/analyze_file.py <video> [sortie.json]
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import pipeline  # noqa: E402

video = sys.argv[1]
# Dossier de sortie racine (optionnel) ; défaut = engine/outputs/
out_root = sys.argv[2] if len(sys.argv) > 2 else None

t0 = time.time()
# FORCE=1 pour ignorer le cache et tout régénérer
meta, segments, index = pipeline.analyze(
    video, os.path.basename(video), out_root, force=bool(os.getenv("FORCE"))
)
dt = time.time() - t0

print(f"[OK] {dt:.1f}s | langue={meta['language']} | durée={meta['duration_sec']}s "
      f"| segments={len(meta['segments'])} | mots={len(meta['transcript'].split())}")
print("\n--- SUMMARY ---\n" + meta["summary"])
print("\n--- CHAPTERS ---")
for c in meta["chapters"]:
    print(f"  {c['start']:>7.1f}s  {c['title']}")
print("\n--- KEYWORDS ---\n  " + ", ".join(meta["keywords"]))
print("\n--- TRANSLATIONS / SOUS-TITRES (multilingue) ---")
for tr in meta.get("translations", []):
    ex = tr["segments"][0]["text"] if tr["segments"] else ""
    print(f"  [{tr['lang']}] {len(tr['segments'])} sous-titres | ex: {ex[:60]}")

from app.output import save_outputs  # noqa: E402

folder = save_outputs(meta, video, out_root)
print(f"\nDossier généré -> {folder}")
for fn in sorted(os.listdir(folder)):
    print("   ", fn)
