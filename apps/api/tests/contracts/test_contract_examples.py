"""Typed research examples must satisfy the generated contract models."""

import json
import pathlib

import pytest
from bidlab.schemas import generated as g

ROOT = pathlib.Path(__file__).resolve().parents[4]

PAIRS = [
    ("examples/evaluation_request.json", "EvaluationRequest"),
    ("examples/evaluation_response.json", "EvaluationResult"),
    ("examples/tias_tender.json", "Tender"),
    ("examples/company_profile.json", "Company"),
    ("examples/extraction_proposal.json", "ExtractionProposal"),
]


@pytest.mark.parametrize(("path", "model_name"), PAIRS)
def test_example_validates(path: str, model_name: str) -> None:
    payload = json.loads((ROOT / path).read_text(encoding="utf-8"))
    model = getattr(g, model_name)
    model.model_validate(payload)
