"""PKG-T11: text-vs-hybrid comparison measured offline, hybrid honestly blocked."""

import importlib.util
import json
import pathlib
import statistics
from collections.abc import Iterator
from decimal import Decimal
from typing import Any

import pytest
from bidlab.services import extraction_compare as ec
from bidlab.services import extraction_eval as ev
from bidlab.settings import get_settings

ROOT = pathlib.Path(__file__).resolve().parents[4]
GOLD_PATH = ROOT / "examples" / "gold_claims.json"
SPLIT_PATH = ROOT / "evidence" / "evaluation_split.json"
CLI_PATH = ROOT / "scripts" / "compare_extraction.py"

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


@pytest.fixture()
def scrubbed_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Remove any live credential (empty env beats a .env file value)."""
    monkeypatch.setenv("MODEL_API_KEY", "")
    monkeypatch.delenv("META_API_URL", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture()
def no_sockets(monkeypatch: pytest.MonkeyPatch) -> None:
    import socket

    def _blocked(*args: object, **kwargs: object) -> object:
        raise AssertionError("comparison must not open sockets")

    monkeypatch.setattr(socket, "socket", _blocked)


def _load() -> tuple[list[ev.GoldClaim], ev.EvalSplit]:
    return ev.load_gold(GOLD_PATH), ev.load_split(SPLIT_PATH)


def _by_id(claims: list[ev.GoldClaim]) -> dict[str, ev.GoldClaim]:
    return {claim.claim_id: claim for claim in claims}


def test_modes_share_eval_set_and_schema(scrubbed_env: None) -> None:
    gold, split = _load()
    result = ec.compare(gold, split)
    assert (result.gold_total, result.n_dev, result.n_eval) == (25, 14, 11)
    assert {case.claim_id for case in result.cases} == EVAL_IDS
    assert result.text.n_eval == result.hybrid.n_eval == 11
    assert result.text.schema == result.hybrid.schema
    assert "mismo mapper" in result.text.schema


def test_text_fixture_scores_zero_with_full_denominator(scrubbed_env: None) -> None:
    gold, split = _load()
    result = ec.compare(gold, split)
    text = result.text
    assert text.status == "measured"
    assert text.block_reason is None
    assert (text.n_hit, text.n_miss, text.n_unsupported) == (0, 0, 11)
    assert text.n_hit is not None and text.n_miss is not None
    assert text.n_unsupported is not None
    assert text.n_hit + text.n_miss + text.n_unsupported == 11
    assert text.accuracy == Decimal(0)
    assert all(case.text_verdict == "unsupported" for case in result.cases)
    assert all(case.text_predicted is None for case in result.cases)


def test_hybrid_blocked_has_nulls_not_zeros(scrubbed_env: None) -> None:
    gold, split = _load()
    result = ec.compare(gold, split)
    hybrid = result.hybrid
    assert hybrid.status == "blocked"
    assert hybrid.block_reason is not None
    assert "G3" in hybrid.block_reason and "cero llamadas live" in hybrid.block_reason
    assert hybrid.n_hit is None
    assert hybrid.n_miss is None
    assert hybrid.n_unsupported is None
    assert hybrid.accuracy is None
    assert hybrid.critical_errors is None
    assert hybrid.latency_p50_ms is None and hybrid.latency_max_ms is None
    assert hybrid.cost_micro_usd is None
    assert hybrid.invocation_mode is None
    assert all(case.hybrid_verdict is None for case in result.cases)
    assert all(case.hybrid_latency_ms is None for case in result.cases)
    payload = result.to_dict()
    assert payload["modes"]["hybrid"]["n_hit"] is None
    assert payload["modes"]["hybrid"]["accuracy"] is None
    assert payload["modes"]["hybrid"]["cost_micro_usd"] is None


def test_critical_rule_amount_period_formula() -> None:
    gold, split = _load()
    claims = ev.eval_claims(gold, split)
    by_id = _by_id(claims)
    assert ec.is_critical(by_id["g21"])  # net_budget, EUR
    assert ec.is_critical(by_id["g23"])  # lot1_net_budget, EUR
    assert ec.is_critical(by_id["g22"])  # initial_duration_years, years
    assert ec.is_critical(by_id["g17"])  # formula_denominator_ambiguity
    assert ec.is_critical(by_id["g16"])  # logarithm_base, formula parameter
    assert not ec.is_critical(by_id["g15"])  # price_points, points
    assert not ec.is_critical(by_id["g19"])  # scoring_reference
    assert not ec.is_critical(by_id["g20"])  # boolean
    scored = ev.ScoreResult(
        scores=(
            ev.ClaimScore("g21", "miss", "1457330.00", "1457330.01"),
            ev.ClaimScore("g22", "miss", "1", "2"),
            ev.ClaimScore("g15", "miss", "65", "64"),
            ev.ClaimScore("g23", "unsupported", "775000.00", None),
        ),
        n_eval=4,
        n_hit=0,
        n_miss=3,
        n_unsupported=1,
        accuracy=Decimal(0),
    )
    assert ec.critical_errors(scored, claims) == ("g21", "g22")


def test_compare_runs_fully_offline(
    scrubbed_env: None, no_sockets: None, tmp_path: pathlib.Path
) -> None:
    gold, split = _load()
    result = ec.compare(gold, split)
    assert result.hybrid.status == "blocked"
    payload = result.to_dict()
    artifact = tmp_path / "comparison.json"
    artifact.write_text(json.dumps(payload), encoding="utf-8")
    assert len(result.limitations) >= 4
    assert any("G3" in item for item in result.limitations)


def test_hybrid_refusal_ladder_needs_creds_flag_and_texts(
    no_sockets: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    gold, split = _load()
    claims = ev.eval_claims(gold, split)
    monkeypatch.setenv("MODEL_API_KEY", "")
    monkeypatch.delenv("META_API_URL", raising=False)
    get_settings.cache_clear()
    try:
        # No credential: G3 wins even with --allow-live.
        run = ec.run_hybrid_mode(claims, allow_live=True)
        assert run.status == "blocked"
        assert run.block_reason is not None and "G3" in run.block_reason
        # Fake credential without the flag: still blocked, still no calls.
        monkeypatch.setenv("MODEL_API_KEY", "test-only-fake-key")
        monkeypatch.setenv("BIDLAB_MODE", "live")
        monkeypatch.setenv("META_API_URL", "http://127.0.0.1:9/chat/completions")
        get_settings.cache_clear()
        run = ec.run_hybrid_mode(claims, allow_live=False)
        assert run.status == "blocked"
        assert run.block_reason is not None and "--allow-live" in run.block_reason
        # Flag plus credential but no page texts: blocked before any call.
        run = ec.run_hybrid_mode(claims, allow_live=True, page_texts=None)
        assert run.status == "blocked"
        assert run.block_reason is not None and "textos de página" in run.block_reason
    finally:
        get_settings.cache_clear()


def _proposal(entries: list[dict[str, Any]]) -> dict[str, Any]:
    return {"schema_version": "1.0", "claims": entries}


def _citation(document_id: str, page: int) -> dict[str, Any]:
    return {"document_id": document_id, "page_number": page}


def test_v1_mapping_shared_shape_and_first_wins() -> None:
    gold, split = _load()
    claims = ev.eval_claims(gold, split)
    proposal = _proposal(
        [
            {
                "key": "price_points",
                "normalized_value": "65",
                "status": "proposed",
                "citations": [_citation("20777832_pcap", 9)],
            },
            {
                "key": "price_points",
                "normalized_value": "64",
                "status": "proposed",
                "citations": [_citation("20777832_pcap", 9)],
            },
            {
                "key": "net_budget",
                "normalized_value": None,
                "status": "proposed",
                "citations": [_citation("17907789_pcap", 1)],
            },
            {
                "key": "formula_denominator_ambiguity",
                "normalized_value": "blocked",
                "status": "ambiguous",
                "citations": [_citation("20777832_pcap", 9)],
            },
            {
                "key": "unknown_key",
                "normalized_value": "x",
                "status": "proposed",
                "citations": [_citation("20777832_pcap", 9)],
            },
            {
                "key": "price_points",
                "normalized_value": "49",
                "status": "proposed",
                "citations": [_citation("20777838_pcap", 10)],  # dev page: ignored
            },
        ]
    )
    records = ev.predictions_from_records(ec.v1_proposal_to_records(proposal, claims))
    by_id = {item.claim_id: item for item in records}
    assert by_id["g15"].value == "65"  # first claim wins
    assert by_id["g15"].status == "supported"
    assert by_id["g21"].status == "unsupported"  # proposed but null stays null
    assert by_id["g21"].value is None
    assert by_id["g17"].status == "unsupported"  # ambiguous is not a value
    assert "g01" not in by_id
    result = ev.score(records, claims, gold)
    assert result.n_eval == 11 and result.n_hit == 1


def test_v1_mapping_rejects_malformed_citations() -> None:
    gold, split = _load()
    claims = ev.eval_claims(gold, split)
    assert ec.v1_proposal_to_records({}, claims) == []
    assert ec.v1_proposal_to_records({"claims": None}, claims) == []
    proposal = _proposal(
        [
            {
                "key": "price_points",
                "normalized_value": "65",
                "status": "proposed",
                "citations": [{"document_id": "20777832_pcap", "page_number": True}],
            },
            {
                "key": "price_points",
                "normalized_value": "65",
                "status": "proposed",
                "citations": [{"document_id": 9, "page_number": 9}],
            },
            {
                "key": "price_points",
                "normalized_value": "65",
                "status": "proposed",
                "citations": [],
            },
        ]
    )
    assert ec.v1_proposal_to_records(proposal, claims) == []


def test_eval_pages_group_claims_without_text() -> None:
    gold, split = _load()
    claims = ev.eval_claims(gold, split)
    groups = ec.build_eval_pages(claims)
    assert len(groups) == 6
    covered = [claim.claim_id for group in groups for claim in group.claims]
    assert sorted(covered) == sorted(EVAL_IDS)
    assert all(group.page.normalized_text == "" for group in groups)
    assert {group.page.document_id for group in groups} == {
        "20777832_pcap",
        "20706136_pcap",
        "17907789_pcap",
        "20010571_pcap",
    }
    with pytest.raises(ValueError, match="no page text"):
        ec.build_eval_pages(claims, {})


def test_latency_and_cost_shapes_are_measured_not_invented(
    scrubbed_env: None,
) -> None:
    gold, split = _load()
    result = ec.compare(gold, split)
    latencies = [case.text_latency_ms for case in result.cases]
    assert all(isinstance(item, float) and item >= 0 for item in latencies)
    assert result.text.latency_p50_ms == round(float(statistics.median(latencies)), 3)
    assert result.text.latency_max_ms == round(max(latencies), 3)
    assert result.text.cost_micro_usd == 0
    assert "fixture" in result.text.cost_reason
    assert result.text.prompt_tokens is None
    assert result.text.completion_tokens is None
    assert result.text.invocation_mode == "fixture"
    assert result.text.model is None


def test_compare_rejects_dirty_split(scrubbed_env: None) -> None:
    gold, split = _load()
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
    with pytest.raises(ValueError, match="split inválido"):
        ec.compare(gold, dirty)


def _load_cli() -> Any:
    spec = importlib.util.spec_from_file_location("compare_extraction", CLI_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cli_writes_comparison_artifact(
    scrubbed_env: None, tmp_path: pathlib.Path, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _load_cli()
    out = tmp_path / "comparison.json"
    assert module.main(["--out", str(out)]) == 0
    out_text = capsys.readouterr().out
    assert "eval claims: 11" in out_text
    assert "hybrid: status=blocked" in out_text
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["schema_version"] == 1
    assert payload["gold"] == {"kind": "manual_initial_gold", "claims_total": 25}
    assert payload["split"] == {"n_dev": 14, "n_eval": 11}
    assert payload["modes"]["text"]["status"] == "measured"
    assert payload["modes"]["text"]["accuracy"] == "0"
    assert payload["modes"]["hybrid"]["status"] == "blocked"
    assert payload["modes"]["hybrid"]["cost_micro_usd"] is None
    assert len(payload["cases"]) == 11
    assert payload["limitations"]


def test_cli_exit_2_on_bad_inputs(
    scrubbed_env: None, tmp_path: pathlib.Path, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _load_cli()
    out = tmp_path / "comparison.json"
    assert module.main(["--gold", str(tmp_path / "absent.json"), "--out", str(out)]) == 2
    capsys.readouterr()
    bad_texts = tmp_path / "texts.json"
    bad_texts.write_text(json.dumps({"g15": "65"}), encoding="utf-8")
    out2 = tmp_path / "comparison2.json"
    rc = module.main(["--out", str(out2), "--page-texts", str(bad_texts)])
    assert rc == 2
    capsys.readouterr()
    assert not out2.exists()


def test_load_page_texts_shape(tmp_path: pathlib.Path) -> None:
    module = _load_cli()
    good = tmp_path / "texts.json"
    good.write_text(json.dumps({"evidence/originals/x_pcap.pdf::9": "page text"}), encoding="utf-8")
    assert module.load_page_texts(good) == {("evidence/originals/x_pcap.pdf", 9): "page text"}
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps([1, 2]), encoding="utf-8")
    with pytest.raises(TypeError, match="JSON object"):
        module.load_page_texts(bad)
    bad.write_text(json.dumps({"x_pcap.pdf::0": "t"}), encoding="utf-8")
    with pytest.raises(ValueError, match="document_file::page"):
        module.load_page_texts(bad)
    bad.write_text(json.dumps({"x_pcap.pdf::9": "  "}), encoding="utf-8")
    with pytest.raises(ValueError, match="non-empty text"):
        module.load_page_texts(bad)
