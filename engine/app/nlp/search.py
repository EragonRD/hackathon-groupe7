"""Recherche sémantique baseline (T22 — Izlene affinera).

Embeddings MiniLM multilingue + recherche cosine sur les segments.
"""

import numpy as np

from ..models import get_embedder


def build_index(segments: list[dict]) -> np.ndarray:
    """Retourne une matrice (n_segments, dim) d'embeddings normalisés."""
    texts = [s["text"] for s in segments] or [""]
    emb = get_embedder().encode(texts, normalize_embeddings=True)
    return np.asarray(emb, dtype="float32")


def search(query: str, segments: list[dict], index: np.ndarray, k: int = 3) -> list[dict]:
    """Top-k segments les plus proches de la requête (avec timecodes)."""
    if not segments or index.size == 0:
        return []
    q = get_embedder().encode([query], normalize_embeddings=True)[0]
    scores = index @ np.asarray(q, dtype="float32")
    order = scores.argsort()[::-1][:k]
    return [
        {
            "start": segments[i]["start"],
            "end": segments[i]["end"],
            "text": segments[i]["text"],
            "score": float(scores[i]),
        }
        for i in order
    ]
