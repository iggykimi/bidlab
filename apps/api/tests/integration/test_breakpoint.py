"""PKG-T21 integration: breakpoint parity against the real engine.

Synthetic example, labelled: fixed price 104135.68 (12% off the 118336.00
seed budget) with an 8000.00 minimum -> max cost 96135.68. One cent more
breaks ONLY the profit condition under the same base: the price score is
identical because costs never score.
"""

from typing import Any

from fastapi.testclient import TestClient

HEADERS = {"X-BidLab-Client": "local-ui"}
SCOPE = "tias-whole"
RULE = "tias-price-r1"
PRICE = "104135.68"
MIN_PROFIT = "8000.00"
CEILING = "96135.68"


def _make_company(client: TestClient, cost: str, tag: str) -> str:
    res = client.post(
        "/api/v1/companies",
        json={
            "name": f"Breakpoint synthetic {tag}",
            "synthetic": True,
            "scope_id": SCOPE,
            "period_months": 24,
            "direct_cost_net": cost,
            "overhead_net": "0.00",
            "target_margin_rate": None,
            "evidence": [],
        },
        headers=HEADERS,
    )
    assert res.status_code == 201, res.text
    return str(res.json()["id"])  # type: ignore[no-any-return]


def _evaluate(client: TestClient, company_id: str) -> dict[str, Any]:
    res = client.post(
        "/api/v1/scenarios/evaluate",
        json={
            "scope_id": SCOPE,
            "pricing_rule_id": RULE,
            "pricing_rule_revision": 1,
            "company_id": company_id,
            "company_revision": 1,
            "discount_rate": "0.12",
            "rivals": {
                "state": "assumed",
                "complete": True,
                "group_membership_confirmed": True,
                "own_group_id": "own",
                "offers": [
                    {"label": "A", "price_net": "100000.00", "group_id": "a"},
                    {"label": "B", "price_net": "110052.48", "group_id": "b"},
                ],
            },
            "curve": None,
        },
        headers=HEADERS,
    )
    assert res.status_code == 200, res.text
    return res.json()  # type: ignore[no-any-return]


def test_breakpoint_parity_one_cent_breaks_only_profit(seeded_client: TestClient) -> None:
    at = _evaluate(seeded_client, _make_company(seeded_client, CEILING, "at-ceiling"))
    over = _evaluate(seeded_client, _make_company(seeded_client, "96135.69", "one-cent-over"))
    assert at["price_net"] == over["price_net"] == PRICE
    assert at["profit_net"] == MIN_PROFIT
    assert over["profit_net"] == "7999.99"
    assert at["score"]["value"] == over["score"]["value"] == "47.053997246669"


def test_stress_reports_ceiling_per_discount(seeded_client: TestClient) -> None:
    res = seeded_client.post(
        f"/api/v1/scopes/{SCOPE}/stress-tests",
        json={
            "pricing_rule_id": RULE,
            "pricing_rule_revision": 1,
            "company_id": "company-demo",
            "company_revision": 1,
            "candidate_discounts": ["0.12"],
            "hypotheses": [
                {
                    "label": "Base",
                    "cost_net": "80000.00",
                    "period_months": 24,
                    "rival_a_net": "106502.40",
                    "rival_b_net": "112419.20",
                    "rival_set_complete": True,
                    "independent_groups_assumed": True,
                }
            ],
            "constraints": {"min_price_points": "47", "min_profit_net": MIN_PROFIT},
        },
        headers=HEADERS,
    )
    assert res.status_code == 200, res.text
    rows = res.json()["by_discount"]
    assert rows[0]["price_net"] == PRICE
    assert rows[0]["max_cost_net"] == CEILING


def test_stress_negative_ceiling_is_null(seeded_client: TestClient) -> None:
    res = seeded_client.post(
        f"/api/v1/scopes/{SCOPE}/stress-tests",
        json={
            "pricing_rule_id": RULE,
            "pricing_rule_revision": 1,
            "company_id": "company-demo",
            "company_revision": 1,
            "candidate_discounts": ["0.20"],
            "hypotheses": [
                {
                    "label": "Base",
                    "cost_net": "80000.00",
                    "period_months": 24,
                    "rival_a_net": "106502.40",
                    "rival_b_net": "112419.20",
                    "rival_set_complete": True,
                    "independent_groups_assumed": True,
                }
            ],
            "constraints": {"min_price_points": "47", "min_profit_net": "200000.00"},
        },
        headers=HEADERS,
    )
    assert res.status_code == 200, res.text
    rows = res.json()["by_discount"]
    assert rows[0]["price_net"] == "94668.80"
    assert rows[0]["max_cost_net"] is None
