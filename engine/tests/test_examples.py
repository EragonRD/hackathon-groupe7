"""Tests sur le corpus de vidéos (tests/examples/) — opt-in car LENT.

    RUN_EXAMPLES=1 .venv/bin/python -m pytest tests/test_examples.py -v
"""

import glob
import os

import jsonschema
import pytest

from contract import CONTRACT_SCHEMA

EXAMPLES = sorted(glob.glob(os.path.join(os.path.dirname(__file__), "examples", "*.mp4")))


@pytest.mark.skipif(not os.getenv("RUN_EXAMPLES"), reason="set RUN_EXAMPLES=1 (pipeline complet, lent)")
@pytest.mark.parametrize("video", EXAMPLES, ids=[os.path.basename(v) for v in EXAMPLES])
def test_example_conforme_au_contrat(video):
    from app import pipeline

    metadata, segments, index = pipeline.analyze(video, os.path.basename(video))
    jsonschema.validate(metadata, CONTRACT_SCHEMA)
    assert metadata["transcript"]
    assert metadata["translations"], "aucune traduction produite"
