"""Traduction multilingue + sous-titres (T22).

Deux backends au même contrat, sélectionnés par `config.TRANSLATE_PROVIDER` :
- `groq` / `openrouter` : traduction via chat LLM (segments batchés en JSON,
  alignement start/end conservé) ;
- `local` : modèle dédié NLLB-200 (repli automatique si l'API échoue).

Pour chaque langue cible, on traduit **chaque segment** (→ sous-titres horodatés)
et on reconstitue le texte complet.
"""

import logging
import re

from .. import config
from . import remote

log = logging.getLogger("engine.translate")

# ISO 639-1 (Whisper) -> code FLORES-200 (NLLB). Extensible.
LANG_TO_NLLB = {
    "fr": "fra_Latn", "en": "eng_Latn", "es": "spa_Latn", "ar": "arb_Arab",
    "de": "deu_Latn", "it": "ita_Latn", "pt": "por_Latn", "nl": "nld_Latn",
    "ru": "rus_Cyrl", "zh": "zho_Hans", "ja": "jpn_Jpan", "ko": "kor_Hang",
    "hi": "hin_Deva", "tr": "tur_Latn", "pl": "pol_Latn", "uk": "ukr_Cyrl",
    "ro": "ron_Latn", "sv": "swe_Latn", "el": "ell_Grek", "he": "heb_Hebr",
    "vi": "vie_Latn", "id": "ind_Latn", "fa": "pes_Arab", "th": "tha_Thai",
}

# Noms lisibles (pour le prompt du LLM distant).
LANG_NAMES = {
    "fr": "French", "en": "English", "es": "Spanish", "ar": "Arabic",
    "de": "German", "it": "Italian", "pt": "Portuguese", "nl": "Dutch",
    "ru": "Russian", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
    "hi": "Hindi", "tr": "Turkish", "pl": "Polish", "uk": "Ukrainian",
    "ro": "Romanian", "sv": "Swedish", "el": "Greek", "he": "Hebrew",
    "vi": "Vietnamese", "id": "Indonesian", "fa": "Persian", "th": "Thai",
}

# Budget de caractères par requête LLM (garde-fou TPM du free tier).
_CHUNK_CHARS = 1500


def _nllb_code(lang: str):
    return LANG_TO_NLLB.get((lang or "")[:2])


def _lang_name(lang: str):
    return LANG_NAMES.get((lang or "")[:2])


# --- Backend distant (chat LLM) --------------------------------------------

def _chunks(texts: list[str]) -> list[tuple[int, int]]:
    """Découpe en tranches (index début, fin) selon un budget de caractères."""
    spans, start, size = [], 0, 0
    for i, t in enumerate(texts):
        size += len(t) + 2
        if size >= _CHUNK_CHARS and i > start:
            spans.append((start, i))
            start, size = i, len(t) + 2
    spans.append((start, len(texts)))
    return spans


_LINE_RE = re.compile(r"^\s*(\d+)\s*[|.):\-]\s?(.*)$")


def _parse_numbered(raw: str, n: int) -> dict[int, str]:
    """Extrait {index0 -> traduction} d'une réponse en lignes numérotées `N| texte`.

    Tolérant : ignore préambule / fences ; garde ce qui matche. Les indices
    manquants seront comblés par une traduction segment-à-segment.
    """
    out: dict[int, str] = {}
    for line in raw.splitlines():
        m = _LINE_RE.match(line)
        if not m:
            continue
        i = int(m.group(1)) - 1
        if 0 <= i < n and m.group(2).strip():
            out[i] = m.group(2).strip()
    return out


def _chat_translate(prompt: str, max_tokens: int) -> str:
    return remote.chat(
        prompt, max_tokens=max_tokens, temperature=0.1,
        provider=config.TRANSLATE_PROVIDER,
        model=config.TRANSLATE_MODELS.get(config.TRANSLATE_PROVIDER),
    )


def _translate_one(text: str, src_name: str, tgt: str) -> str:
    """Traduit UN segment (repli fiable si le batch a fusionné/omis des lignes)."""
    reply = _chat_translate(
        f"Translate this text from {src_name} to {tgt}. "
        f"Reply with ONLY the translation, no quotes, no commentary.\n\n{text}",
        max_tokens=512,
    )
    return reply.strip().strip('"').strip()


def _translate_remote(texts: list[str], source_lang: str, target_lang: str) -> list[str] | None:
    """Traduit via chat LLM (batché, format numéroté tolérant). None si langue non supportée."""
    tgt = _lang_name(target_lang)
    if tgt is None:
        return None
    src_name = _lang_name(source_lang) or "the source language"
    out: list[str] = [""] * len(texts)
    for a, b in _chunks(texts):
        batch = texts[a:b]
        numbered = "\n".join(f"{i + 1}| {t}" for i, t in enumerate(batch))
        prompt = (
            f"Translate each numbered line from {src_name} to {tgt}. "
            f"Keep the EXACT same numbering (1..{len(batch)}), one translation per line, "
            "do NOT merge, split, add or remove lines. Output only the numbered lines.\n\n"
            + numbered
        )
        parsed = _parse_numbered(_chat_translate(prompt, max_tokens=2048), len(batch))
        for i in range(len(batch)):
            # Ligne manquante (fusion LLM) -> traduction individuelle garantie 1:1.
            out[a + i] = parsed[i] if i in parsed else _translate_one(batch[i], src_name, tgt)
    return out


# --- Backend local (NLLB-200) ----------------------------------------------

def _translate_local(
    texts: list[str], source_lang: str, target_lang: str, batch_size: int = 16, max_length: int = 512
) -> list[str] | None:
    import torch

    from ..models import get_nllb

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


# --- Dispatcher ------------------------------------------------------------

def translate_texts(texts: list[str], source_lang: str, target_lang: str) -> list[str] | None:
    """Traduit une liste de textes. None si la langue n'est pas supportée."""
    if not texts:
        return []
    if remote.chat_available(config.TRANSLATE_PROVIDER):
        try:
            return _translate_remote(texts, source_lang, target_lang)
        except remote.RemoteError as exc:
            log.warning("Traduction distante indisponible (%s) : %s", target_lang, exc)
            if not config.ALLOW_LOCAL_FALLBACK:
                return None
    # Mode API strict : pas de NLLB local (aucun téléchargement).
    if not config.ALLOW_LOCAL_FALLBACK:
        return None
    return _translate_local(texts, source_lang, target_lang)


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
