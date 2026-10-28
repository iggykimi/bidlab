"""PKG-T10: human gold, expediente partition, and the extraction harness."""

import importlib.util
import json
import pathlib
from decimal import Decimal
from typing import Any

import pytest
from bidlab.schemas import generated as g
from bidlab.schemas import observations as obs
from bidlab.services import extraction_eval as ev
from jsonschema import Draft202012Validator

ROOT = pathlib.Path(__file__).resolve().parents[4]
GOLD_PATH = ROOT / "examples" / "gold_claims.json"
SPLIT_PATH = ROOT / "evidence" / "evaluation_split.json"
MANIFEST_PATH = ROOT / "evidence" / "download_manifest.json"
V1_SCHEMA_PATH = ROOT / "schemas" / "extraction.schema.json"
CLI_PATH = ROOT / "scripts" / "score_extraction.py"

EVAL_IDS = {
    "g15",
    "g16",
    "g17",
    "g18",
    "g19",
    "g20",
    "g21",
    "g22",
    "g23",
    "g24",
    "g25",
}


def _doc_id(document_file: str) -> str:
    return pathlib.Path(document_file).stem


def test_gold_is_human_and_fully_sourced() -> None:
    raw = json.loads(GOLD_PATH.read_text(encoding="utf-8"))
    assert raw["kind"] == "manual_initial_gold"
    assert raw["count"] == len(raw["claims"]) == 25
    claims = ev.load_gold(GOLD_PATH)
    assert [claim.claim_id for claim in claims] == [f"g{i:02d}" for i in range(1, 26)]
    for claim in claims:
        assert claim.quote_normalized.strip(), claim.claim_id
        assert len(claim.document_sha256) == 64, claim.claim_id
        assert claim.page_number >= 1, claim.claim_id
        assert claim.expected_value, claim.claim_id


def test_gold_hashes_match_download_manifest() -> None:
    manifest = {
        entry["key"]: entry for entry in json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    }
    for claim in ev.load_gold(GOLD_PATH):
        name = pathlib.Path(claim.document_file).name
        assert manifest[name]["sha256"] == claim.document_sha256, claim.claim_id


def test_gold_rejects_non_manual_kind(tmp_path: pathlib.Path) -> None:
    raw = json.loads(GOLD_PATH.read_text(encoding="utf-8"))
    raw["kind"] = "model_output"
    candidate = tmp_path / "gold.json"
    candidate.write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="manual_initial_gold"):
        ev.load_gold(candidate)


def _v1_claim(claim: ev.GoldClaim) -> dict[str, Any]:
    status = "ambiguous" if claim.expected_review_state == "blocked" else "proposed"
    return {
        "key": claim.field,
        "raw_value": None,
        "normalized_value": claim.expected_value,
        "unit": claim.unit,
        "citations": [
            {
                "document_id": _doc_id(claim.document_file),
                "page_number": claim.page_number,
                "verbatim_excerpt": claim.quote_normalized[:600],
            }
        ],
        "confidence": "high",
        "status": status,
        "notes": [f"human gold {claim.claim_id}"],
    }


def _v1_view(claims: list[ev.GoldClaim]) -> dict[str, Any]:
    return {
        "schema_version": "1.0",
        "claims": [_v1_claim(claim) for claim in claims],
        "requirements": [],
        "pricing_formula": {
            "formula_literal": None,
            "template_hint": "unsupported",
            "max_points": None,
            "variables": [],
            "citations": [],
            "ambiguities": [],
        },
        "anomaly_text": None,
        "anomaly_citations": [],
        "unread_pages": [],
        "warnings": ["Structural view of the human gold; not a model run."],
    }


def test_gold_valid_as_v1_extraction_proposal() -> None:
    proposal = _v1_view(ev.load_gold(GOLD_PATH))
    schema = json.loads(V1_SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(proposal)
    g.ExtractionProposal.model_validate(proposal)


# Gold field -> (v2 observation field, qualifier overrides). Structural
# compatibility view only: a real v2 packet covers one tender, while the
# gold spans five PCAPs (hence the exp- scope ids preserving provenance).
_V2_FIELDS: dict[str, tuple[str, dict[str, Any]]] = {
    "gross_budget": (
        "budget_net",
        {"tax_basis": "gross", "reference_kind": "base_budget"},
    ),
    "estimated_value": (
        "budget_net",
        {"tax_basis": "net", "reference_kind": "estimated_value"},
    ),
    "net_budget": (
        "budget_net",
        {"tax_basis": "net", "reference_kind": "base_budget"},
    ),
    "lot1_net_budget": (
        "budget_net",
        {"tax_basis": "net", "reference_kind": "base_budget"},
    ),
    "lot2_net_budget": (
        "budget_net",
        {"tax_basis": "net", "reference_kind": "base_budget"},
    ),
    "lot3_net_budget": (
        "budget_net",
        {"tax_basis": "net", "reference_kind": "base_budget"},
    ),
    "initial_duration_months": (
        "period_months",
        {"period_segment": "initial"},
    ),
    "maximum_duration_months": (
        "period_months",
        {"period_segment": "maximum"},
    ),
    "price_points": (
        "max_price_points",
        {"reference_kind": "price_criterion"},
    ),
    "formula_denominator_ambiguity": (
        "pricing_formula_literal",
        {"reference_kind": "denominator_glifo_0_vs_O"},
    ),
    "anomaly_single_discount_gt": (
        "anomaly_literal",
        {"reference_kind": "branch_1_single_bidder"},
    ),
    "anomaly_two_discount_gt": (
        "anomaly_literal",
        {"reference_kind": "branch_2_two_bidders"},
    ),
}

_V2_LOT_SCOPES = {
    "lot1_net_budget": "lot-1",
    "lot2_net_budget": "lot-2",
    "lot3_net_budget": "lot-3",
}


def _v2_observation(claim: ev.GoldClaim) -> dict[str, Any]:
    field, overrides = _V2_FIELDS.get(claim.field, ("other_requirement", {}))
    qualifier: dict[str, Any] = {
        "scope_id": _V2_LOT_SCOPES.get(claim.field, f"exp-{claim.claim_id}"),
        "unit": claim.unit,
        "currency": "EUR" if claim.unit == "EUR" else None,
        "tax_basis": None,
        "period_segment": None,
        "reference_kind": None,
    }
    qualifier.update(overrides)
    if claim.field in _V2_LOT_SCOPES:
        qualifier["scope_id"] = _V2_LOT_SCOPES[claim.field]
    return {
        "id": claim.claim_id,
        "field": field,
        "value": claim.expected_value,
        "qualifier": qualifier,
        "source": {
            "document_id": _doc_id(claim.document_file),
            "document_sha256": claim.document_sha256,
            "physical_page": claim.page_number,
            "verbatim_excerpt": claim.quote_normalized,
            "image_id": None,
            "image_sha256": None,
            "bbox_0_1000": None,
        },
        "status": "proposed",
    }


def _v2_view(claims: list[ev.GoldClaim]) -> dict[str, Any]:
    return {
        "schema_version": "2.0-proposal",
        "observations": [_v2_observation(claim) for claim in claims],
        "ambiguities": [
            "g17: Alfresco prints a 0-like denominator glyph where the text "
            "defines O as the valued offer; interpretation stays blocked."
        ],
        # Text-only gold: originals are not redistributed, so no page
        # renders exist to bind image ids. Unknown stays null, never zero.
        "unread_image_ids": [],
    }


def test_gold_valid_as_v2_observations_proposal() -> None:
    proposal = obs.ObservationsProposal.model_validate(_v2_view(ev.load_gold(GOLD_PATH)))
    assert len(proposal.observations) == 25
    assert {item.id for item in proposal.observations} == {f"g{i:02d}" for i in range(1, 26)}


def test_v1_v2_views_carry_same_values() -> None:
    claims = ev.load_gold(GOLD_PATH)
    v1 = _v1_view(claims)
    v2 = _v2_view(claims)
    v1_values = {
        note.removeprefix("human gold "): claim["normalized_value"]
        for claim in v1["claims"]
        for note in claim["notes"]
    }
    v2_values = {item["id"]: item["value"] for item in v2["observations"]}
    assert v1_values == v2_values
    assert set(v1_values) == {claim.claim_id for claim in claims}


def test_split_is_clean_and_covers_gold() -> None:
    gold = ev.load_gold(GOLD_PATH)
    split = ev.load_split(SPLIT_PATH)
    assert split.version == 1
    assert split.rule.strip()
    assert ev.check_split(gold, split) == []
    by_split: dict[str, set[str]] = {"dev": set(), "eval": set()}
    for claim_id, item in split.assignments.items():
        by_split[item.split].add(claim_id)
    assert by_split["dev"] & by_split["eval"] == set()
    assert by_split["dev"] | by_split["eval"] == {c.claim_id for c in gold}
    assert by_split["eval"] == EVAL_IDS


def test_eval_set_excludes_every_dev_page() -> None:
    gold = ev.load_gold(GOLD_PATH)
    split = ev.load_split(SPLIT_PATH)
    eval_claims = ev.eval_claims(gold, split)
    assert {claim.claim_id for claim in eval_claims} == EVAL_IDS
    dev_pages = {
        (item.document_file, item.page_number)
        for item in split.assignments.values()
        if item.split == "dev"
    }
    eval_pages = {(c.document_file, c.page_number) for c in eval_claims}
    assert dev_pages & eval_pages == set()
    # The curated Tias seed case is quarantined in full: no Tias page scores.
    assert all("20777838" not in c.document_file for c in eval_claims)


def test_split_rejects_sibling_pages_and_mixed_expedientes() -> None:
    gold = ev.load_gold(GOLD_PATH)
    split = ev.load_split(SPLIT_PATH)
    flipped = dict(split.assignments)
    first = flipped["g01"]
    flipped["g01"] = ev.SplitAssignment(
        claim_id=first.claim_id,
        expediente_id=first.expediente_id,
        document_file=first.document_file,
        page_number=first.page_number,
        split="eval",
    )
    dirty = ev.EvalSplit(version=split.version, rule=split.rule, assignments=flipped)
    violations = ev.check_split(gold, dirty)
    assert any("sibling page" in item for item in violations)
    assert any("spans dev and eval" in item for item in violations)


def test_split_rejects_unknown_claim() -> None:
    gold = ev.load_gold(GOLD_PATH)
    split = ev.load_split(SPLIT_PATH)
    extra = dict(split.assignments)
    extra["g99"] = ev.SplitAssignment(
        claim_id="g99",
        expediente_id="20777838",
        document_file="evidence/originals/20777838_pcap.pdf",
        page_number=1,
        split="eval",
    )
    dirty = ev.EvalSplit(version=split.version, rule=split.rule, assignments=extra)
    assert any("g99" in item for item in ev.check_split(gold, dirty))


def _stub_predictions() -> list[ev.Prediction]:
    # Hit, Decimal-tolerant hit, miss, explicit unsupported, and the rest
    # absent (absent counts as unsupported, still in the denominator).
    return ev.predictions_from_records(
        [
            {"claim_id": "g15", "value": "65", "status": "supported"},
            {"claim_id": "g21", "value": "1457330", "status": "supported"},
            {"claim_id": "g18", "value": "34", "status": "supported"},
            {"claim_id": "g17", "value": None, "status": "unsupported"},
        ]
    )


def test_unsupported_and_absent_stay_in_denominator() -> None:
    gold = ev.load_gold(GOLD_PATH)
    split = ev.load_split(SPLIT_PATH)
    claims = ev.eval_claims(gold, split)
    result = ev.score(_stub_predictions(), claims, gold)
    assert result.n_eval == 11
    assert result.n_hit == 2
    assert result.n_miss == 1
    assert result.n_unsupported == 8
    assert result.accuracy == Decimal(2) / Decimal(11)
    verdicts = {item.claim_id: item.verdict for item in result.scores}
    assert verdicts["g15"] == "hit"
    assert verdicts["g21"] == "hit"
    assert verdicts["g18"] == "miss"
    assert verdicts["g17"] == "unsupported"
    assert verdicts["g25"] == "unsupported"


def test_dev_predictions_never_score() -> None:
    gold = ev.load_gold(GOLD_PATH)
    split = ev.load_split(SPLIT_PATH)
    claims = ev.eval_claims(gold, split)
    perfect = [
        ev.Prediction(
            claim_id=claim.claim_id,
            value=claim.expected_value,
            status="supported",
        )
        for claim in gold
    ]
    result = ev.score(perfect, claims, gold)
    assert (result.n_eval, result.n_hit) == (11, 11)
    assert result.accuracy == Decimal(1)


def test_score_rejects_unknown_and_duplicate_predictions() -> None:
    gold = ev.load_gold(GOLD_PATH)
    split = ev.load_split(SPLIT_PATH)
    claims = ev.eval_claims(gold, split)
    with pytest.raises(ValueError, match="unknown claim"):
        ev.score(
            [ev.Prediction("g99", "1", "supported")],
            claims,
            gold,
        )
    with pytest.raises(ValueError, match="duplicate prediction"):
        ev.score(
            [
                ev.Prediction("g15", "65", "supported"),
                ev.Prediction("g15", "65", "supported"),
            ],
            claims,
            gold,
        )
    with pytest.raises(ValueError, match="empty eval set"):
        ev.score([], [], gold)


def test_predictions_from_records_validates_shape() -> None:
    with pytest.raises(ValueError, match="supported\\|unsupported"):
        ev.predictions_from_records([{"claim_id": "g15", "status": "maybe"}])
    with pytest.raises(ValueError, match="string or null"):
        ev.predictions_from_records([{"claim_id": "g15", "value": 65}])
    defaulted = ev.predictions_from_records([{"claim_id": "g15", "value": "65"}])
    assert defaulted[0].status == "supported"


def test_v1_and_v2_stub_outputs_score_alike() -> None:
    """Both schema shapes feed the harness through an explicit mapping."""
    gold = ev.load_gold(GOLD_PATH)
    split = ev.load_split(SPLIT_PATH)
    claims = ev.eval_claims(gold, split)
    v1_stub = {
        "schema_version": "1.0",
        "claims": [
            {"key": "price_points", "normalized_value": "65", "status": "proposed"},
            {"key": "net_budget", "normalized_value": "1457330.00", "status": "proposed"},
            {
                "key": "formula_denominator_ambiguity",
                "normalized_value": None,
                "status": "unsupported",
            },
        ],
    }
    v1_key_to_gold = {
        "price_points": "g15",
        "net_budget": "g21",
        "formula_denominator_ambiguity": "g17",
    }
    v1_records = [
        {
            "claim_id": v1_key_to_gold[item["key"]],
            "value": item["normalized_value"],
            "status": ("supported" if item["status"] == "proposed" else "unsupported"),
        }
        for item in v1_stub["claims"]
    ]
    v2_stub = {
        "schema_version": "2.0-proposal",
        "observations": [
            {"id": "ob-1", "field": "max_price_points", "value": "65"},
            {"id": "ob-2", "field": "budget_net", "value": "1457330.00"},
        ],
    }
    v2_id_to_gold = {"ob-1": "g15", "ob-2": "g21"}
    v2_records = [
        {"claim_id": v2_id_to_gold[item["id"]], "value": item["value"]}
        for item in v2_stub["observations"]
    ]
    v2_records.append({"claim_id": "g17", "value": None, "status": "unsupported"})
    first = ev.score(ev.predictions_from_records(v1_records), claims, gold)
    second = ev.score(ev.predictions_from_records(v2_records), claims, gold)
    assert first.to_dict() == second.to_dict()
    assert (first.n_hit, first.n_unsupported) == (2, 9)


def test_cli_scores_predictions_file(
    tmp_path: pathlib.Path, capsys: pytest.CaptureFixture[str]
) -> None:
    spec = importlib.util.spec_from_file_location("score_extraction", CLI_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    predictions = tmp_path / "predictions.json"
    predictions.write_text(
        json.dumps(
            [
                {"claim_id": "g15", "value": "65", "status": "supported"},
                {"claim_id": "g01", "value": "126619.52", "status": "supported"},
            ]
        ),
        encoding="utf-8",
    )
    assert module.main(["--predictions", str(predictions)]) == 0
    out = capsys.readouterr().out
    assert "eval claims: 11" in out
    assert "hit=1" in out
    assert "accuracy" in out
    assert module.main(["--predictions", str(predictions), "--format", "json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert (payload["n_eval"], payload["n_hit"]) == (11, 1)
    missing = tmp_path / "absent.json"
    assert module.main(["--predictions", str(missing)]) == 2
