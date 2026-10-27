"""R05: an approved review materializes into executable rule/scope data.

Own tenders (intake-created, no seed) must reach evaluate() after approving
a pricing rule + scope basis. Pending/blocked payloads only record; foreign
scopes, bad expressions, duplicates and budget-less bases fail with no
orphan interpretation revision.
"""

import uuid
from typing import Any

from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

HEADERS = {"X-BidLab-Client": "local-ui"}

# Canonical S(P) = max_points * best_price / own_price (proportional_inverse).
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

# Canonical linear_discount AST: valid on its own, but NOT its template when
# submitted under proportional_inverse (expression/template mismatch case).
LINEAR_EXPR: dict[str, Any] = {
    "kind": "call",
    "op": "div",
    "args": [
        {
            "kind": "call",
            "op": "mul",
            "args": [
                {"kind": "var", "name": "max_points"},
                {
                    "kind": "call",
                    "op": "sub",
                    "args": [
                        {"kind": "var", "name": "reference_price"},
                        {"kind": "var", "name": "own_price"},
                    ],
                },
            ],
        },
        {
            "kind": "call",
            "op": "sub",
            "args": [
                {"kind": "var", "name": "reference_price"},
                {"kind": "var", "name": "best_price"},
            ],
        },
    ],
}


def _create_tender(client: TestClient, pbl_net: str = "100000.00") -> dict[str, Any]:
    res = client.post(
        "/api/v1/tenders",
        headers={**HEADERS, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "title": "Servicio propio R05",
            "external_id": "2026/R05-own",
            "contracting_body": "Ayuntamiento de Prueba",
            "source_url": None,
            "scope_label": None,
            "basis": {
                "pbl_net": pbl_net,
                "pbl_gross": None,
                "tax_kind": "VAT",
                "period_months": 12,
                "currency": "EUR",
            },
        },
    )
    assert res.status_code == 201, res.text
    data: dict[str, Any] = res.json()
    return data


def _scope_id(tender: dict[str, Any]) -> str:
    scopes = tender["scopes"]
    assert isinstance(scopes, list) and scopes
    return str(scopes[0]["id"])


def _seed_interpretation(tender_id: str) -> None:
    """Stand-in for analysis output: empty proposal, nothing to approve."""
    with Session(get_engine()) as session:
        session.add(
            models.InterpretationRevision(
                tender_id=tender_id,
                revision=1,
                mode="fixture",
                proposal_json={"claims": []},
                reviewed_json={},
                document_hashes_json={},
                actor="fixture",
                reason="fixture",
                created_at="2026-10-27T00:00:00+00:00",
            )
        )
        session.commit()


def _max_revision(tender_id: str) -> int:
    with Session(get_engine()) as session:
        return int(
            session.scalar(
                select(func.max(models.InterpretationRevision.revision)).where(
                    models.InterpretationRevision.tender_id == tender_id
                )
            )
            or 0
        )


def _rule_count(rule_id: str, revision: int) -> int:
    with Session(get_engine()) as session:
        row = session.get(models.RuleRevision, (rule_id, revision))
        return 0 if row is None else 1


def _basis(scope_id: str, budget_net: str | None, status: str = "approved") -> dict[str, Any]:
    return {
        "scope_id": scope_id,
        "budget_net": budget_net,
        "ceiling_net": None,
        "scoring_reference_net": budget_net,
        "reference_kind": "pbl",
        "currency": "EUR",
        "unit": "lump_sum",
        "period_months": 12,
        "tax_kind": "VAT",
        "review_status": status,
        "evidence_ids": [],
        "metadata_evidence": [],
    }


def _rule(
    rule_id: str,
    scope_id: str,
    *,
    expression: dict[str, Any] | None = None,
    template_id: str = "proportional_inverse",
    status: str = "approved",
    revision: int = 1,
) -> dict[str, Any]:
    return {
        "id": rule_id,
        "revision": revision,
        "scope_id": scope_id,
        "template_id": template_id,
        "max_points": "49",
        "expression": INVERSE_EXPR if expression is None else expression,
        "review_status": status,
        "zero_denominator_policy": "unknown",
        "evidence_ids": [],
        "anomaly_policy": {
            "id": f"{rule_id}-anom",
            "source_kind": "explicit_pcap",
            "variant": "tias_18_5",
            "review_status": "approved",
            "three_bidder_absolute_25": True,
            "percentage_reduction_one_third": False,
            "evidence_ids": [],
        },
    }


def _review(
    client: TestClient,
    tender_id: str,
    *,
    expected_revision: int = 1,
    basis: dict[str, Any] | None = None,
    rule: dict[str, Any] | None = None,
) -> Any:
    return client.post(
        f"/api/v1/tenders/{tender_id}/reviews",
        json={
            "expected_revision": expected_revision,
            "approved_claim_keys": [],
            "requirement_trees": [],
            "scope_basis": basis,
            "pricing_rule": rule,
            "corrected_proposal": None,
            "actor": "reviewer-r05",
            "reason": "checked R05",
        },
        headers=HEADERS,
    )


def _create_company(client: TestClient, scope_id: str) -> dict[str, Any]:
    res = client.post(
        "/api/v1/companies",
        json={
            "name": "Constructora R05",
            "synthetic": True,
            "scope_id": scope_id,
            "period_months": 12,
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


def test_approved_review_materializes_then_evaluates(fresh_client: TestClient) -> None:
    tender = _create_tender(fresh_client)
    tender_id = str(tender["id"])
    scope = _scope_id(tender)
    _seed_interpretation(tender_id)

    res = _review(
        fresh_client,
        tender_id,
        basis=_basis(scope, "120000.00"),
        rule=_rule("own-price-r1", scope),
    )
    assert res.status_code == 200, res.text
    workspace = g.Workspace.model_validate(res.json())
    assert workspace.interpretation_revision == 2
    assert [rule.id.root for rule in workspace.pricing_rules] == ["own-price-r1"]

    with Session(get_engine()) as session:
        row = session.get(models.RuleRevision, ("own-price-r1", 1))
        assert row is not None
        assert row.scope_id == scope
        assert row.interpretation_revision == 2
        assert row.review_status == "approved"
        assert row.actor == "reviewer-r05"
        assert isinstance(row.rule_json, dict)
        assert row.rule_json["template_id"] == "proportional_inverse"
        assert isinstance(row.rule_json["anomaly_policy"], dict)
        assert row.rule_json["anomaly_policy"]["variant"] == "tias_18_5"
        scope_row = session.get(models.Scope, scope)
        assert scope_row is not None
        assert isinstance(scope_row.basis_json, dict)
        assert scope_row.basis_json["review_status"] == "approved"
        assert scope_row.basis_json["budget_net"] == "120000.00"
        assert scope_row.budget_net_cents == 12000000

    company = _create_company(fresh_client, scope)
    res = fresh_client.post(
        "/api/v1/scenarios/evaluate",
        json={
            "scope_id": scope,
            "pricing_rule_id": "own-price-r1",
            "pricing_rule_revision": 1,
            "company_id": company["id"],
            "company_revision": 1,
            "discount_rate": "0.05",
            "rivals": {
                "state": "unspecified",
                "complete": True,
                "group_membership_confirmed": True,
                "own_group_id": "own",
                "offers": [],
            },
            "curve": None,
        },
        headers=HEADERS,
    )
    assert res.status_code == 200, res.text
    result = g.EvaluationResult.model_validate(res.json()).model_dump(mode="json")
    assert result["price_net"] == "114000.00"
    assert result["score"]["status"] == "defined"


def test_pending_and_blocked_do_not_materialize(fresh_client: TestClient) -> None:
    tender = _create_tender(fresh_client)
    tender_id = str(tender["id"])
    scope = _scope_id(tender)
    _seed_interpretation(tender_id)

    res = _review(
        fresh_client,
        tender_id,
        basis=_basis(scope, "120000.00", status="pending"),
        rule=_rule("own-price-r1", scope, status="pending"),
    )
    assert res.status_code == 200, res.text
    res = _review(
        fresh_client,
        tender_id,
        expected_revision=2,
        basis=_basis(scope, "120000.00", status="blocked"),
        rule=_rule("own-price-r1", scope, status="blocked"),
    )
    assert res.status_code == 200, res.text

    assert _rule_count("own-price-r1", 1) == 0
    with Session(get_engine()) as session:
        scope_row = session.get(models.Scope, scope)
        assert scope_row is not None
        assert isinstance(scope_row.basis_json, dict)
        assert scope_row.basis_json["review_status"] == "pending"
        assert scope_row.budget_net_cents == 10000000


def test_foreign_rule_scope_rejected_without_orphan(fresh_client: TestClient) -> None:
    own = _create_tender(fresh_client)
    other = _create_tender(fresh_client)
    own_id = str(own["id"])
    _seed_interpretation(own_id)

    res = _review(fresh_client, own_id, rule=_rule("own-price-r1", _scope_id(other)), basis=None)
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "rule_scope_mismatch"
    assert _max_revision(own_id) == 1
    assert _rule_count("own-price-r1", 1) == 0


def test_foreign_basis_scope_rejected_without_orphan(fresh_client: TestClient) -> None:
    own = _create_tender(fresh_client)
    other = _create_tender(fresh_client)
    own_id = str(own["id"])
    own_scope = _scope_id(own)
    _seed_interpretation(own_id)

    res = _review(fresh_client, own_id, basis=_basis(_scope_id(other), "120000.00"))
    assert res.status_code == 422, res.text
    assert _max_revision(own_id) == 1
    with Session(get_engine()) as session:
        scope_row = session.get(models.Scope, own_scope)
        assert scope_row is not None
        assert isinstance(scope_row.basis_json, dict)
        assert scope_row.basis_json["review_status"] == "pending"
        assert scope_row.budget_net_cents == 10000000


def test_expression_template_mismatch_rejected_without_orphan(
    fresh_client: TestClient,
) -> None:
    tender = _create_tender(fresh_client)
    tender_id = str(tender["id"])
    scope = _scope_id(tender)
    _seed_interpretation(tender_id)

    res = _review(
        fresh_client,
        tender_id,
        rule=_rule("own-price-r1", scope, expression=LINEAR_EXPR),
    )
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "rule_expression_invalid"
    assert _max_revision(tender_id) == 1
    assert _rule_count("own-price-r1", 1) == 0


def test_missing_expression_rejected(fresh_client: TestClient) -> None:
    tender = _create_tender(fresh_client)
    tender_id = str(tender["id"])
    scope = _scope_id(tender)
    _seed_interpretation(tender_id)

    rule = _rule("own-price-r1", scope, template_id="unsupported")
    rule["expression"] = None
    res = _review(fresh_client, tender_id, rule=rule)
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "rule_expression_invalid"
    assert _max_revision(tender_id) == 1


def test_duplicate_rule_revision_conflicts_without_orphan(fresh_client: TestClient) -> None:
    tender = _create_tender(fresh_client)
    tender_id = str(tender["id"])
    scope = _scope_id(tender)
    _seed_interpretation(tender_id)

    res = _review(fresh_client, tender_id, rule=_rule("own-price-r1", scope))
    assert res.status_code == 200, res.text
    res = _review(
        fresh_client,
        tender_id,
        expected_revision=2,
        rule=_rule("own-price-r1", scope),
    )
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "rule_revision_conflict"
    assert _max_revision(tender_id) == 2
    assert _rule_count("own-price-r1", 1) == 1


def test_approved_basis_updates_scope_budget(fresh_client: TestClient) -> None:
    tender = _create_tender(fresh_client, pbl_net="50000.00")
    tender_id = str(tender["id"])
    scope = _scope_id(tender)
    _seed_interpretation(tender_id)

    res = _review(fresh_client, tender_id, basis=_basis(scope, "75000.50"))
    assert res.status_code == 200, res.text
    with Session(get_engine()) as session:
        scope_row = session.get(models.Scope, scope)
        assert scope_row is not None
        assert isinstance(scope_row.basis_json, dict)
        assert scope_row.basis_json["review_status"] == "approved"
        assert scope_row.basis_json["budget_net"] == "75000.50"
        assert scope_row.budget_net_cents == 7500050


def test_approved_basis_without_budget_rejected(fresh_client: TestClient) -> None:
    tender = _create_tender(fresh_client)
    tender_id = str(tender["id"])
    scope = _scope_id(tender)
    _seed_interpretation(tender_id)

    res = _review(fresh_client, tender_id, basis=_basis(scope, None))
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "basis_budget_invalid"
    assert _max_revision(tender_id) == 1
    with Session(get_engine()) as session:
        scope_row = session.get(models.Scope, scope)
        assert scope_row is not None
        assert scope_row.budget_net_cents == 10000000


def test_manual_review_without_analysis_opens_revision_1(
    fresh_client: TestClient,
) -> None:
    """Doc-less own tender: expected 0 opens revision 1 and materializes."""
    tender = _create_tender(fresh_client)
    tender_id = str(tender["id"])
    scope = _scope_id(tender)

    res = _review(
        fresh_client,
        tender_id,
        expected_revision=0,
        basis=_basis(scope, "120000.00"),
        rule=_rule("own-price-r1", scope),
    )
    assert res.status_code == 200, res.text
    workspace = g.Workspace.model_validate(res.json())
    assert workspace.interpretation_revision == 1
    assert [rule.id.root for rule in workspace.pricing_rules] == ["own-price-r1"]
    assert _rule_count("own-price-r1", 1) == 1


def test_manual_review_without_analysis_rejects_stale_expected(
    fresh_client: TestClient,
) -> None:
    """No interpretation yet: expected > 0 is a conflict, with no orphan."""
    tender = _create_tender(fresh_client)
    tender_id = str(tender["id"])
    scope = _scope_id(tender)

    res = _review(
        fresh_client,
        tender_id,
        expected_revision=2,
        basis=_basis(scope, "120000.00"),
        rule=_rule("own-price-r1", scope),
    )
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "revision_conflict"
    assert _max_revision(tender_id) == 0
    assert _rule_count("own-price-r1", 1) == 0
