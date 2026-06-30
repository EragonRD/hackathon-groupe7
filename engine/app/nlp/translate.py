"""Traduction multilingue + sous-titres (T22) — modèle dédié NLLB-200.

Pour chaque langue cible, on traduit **chaque segment** (→ sous-titres horodatés)
et on reconstitue le texte complet. Un seul modèle couvre 200 langues.
"""

import torch

from ..models import get_nllb

# ISO 639-1 (Whisper) -> code FLORES-200 (NLLB). Extensible.
LANG_TO_NLLB = {
    "fr": "fra_Latn", "en": "eng_Latn", "es": "spa_Latn", "ar": "arb_Arab",
    "de": "deu_Latn", "it": "ita_Latn", "pt": "por_Latn", "nl": "nld_Latn",
    "ru": "rus_Cyrl", "zh": "zho_Hans", "ja": "jpn_Jpan", "ko": "kor_Hang",
    "hi": "hin_Deva", "tr": "tur_Latn", "pl": "pol_Latn", "uk": "ukr_Cyrl",
    "ro": "ron_Latn", "sv": "swe_Latn", "el": "ell_Grek", "he": "heb_Hebr",
    "vi": "vie_Latn", "id": "ind_Latn", "fa": "pes_Arab", "th": "tha_Thai",
}


def _nllb_code(lang: str):
    return LANG_TO_NLLB.get((lang or "")[:2])


def translate_texts(
    texts: list[str], source_lang: str, target_lang: str, batch_size: int = 16, max_length: int = 512
) -> list[str] | None:
    """Traduit une liste de textes (batché). Retourne None si une langue n'est pas supportée."""
    src, tgt = _nllb_code(source_lang), _nllb_code(target_lang)
    if src is None or tgt is None:
        return None
    tok, model = get_nllb()
    tok.src_lang = src
    bos = tok.convert_tokens_to_ids(tgt)
    out: list[str] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        enc = tok(batch, return_tensors="pt", padding=True, truncation=True, max_length=max_length)
        with torch.no_grad():
            gen = model.generate(**enc, forced_bos_token_id=bos, max_length=max_length)
        out.extend(tok.batch_decode(gen, skip_special_tokens=True))
    return out


def translate_all(
    transcript: str, segments: list[dict], source_lang: str, targets: list[str]
) -> list[dict]:
    """Retourne une piste par langue cible : {lang, text, segments:[{start,end,text}]}.

    La langue source est incluse telle quelle (sous-titres originaux).
    """
    tracks: list[dict] = []
    seg_texts = [s["text"] for s in segments]
    for tgt in targets:
        if _nllb_code(tgt) is None:
            continue
        if (tgt or "")[:2] == (source_lang or "")[:2]:
            tracks.append({"lang": tgt, "text": transcript, "segments": [dict(s) for s in segments]})
            continue
        translated = translate_texts(seg_texts, source_lang, tgt) if seg_texts else []
        if translated is None:
            continue
        tgt_segments = [
            {"start": s["start"], "end": s["end"], "text": t}
            for s, t in zip(segments, translated)
        ]
        tracks.append({"lang": tgt, "text": " ".join(translated).strip(), "segments": tgt_segments})
    return tracks
