"""Tests de conformité au contrat JSON P3-A (rapides)."""

import jsonschema
import pytest

from app.schemas import VideoMetadata
from contract import CONTRACT_SCHEMA, SAMPLE


def test_sample_valide_jsonschema():
    jsonschema.validate(SAMPLE, CONTRACT_SCHEMA)


def test_pydantic_accepte_le_sample():
    VideoMetadata(**SAMPLE)


def test_champ_requis_manquant_echoue():
    bad = dict(SAMPLE)
    del bad["summary"]
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, CONTRACT_SCHEMA)


def test_mauvais_type_echoue():
    bad = dict(SAMPLE)
    bad["duration_sec"] = "douze"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, CONTRACT_SCHEMA)
