"""Test bout-en-bout (T10) — LENT : charge les modèles et traite une vraie vidéo.

Skippé si la vidéo est absente. Lancer explicitement :
    .venv/bin/python -m pytest tests/test_e2e.py -v -s
"""

import os

import jsonschema
import pytest

from contract import CONTRACT_SCHEMA

VIDEO = os.path.join(os.path.dirname(__file__), "..", "..", "media",
                     "42 - POC Parc des Princes V1 .mp4")


@pytest.mark.skipif(not os.path.isfile(VIDEO), reason="vidéo de test absente")
def test_pipeline_complet_conforme_au_contrat():
    from app import pipeline

    metadata, segments, index = pipeline.analyze(VIDEO, "poc.mp4")

    # 1) Conformité contrat
    jsonschema.validate(metadata, CONTRACT_SCHEMA)

    # 2) Champs réellement remplis (pas seulement le transcript)
    assert metadata["transcript"], "transcript vide"
    assert metadata["summary"], "summary vide"
    assert metadata["keywords"], "keywords vides"
    assert metadata["segments"], "segments vides"
    assert metadata["duration_sec"] > 0

    # 3) Segments horodatés cohérents
    for s in metadata["segments"]:
        assert s["start"] <= s["end"]

    # 4) Recherche sémantique opérationnelle
    from app.nlp import search as search_mod

    hits = search_mod.search("introduction", segments, index, k=3)
    assert isinstance(hits, list)
