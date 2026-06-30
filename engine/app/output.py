"""Écriture des sorties : 1 dossier par vidéo, 1 JSON par langue.

Structure produite :
    outputs/<video>/
    ├── <video>.<ext>                 copie de la vidéo
    ├── <video>_trad_<lang>.json      traduction + sous-titres par langue
    └── <video>_meta.json             métadonnées complètes (contrat P3-A)
"""

import json
import os
import shutil
from pathlib import Path

from . import config


def _safe(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in name)


def output_folder(name: str, out_root: str | None = None) -> Path:
    return Path(out_root or config.OUTPUT_DIR) / _safe(Path(name).stem)


def load_meta(name: str, out_root: str | None = None) -> dict | None:
    """Retourne les métadonnées déjà calculées (cache) si le dossier existe, sinon None."""
    stem = _safe(Path(name).stem)
    f = output_folder(name, out_root) / f"{stem}_meta.json"
    if f.is_file():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
    return None


def save_outputs(metadata: dict, video_path: str, out_root: str | None = None) -> str:
    name = metadata.get("video") or Path(video_path).name
    stem = _safe(Path(name).stem)
    folder = Path(out_root or config.OUTPUT_DIR) / stem
    folder.mkdir(parents=True, exist_ok=True)

    # 1) copie de la vidéo dans le dossier
    try:
        dst = folder / _safe(name)
        already = dst.exists() and dst.stat().st_size == os.path.getsize(video_path)
        if os.path.abspath(video_path) != os.path.abspath(dst) and not already:
            shutil.copy2(video_path, dst)
    except OSError:
        pass

    # 2) un JSON par langue : <video>_trad_<lang>.json
    for track in metadata.get("translations", []):
        lang = track.get("lang", "xx")
        payload = {
            "video": name,
            "lang": lang,
            "duration_sec": metadata.get("duration_sec"),
            "text": track.get("text", ""),
            "segments": track.get("segments", []),  # sous-titres horodatés
        }
        (folder / f"{stem}_trad_{lang}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # 3) métadonnées complètes (contrat P3-A + tout)
    (folder / f"{stem}_meta.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return str(folder)
