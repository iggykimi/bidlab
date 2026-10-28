"""P0-1/P0-2: evaluate() rejects crossed economic context.

Same scope, period and basis: a rule or company from another scope must
fail (422), and a cost with a known period different from the scope's
known period must fail (422). Unknown periods stay usable.
"""

import uuid
from typing import Any

from fastapi.testclient import TestClient

HEADERS = {"X-BidLab-Client": "local-ui"}

INVERSE_EXPR: dict[str, Any] = {
    "kind": "call",
    "op": "div",
    "args": [
        {
            "kind": "call",
            "op": "mul",
            "args": [
                {"kind": "var", "name": "max_points"},
                {"kind": "var", "name": "best_price"},
            ],
        },
        {"kind": "var", "name": "own_price"},
    ],
}


def _create_tender(client: TestClient, tag: str, period: int | None = 24) -> dict[str, Any]:
    res = client.post(
        "/api/v1/tenders",
        headers={**HEADERS, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "title": f"Contexto {tag}",
            "external_id": f"2026/CTX-{tag}",
            "contracting_body": "Ayuntamiento de Prueba",
            "source_url": None,
            "scope_label": None,
            "basis": {
                "pbl_net": "100000.00",
                "pbl_gross": None,
                "tax_kind": "VAT",
                "period_months": period,
                "currency": "EUR",
            },
        },
    )
    assert res.status_code == 201, res.text
    data: dict[str, Any] = res.json()
    return data


def _approve(
    client: TestClient, tender_id: str, scope: str, rule_id: str, period: int | None = 24
) -> None:
    res = client.post(
        f"/api/v1/tenders/{tender_id}/reviews",
        json={
            "expected_revision": 0,
            "approved_claim_keys": [],
            "requirement_trees": [],
            "scope_basis": {
                "scope_id": scope,
                "budget_net": "100000.00",
                "ceiling_net": None,
                "scoring_reference_net": "100000.00",
                "reference_kind": "pbl",
                "currency": "EUR",
                "unit": "lump_sum",
                "period_months": period,
                "tax_kind": "VAT",
                "review_status": "approved",
                "evidence_ids": [],
                "metadata_evidence": [],
            },
            "pricing_rule": {
                "id": rule_id,
                "revision": 1,
                "scope_id": scope,
                "template_id": "proportional_inverse",
                "max_points": "49",
                "expression": INVERSE_EXPR,
                "review_status": "approved",
                "zero_denominator_policy": "unknown",
                "evidence_ids": [],
                "anomaly_policy": {
                    "id": f"{rule_id}-anom",
                    "source_kind": "unknown",
                    "variant": "unsupported",
                    "review_status": "approved",
                    "three_bidder_absolute_25": False,
                    "percentage_reduction_one_third": False,
                    "evidence_ids": [],
                },
            },
            "corrected_proposal": None,
            "actor": "reviewer-ctx",
            "reason": "checked context",
        },
        headers=HEADERS,
    )
    assert res.status_code == 200, res.text


def _create_company(client: TestClient, scope: str, period: int) -> dict[str, Any]:
    res = client.post(
        "/api/v1/companies",
        json={
            "name": "Empresa ctx",
            "synthetic": True,
            "scope_id": scope,
            "period_months": period,
            "direct_cost_net": "80000.00",
            "overhead_net": "10000.00",
            "target_margin_rate": None,
            "evidence": [],
        },
        headers=HEADERS,
    )
    assert res.status_code == 201, res.text
    data: dict[str, Any] = res.json()
    return data


def _evaluate(
    client: TestClient, scope: str, rule_id: str, company_id: str
) -> Any:
    return client.post(
        "/api/v1/scenarios/evaluate",
        json={
            "scope_id": scope,
            "pricing_rule_id": rule_id,
            "pricing_rule_revision": 1,
            "company_id": company_id,
            "company_revision": 1,
            "discount_rate": "0.05",
            "rivals": {
                "state": "assumed",
                "complete": True,
                "group_membership_confirmed": True,
                "own_group_id": "own",
                "offers": [
                    {"label": "Rival A", "price_net": "90000.00", "group_id": "a"},
                    {"label": "Rival B", "price_net": "92000.00", "group_id": "b"},
                ],
            },
            "curve": None,
        },
        headers=HEADERS,
    )


def _setup(client: TestClient, tag: str) -> tuple[str, str, str]:
    tender = _create_tender(client, tag)
    tender_id = str(tender["id"])
    scope = str(tender["scopes"][0]["id"])
    _approve(client, tender_id, scope, f"ctx-{tag}")
    return tender_id, scope, f"ctx-{tag}"


def test_same_context_evaluates(fresh_client: TestClient) -> None:
    _, scope, rule = _setup(fresh_client, "same")
    company = _create_company(fresh_client, scope, 24)
    res = _evaluate(fresh_client, scope, rule, str(company["id"]))
    assert res.status_code == 200, res.text


def test_company_from_other_scope_rejected(fresh_client: TestClient) -> None:
    _, scope_a, rule_a = _setup(fresh_client, "a1")
    _, scope_b, _ = _setup(fresh_client, "b1")
    company_b = _create_company(fresh_client, scope_b, 24)
    _create_company(fresh_client, scope_a, 24)
    res = _evaluate(fresh_client, scope_a, rule_a, str(company_b["id"]))
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "company_scope_mismatch"


def test_rule_from_other_scope_rejected(fresh_client: TestClient) -> None:
    _, scope_a, _ = _setup(fresh_client, "a2")
    _, _scope_b, rule_b = _setup(fresh_client, "b2")
    company_a = _create_company(fresh_client, scope_a, 24)
    res = _evaluate(fresh_client, scope_a, rule_b, str(company_a["id"]))
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "rule_scope_mismatch"


def test_cost_period_mismatch_rejected(fresh_client: TestClient) -> None:
    _, scope, rule = _setup(fresh_client, "p1")
    company = _create_company(fresh_client, scope, 12)
    res = _evaluate(fresh_client, scope, rule, str(company["id"]))
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "period_mismatch"


def test_unknown_scope_period_stays_usable(fresh_client: TestClient) -> None:
    tender = _create_tender(fresh_client, "p2", period=None)
    tender_id = str(tender["id"])
    scope = str(tender["scopes"][0]["id"])
    _approve(fresh_client, tender_id, scope, "ctx-p2", period=None)
    company = _create_company(fresh_client, scope, 12)
    res = _evaluate(fresh_client, scope, "ctx-p2", str(company["id"]))
    assert res.status_code == 200, res.text
