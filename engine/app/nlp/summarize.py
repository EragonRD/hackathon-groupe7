"""Résumé / chapitres / mots-clés / traduction — baseline améliorée (T21/T22).

- résumé dans la **langue source** (cohérence) ;
- traduction **par chunks** + prompt strict (évite l'écho du texte source) ;
- chapitres : échantillonnage couvrant + parsing JSON robuste, repli seulement si échec ;
- mots-clés : **MMR** (diversité) + dédup des sous-chaînes.
"""

import json
import math
import re

from ..models import get_embedder, get_llm

LANG_NAMES = {
    "fr": "français", "en": "anglais", "es": "espagnol",
    "de": "allemand", "it": "italien", "pt": "portugais",
}


def _lang_name(code: str) -> str:
    return LANG_NAMES.get((code or "")[:2], "la langue d'origine")


def _chat(prompt: str, max_tokens: int = 256, temperature: float = 0.2) -> str:
    llm = get_llm()
    out = llm.create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return out["choices"][0]["message"]["content"].strip()


def _chunk_text(text: str, max_words: int = 450) -> list[str]:
    words = text.split()
    return [" ".join(words[i : i + max_words]) for i in range(0, len(words), max_words)]


def summarize(transcript: str, language: str = "fr") -> str:
    if not transcript:
        return ""
    name = _lang_name(language)
    prompt = (
        f"Résume en {name}, en 2 à 3 phrases, le contenu suivant. "
        f"Donne uniquement le résumé, sans préambule ni introduction.\n\n"
        + transcript[:4000]
    )
    return _chat(prompt, max_tokens=200)


def translate(transcript: str, source_lang: str, max_chunks: int = 6) -> dict:
    if not transcript:
        return {"lang": "en", "text": ""}
    target = "fr" if (source_lang or "").startswith("en") else "en"
    name = _lang_name(target)
    chunks = _chunk_text(transcript, 450)[:max_chunks]
    parts = []
    for ch in chunks:
        prompt = (
            f"Traduis le texte ci-dessous en {name}. "
            f"Réponds UNIQUEMENT avec la traduction en {name}, "
            f"sans répéter le texte original et sans commentaire.\n\n"
            f"Texte :\n{ch}\n\nTraduction en {name} :"
        )
        parts.append(_chat(prompt, max_tokens=600, temperature=0.1))
    return {"lang": target, "text": " ".join(p for p in parts if p).strip()}


def extract_keywords(transcript: str, top_n: int = 8) -> list[str]:
    if not transcript:
        return []
    from keybert import KeyBERT

    kw = KeyBERT(model=get_embedder())
    pairs = kw.extract_keywords(
        transcript,
        keyphrase_ngram_range=(1, 2),
        stop_words=None,
        use_mmr=True,
        diversity=0.7,
        top_n=top_n * 2,
    )
    out: list[str] = []
    for phrase, _ in pairs:
        phrase = phrase.strip()
        if phrase and not any(phrase in o or o in phrase for o in out):
            out.append(phrase)
        if len(out) >= top_n:
            break
    return out


def make_chapters(segments: list[dict], max_chapters: int = 6) -> list[dict]:
    if not segments:
        return []
    sample = _sample_segments(segments, 40)
    timeline = "\n".join(f"[{s['start']:.0f}s] {s['text']}" for s in sample)[:3000]
    prompt = (
        "Voici une transcription horodatée. Découpe-la en 4 à 6 chapitres thématiques. "
        "Réponds UNIQUEMENT par un tableau JSON valide, sans texte autour, au format "
        '[{"title":"titre court","start":<secondes>}]. Le 1er chapitre commence à 0.\n\n'
        + timeline
    )
    chapters = _parse_chapters(_chat(prompt, max_tokens=300, temperature=0.1), segments)
    return chapters or _fallback_chapters(segments, max_chapters)


def _sample_segments(segments: list[dict], n: int) -> list[dict]:
    if len(segments) <= n:
        return segments
    step = len(segments) / n
    return [segments[int(i * step)] for i in range(n)]


def _parse_chapters(raw: str, segments: list[dict]) -> list[dict]:
    raw = re.sub(r"^```[a-zA-Z]*", "", raw.strip()).strip().strip("`").strip()
    try:
        data = json.loads(raw[raw.index("[") : raw.rindex("]") + 1])
    except (ValueError, json.JSONDecodeError):
        return []
    max_end = segments[-1]["end"]
    out, seen = [], set()
    for c in data:
        if not (isinstance(c, dict) and "title" in c and "start" in c):
            continue
        try:
            start = round(max(0.0, min(float(c["start"]), max_end)), 1)
        except (TypeError, ValueError):
            continue
        title = str(c["title"]).strip()[:80]
        if title and start not in seen:
            seen.add(start)
            out.append({"title": title, "start": start})
    out.sort(key=lambda x: x["start"])
    return out


def _fallback_chapters(segments: list[dict], n: int) -> list[dict]:
    n = min(n, len(segments))
    size = math.ceil(len(segments) / n)
    chapters = []
    for i in range(0, len(segments), size):
        grp = segments[i]
        title = " ".join(grp["text"].split()[:5]) or f"Chapitre {len(chapters) + 1}"
        chapters.append({"title": title[:80], "start": round(grp["start"], 1)})
    return chapters
