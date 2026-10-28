"""Stress mesh: deterministic grid over evaluate(), snapshot, oracles.

Oracle A: Tías 49pt, rivals A=106502.40 B=112419.20, cost 80000,
candidates {5%, 12%, 20%}, limits 47pt/8000€ -> selection 12%
(profit 24135.68, score 49 exact).
Oracle B: same mesh with cost 110000 and limits 47pt/10000€ ->
no tested discount qualifies (selection null).
"""

from typing import Any

from fastapi.testclient import TestClient

HEADERS = {"X-BidLab-Client": "local-ui"}
SCOPE = "tias-whole"
RULE = "tias-price-r1"
COMPANY = "company-demo"


def _hyp(label: str, cost: str, period: int = 24, complete: bool = True) -> dict[str, Any]:
    return {
        "label": label,
        "cost_net": cost,
        "period_months": period,
        "rival_a_net": "106502.40",
        "rival_b_net": "112419.20",
        "rival_set_complete": complete,
        "independent_groups_assumed": True,
    }


def _request(hyps: list[dict[str, Any]], points: str, profit: str) -> dict[str, Any]:
    return {
        "pricing_rule_id": RULE,
        "pricing_rule_revision": 1,
        "company_id": COMPANY,
        "company_revision": 1,
        "candidate_discounts": ["0.05", "0.12", "0.20"],
        "hypotheses": hyps,
        "constraints": {"min_price_points": points, "min_profit_net": profit},
    }


def _run(client: TestClient, payload: dict[str, Any]) -> dict[str, Any]:
    res = client.post(f"/api/v1/scopes/{SCOPE}/stress-tests", json=payload, headers=HEADERS)
    assert res.status_code == 200, res.text
    return res.json()  # type: ignore[no-any-return]


def test_oracle_a_selects_12_percent(seeded_client: TestClient) -> None:
    body = _run(seeded_client, _request([_hyp("Base", "80000.00")], "47", "8000.00"))
    assert body["tested_candidates"] == 3
    assert body["tested_hypotheses"] == 1
    sel = body["selection"]
    assert sel is not None
    assert sel["discount_rate"] == "0.12"
    assert sel["worst_profit_net"] == "24135.68"
    assert sel["worst_score"] == "49.000000000000"
    assert sel["feasible_count"] == 2
    rows = {r["discount_rate"]: r for r in body["by_discount"]}
    assert rows["0.05"]["all_feasible"] is False
    assert rows["0.12"]["all_feasible"] is True
    assert rows["0.20"]["all_feasible"] is True
    cell = next(
        c for c in body["cells"] if c["discount_rate"] == "0.12" and c["hypothesis_label"] == "Base"
    )
    assert cell["price_net"] == "104135.68"
    assert cell["feasible"] is True
    assert cell["reason"] == "meets_limits"


def test_oracle_b_no_selection_without_lowering_limits(seeded_client: TestClient) -> None:
    body = _run(seeded_client, _request([_hyp("Coste alto", "110000.00")], "47", "10000.00"))
    assert body["selection"] is None
    assert "no tested discount meets the limits" in body["selection_reason"]
    assert all(r["all_feasible"] is False for r in body["by_discount"])
    assert all(c["feasible"] is False for c in body["cells"])


def test_unknown_cells_never_win(seeded_client: TestClient) -> None:
    body = _run(
        seeded_client,
        _request(
            [_hyp("Base", "80000.00"), _hyp("Sin rivales claros", "80000.00", complete=False)],
            "47",
            "8000.00",
        ),
    )
    unknown = [c for c in body["cells"] if c["hypothesis_label"] == "Sin rivales claros"]
    assert unknown
    assert all(c["score"] is None and c["feasible"] is False for c in unknown)
    assert all(c["reason"] == "no_comparable" for c in unknown)
    assert body["selection"] is None  # the unknown hypothesis vetoes every discount
    assert any("never enter the selection" in w for w in body["warnings"])


def test_anomaly_only_warns(seeded_client: TestClient) -> None:
    payload = _request([_hyp("Base", "60000.00")], "40", "1000.00")
    payload["candidate_discounts"] = ["0.40"]
    body = _run(seeded_client, payload)
    assert body["selection"] is not None  # flagged but still selected
    assert body["selection"]["discount_rate"] == "0.40"
    assert any("informative only" in w for w in body["warnings"])


def test_period_mismatch_fails_the_cell(seeded_client: TestClient) -> None:
    body = _run(
        seeded_client, _request([_hyp("Otro periodo", "80000.00", period=12)], "47", "8000.00")
    )
    assert body["selection"] is None
    assert all(c["reason"] == "period_mismatch" for c in body["cells"])


def test_snapshot_roundtrip_is_identical(seeded_client: TestClient) -> None:
    body = _run(seeded_client, _request([_hyp("Base", "80000.00")], "47", "8000.00"))
    res = seeded_client.get(f"/api/v1/stress-tests/{body['id']}", headers=HEADERS)
    assert res.status_code == 200, res.text
    assert res.json() == body


def test_snapshot_survives_rule_change(seeded_client: TestClient) -> None:
    payload = _request([_hyp("Base", "80000.00")], "47", "8000.00")
    before = _run(seeded_client, payload)
    res = seeded_client.get(f"/api/v1/stress-tests/{before['id']}", headers=HEADERS)
    assert res.status_code == 200, res.text
    assert res.json()["selection"] == before["selection"]
