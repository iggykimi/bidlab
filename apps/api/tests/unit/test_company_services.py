"""Company CRUD + eligibility service checks (T13/T21, no HTTP)."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import companies as companies_service
from bidlab.services import eligibility as eligibility_service
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    models.Base.metadata.create_all(engine)
    with Session(engine) as sess:
        sess.add(
            models.Tender(
                id="t1",
                feed_id="feed",
                atom_id="atom",
                external_id="ext",
                title="Tender",
                source_url="https://example.test/t",
                source_updated_at="2026-01-01T00:00:00Z",
                metadata_json={},
            )
        )
        sess.add(
            models.Scope(
                id="s1",
                tender_id="t1",
                lot_key="__whole__",
                basis_json={},
                budget_net_cents=100,
            )
        )
        sess.commit()
        yield sess


def _write(**over: Any) -> g.CompanyWrite:
    data: dict[str, Any] = {
        "name": "ACME",
        "synthetic": True,
        "scope_id": "s1",
        "period_months": 24,
        "direct_cost_net": "80000.00",
        "overhead_net": "10000.00",
        "target_margin_rate": "0.1000",
        "evidence": [],
    }
    data.update(over)
    return g.CompanyWrite.model_validate(data)


def _evidence(
    field: str,
    value: str,
    unit: str = "EUR",
    reviewed: bool = True,
    reference: str = "attestation-1",
    **over: Any,
) -> dict[str, Any]:
    item: dict[str, Any] = {
        "field_key": field,
        "value": value,
        "unit": unit,
        "period_from": None,
        "period_to": None,
        "source_type": "user_attestation",
        "reference": reference,
        "reviewed": reviewed,
    }
    item.update(over)
    return item


def _leaf(
    leaf_id: str = "req-1",
    field: str = "annual_turnover_best_3y_net",
    operator: str = "gte",
    threshold: str | None = "295840.00",
    unit: str | None = "EUR",
    review_status: str = "approved",
    evidence_ids: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "kind": "leaf",
        "id": leaf_id,
        "label": f"leaf {leaf_id}",
        "company_field": field,
        "operator": operator,
        "threshold": threshold,
        "unit": unit,
        "review_status": review_status,
        "evidence_ids": evidence_ids or [],
    }


def _interp(session: Session, tree: dict[str, Any] | None, revision: int = 1) -> None:
    session.add(
        models.InterpretationRevision(
            tender_id="t1",
            revision=revision,
            mode="manual",
            proposal_json={},
            reviewed_json={} if tree is None else {"requirements_tree": tree},
            document_hashes_json={},
            actor="test",
            reason="test",
            created_at="2026-10-26T00:00:00Z",
        )
    )
    session.commit()


def _check(
    company_id: str,
    company_revision: int = 1,
    interpretation_revision: int = 1,
    scope_id: str = "s1",
    tender_id: str = "t1",
) -> g.EligibilityRequest:
    return g.EligibilityRequest.model_validate(
        {
            "tender_id": tender_id,
            "scope_id": scope_id,
            "company_id": company_id,
            "company_revision": company_revision,
            "interpretation_revision": interpretation_revision,
        }
    )


def _item(result: dict[str, Any], requirement_id: str) -> dict[str, Any]:
    for entry in result["items"]:
        assert isinstance(entry, dict)
        if entry["requirement_id"] == requirement_id:
            return entry
    raise AssertionError(f"missing item {requirement_id}")


def test_create_get_roundtrip(session: Session) -> None:
    created = companies_service.create_company(
        session, _write(evidence=[_evidence("annual_turnover_best_3y_net", "300000.00")])
    )
    company = g.Company.model_validate(created)
    assert company.revision == 1
    assert company.direct_cost_net is not None and company.direct_cost_net.root == "80000.00"
    assert len(company.evidence) == 1
    fetched = companies_service.get_company(session, company.id)
    assert fetched == created


def test_money_none_roundtrip(session: Session) -> None:
    created = companies_service.create_company(
        session, _write(direct_cost_net=None, overhead_net=None, target_margin_rate=None)
    )
    assert created["direct_cost_net"] is None
    assert created["overhead_net"] is None
    assert created["target_margin_rate"] is None


def test_update_bumps_revision_and_rejects_stale(session: Session) -> None:
    created = companies_service.create_company(session, _write())
    company_id = str(created["id"])
    updated = companies_service.update_company(
        session,
        company_id,
        g.CompanyUpdate.model_validate({**_write(name="ACME 2").model_dump(mode="json"),
                                        "expected_revision": 1}),
    )
    assert updated["revision"] == 2
    assert updated["name"] == "ACME 2"
    with pytest.raises(ApiError) as exc:
        companies_service.update_company(
            session,
            company_id,
            g.CompanyUpdate.model_validate(
                {**_write().model_dump(mode="json"), "expected_revision": 1}
            ),
        )
    assert exc.value.status_code == 409
    assert exc.value.code == "stale_revision"


def test_company_not_found_variants(session: Session) -> None:
    with pytest.raises(ApiError) as exc:
        companies_service.get_company(session, "nope")
    assert (exc.value.status_code, exc.value.code) == (404, "company_not_found")
    with pytest.raises(ApiError) as exc:
        companies_service.create_company(session, _write(scope_id="nope"))
    assert (exc.value.status_code, exc.value.code) == (404, "scope_not_found")
    with pytest.raises(ApiError) as exc:
        companies_service.update_company(
            session, "nope", g.CompanyUpdate.model_validate(
                {**_write().model_dump(mode="json"), "expected_revision": 1}
            )
        )
    assert (exc.value.status_code, exc.value.code) == (404, "company_not_found")


def test_leaf_met_cites_company_reference_and_citations(session: Session) -> None:
    created = companies_service.create_company(
        session, _write(evidence=[_evidence("annual_turnover_best_3y_net", "300000.00")])
    )
    _interp(session, _leaf(evidence_ids=["cit-turnover"]))
    result = eligibility_service.check(session, _check(str(created["id"])))
    parsed = g.EligibilityResult.model_validate(result)
    assert parsed.verdict == "met"
    assert (parsed.assessed_count, parsed.unassessed_count) == (1, 0)
    assert parsed.hypothetical_company is True
    item = _item(result, "req-1")
    assert item["verdict"] == "met"
    assert item["reason_codes"] == ["value_meets_threshold"]
    assert item["evidence_refs"] == ["cit-turnover", "attestation-1"]


def test_leaf_not_met_below_threshold(session: Session) -> None:
    created = companies_service.create_company(
        session, _write(evidence=[_evidence("annual_turnover_best_3y_net", "100000.00")])
    )
    _interp(session, _leaf())
    result = eligibility_service.check(session, _check(str(created["id"])))
    assert result["verdict"] == "not_met"
    item = _item(result, "req-1")
    assert item["verdict"] == "not_met"
    assert item["reason_codes"] == ["value_below_threshold"]
    assert item["evidence_refs"] == ["attestation-1"]
    assert (result["assessed_count"], result["unassessed_count"]) == (1, 0)


@pytest.mark.parametrize(
    ("mutate", "reason"),
    [
        ("missing", "missing_company_evidence"),
        ("unreviewed", "evidence_not_reviewed"),
        ("unit", "unit_mismatch"),
        ("manual", "manual_review_required"),
        ("pending", "rule_not_approved"),
        ("no_threshold", "missing_threshold"),
        ("bad_value", "value_unparseable"),
        ("bad_threshold", "threshold_unparseable"),
        ("short_period", "insufficient_period"),
    ],
)
def test_unknown_preserved(session: Session, mutate: str, reason: str) -> None:
    evidence: list[dict[str, Any]] = []
    leaf = _leaf()
    if mutate == "unreviewed":
        evidence = [_evidence("annual_turnover_best_3y_net", "999999.00", reviewed=False)]
    elif mutate == "unit":
        evidence = [_evidence("annual_turnover_best_3y_net", "999999.00", unit="USD")]
    elif mutate == "bad_value":
        evidence = [_evidence("annual_turnover_best_3y_net", "a lot")]
    elif mutate == "short_period":
        evidence = [
            _evidence(
                "annual_turnover_best_3y_net",
                "999999.00",
                period_from=date(2025, 1, 1),
                period_to=date(2025, 12, 31),
            )
        ]
    elif mutate not in ("missing", "manual", "pending", "no_threshold", "bad_threshold"):
        raise AssertionError(f"bad param {mutate}")
    if mutate not in ("missing", "unreviewed", "unit", "bad_value", "short_period"):
        evidence = [_evidence("annual_turnover_best_3y_net", "999999.00")]
    if mutate == "manual":
        leaf = _leaf(field="manual", operator="manual", threshold=None, unit=None)
    elif mutate == "pending":
        leaf = _leaf(review_status="pending")
    elif mutate == "no_threshold":
        leaf = _leaf(threshold=None)
    elif mutate == "bad_threshold":
        leaf = _leaf(threshold="mucho")
    created = companies_service.create_company(session, _write(evidence=evidence))
    _interp(session, leaf)
    result = eligibility_service.check(session, _check(str(created["id"])))
    assert result["verdict"] == "unknown"
    item = _item(result, "req-1")
    assert item["verdict"] == "unknown"
    assert item["reason_codes"] == [reason]
    assert (result["assessed_count"], result["unassessed_count"]) == (0, 1)


def test_three_year_span_allows_met(session: Session) -> None:
    created = companies_service.create_company(
        session,
        _write(
            evidence=[
                _evidence(
                    "annual_turnover_best_3y_net",
                    "300000.00",
                    period_from=date(2022, 1, 1),
                    period_to=date(2025, 1, 2),
                )
            ]
        ),
    )
    _interp(session, _leaf())
    result = eligibility_service.check(session, _check(str(created["id"])))
    assert _item(result, "req-1")["verdict"] == "met"


@pytest.mark.parametrize(
    ("operator", "threshold", "value", "verdict", "reason"),
    [
        ("lte", "10.00", "9.99", "met", "value_meets_threshold"),
        ("lte", "10.00", "10.01", "not_met", "value_above_threshold"),
        ("eq", "7.50", "7.50", "met", "value_meets_threshold"),
        ("eq", "7.50", "7.51", "not_met", "value_differs"),
    ],
)
def test_numeric_operators(
    session: Session, operator: str, threshold: str, value: str, verdict: str, reason: str
) -> None:
    created = companies_service.create_company(
        session, _write(evidence=[_evidence("team_feder_years", value, unit="years")])
    )
    _interp(session, _leaf(field="team_feder_years", operator=operator,
                           threshold=threshold, unit="years"))
    result = eligibility_service.check(session, _check(str(created["id"])))
    item = _item(result, "req-1")
    assert item["verdict"] == verdict
    assert item["reason_codes"] == [reason]


def test_contains_operator(session: Session) -> None:
    created = companies_service.create_company(
        session, _write(evidence=[_evidence("team_feder_years", "5 years FEDER", unit="text")])
    )
    _interp(session, _leaf(field="team_feder_years", operator="contains",
                           threshold="FEDER", unit="text"))
    assert _item(eligibility_service.check(session, _check(str(created["id"]))), "req-1")[
        "verdict"
    ] == "met"
    _interp(session, _leaf(field="team_feder_years", operator="contains",
                           threshold="FSE", unit="text"), revision=2)
    result = eligibility_service.check(
        session, _check(str(created["id"]), interpretation_revision=2)
    )
    item = _item(result, "req-1")
    assert item["verdict"] == "not_met"
    assert item["reason_codes"] == ["text_not_found"]


def test_group_fold_and_or(session: Session) -> None:
    created = companies_service.create_company(
        session,
        _write(
            synthetic=False,
            evidence=[_evidence("annual_turnover_best_3y_net", "300000.00")],
        ),
    )
    tree: dict[str, Any] = {
        "kind": "group",
        "id": "root",
        "label": "root",
        "operator": "AND",
        "children": [
            {
                "kind": "group",
                "id": "either",
                "label": "either",
                "operator": "OR",
                "children": [_leaf("a-met"), _leaf("b-missing", field="net_worth_net")],
            },
            _leaf("c-manual", field="manual", operator="manual", threshold=None, unit=None),
        ],
    }
    _interp(session, tree)
    result = eligibility_service.check(session, _check(str(created["id"])))
    # OR(met, unknown) = met; AND(met, unknown) = unknown.
    assert result["verdict"] == "unknown"
    assert _item(result, "a-met")["verdict"] == "met"
    assert _item(result, "b-missing")["verdict"] == "unknown"
    assert _item(result, "c-manual")["verdict"] == "unknown"
    assert (result["assessed_count"], result["unassessed_count"]) == (1, 2)
    assert result["hypothetical_company"] is False


def test_missing_tree_is_unknown(session: Session) -> None:
    created = companies_service.create_company(session, _write())
    _interp(session, None)
    result = eligibility_service.check(session, _check(str(created["id"])))
    assert result == {
        "verdict": "unknown",
        "items": [],
        "assessed_count": 0,
        "unassessed_count": 0,
        "hypothetical_company": True,
    }


@pytest.mark.parametrize(
    "value",
    ["Infinity", "-Infinity", "NaN", "1e3", "1E-3", "  ", "12,5", "sNaN"],
)
def test_non_finite_or_exponent_values_are_unknown(session: Session, value: str) -> None:
    """C2: Infinity must not read as met, NaN must not read as not_met."""
    created = companies_service.create_company(
        session, _write(evidence=[_evidence("team_feder_years", value, unit="years")])
    )
    _interp(
        session,
        _leaf(field="team_feder_years", operator="gte", threshold="3", unit="years"),
    )
    result = eligibility_service.check(session, _check(str(created["id"])))
    assert result["verdict"] == "unknown"
    item = _item(result, "req-1")
    assert item["verdict"] == "unknown"
    assert item["reason_codes"] == ["value_unparseable"]


@pytest.mark.parametrize("threshold", ["Infinity", "-Infinity", "NaN", "1e2"])
def test_non_finite_or_exponent_threshold_is_unknown(
    session: Session, threshold: str
) -> None:
    created = companies_service.create_company(
        session, _write(evidence=[_evidence("team_feder_years", "5", unit="years")])
    )
    _interp(
        session,
        _leaf(
            field="team_feder_years",
            operator="gte",
            threshold=threshold,
            unit="years",
        ),
    )
    result = eligibility_service.check(session, _check(str(created["id"])))
    item = _item(result, "req-1")
    assert item["verdict"] == "unknown"
    assert item["reason_codes"] == ["threshold_unparseable"]


def test_scope_guards(session: Session) -> None:
    session.add(
        models.Tender(
            id="t2",
            feed_id="feed",
            atom_id="atom2",
            external_id="ext2",
            title="Other",
            source_url="https://example.test/o",
            source_updated_at="2026-01-01T00:00:00Z",
            metadata_json={},
        )
    )
    session.add(
        models.Scope(id="s2", tender_id="t1", lot_key="lot2", basis_json={},
                     budget_net_cents=100)
    )
    session.add(
        models.Scope(id="s9", tender_id="t2", lot_key="__whole__", basis_json={},
                     budget_net_cents=100)
    )
    session.commit()
    created = companies_service.create_company(session, _write())
    company_id = str(created["id"])
    _interp(session, _leaf())
    with pytest.raises(ApiError) as exc:
        eligibility_service.check(session, _check(company_id, scope_id="s2"))
    assert (exc.value.status_code, exc.value.code) == (422, "company_scope_mismatch")
    with pytest.raises(ApiError) as exc:
        eligibility_service.check(session, _check(company_id, scope_id="s9", tender_id="t1"))
    assert (exc.value.status_code, exc.value.code) == (422, "scope_tender_mismatch")
    with pytest.raises(ApiError) as exc:
        eligibility_service.check(session, _check(company_id, interpretation_revision=9))
    assert (exc.value.status_code, exc.value.code) == (404, "interpretation_not_found")
    with pytest.raises(ApiError) as exc:
        eligibility_service.check(session, _check(company_id, tender_id="nope"))
    assert (exc.value.status_code, exc.value.code) == (404, "tender_not_found")
