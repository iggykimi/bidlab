"""Companies CRUD + eligibility HTTP checks against the curated seed."""

from typing import Any

from bidlab.schemas import generated as g
from bidlab.services import companies as companies_service
from fastapi.testclient import TestClient

HEADERS = {"X-BidLab-Client": "local-ui"}
TENDER = "tias"
SCOPE = "tias-whole"


def _write(**over: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "name": "Pyme API",
        "synthetic": True,
        "scope_id": SCOPE,
        "period_months": 24,
        "direct_cost_net": "80000.00",
        "overhead_net": "10000.00",
        "target_margin_rate": "0.1000",
        "evidence": [],
    }
    data.update(over)
    return data


def _evidence(
    field: str, value: str, reference: str = "attestation-api", reviewed: bool = True
) -> dict[str, Any]:
    return {
        "field_key": field,
        "value": value,
        "unit": "EUR",
        "period_from": None,
        "period_to": None,
        "source_type": "user_attestation",
        "reference": reference,
        "reviewed": reviewed,
    }


def _item(result: dict[str, Any], requirement_id: str) -> dict[str, Any]:
    for entry in result["items"]:
        assert isinstance(entry, dict)
        if entry["requirement_id"] == requirement_id:
            return entry
    raise AssertionError(f"missing item {requirement_id}")


def test_company_crud_roundtrip(seeded_client: TestClient) -> None:
    created = seeded_client.post("/api/v1/companies", json=_write(), headers=HEADERS)
    assert created.status_code == 201, created.text
    company = g.Company.model_validate(created.json())
    assert company.revision == 1
    assert company.direct_cost_net is not None and company.direct_cost_net.root == "80000.00"

    fetched = seeded_client.get(f"/api/v1/companies/{company.id.root}")
    assert fetched.status_code == 200
    assert fetched.json() == created.json()

    update_body = _write(name="Pyme API 2")
    update_body["expected_revision"] = 1
    updated = seeded_client.put(
        f"/api/v1/companies/{company.id.root}", json=update_body, headers=HEADERS
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["revision"] == 2
    assert updated.json()["name"] == "Pyme API 2"


def test_company_guards_and_errors(seeded_client: TestClient) -> None:
    forbidden = seeded_client.post("/api/v1/companies", json=_write())
    assert forbidden.status_code == 403
    assert forbidden.json()["code"] == "forbidden"

    missing = seeded_client.get("/api/v1/companies/no-such-company")
    assert missing.status_code == 404
    assert missing.json()["code"] == "company_not_found"
    assert missing.json()["request_id"]

    created = seeded_client.post("/api/v1/companies", json=_write(), headers=HEADERS)
    company_id = str(created.json()["id"])
    stale_body = _write()
    stale_body["expected_revision"] = 99
    stale = seeded_client.put(f"/api/v1/companies/{company_id}", json=stale_body, headers=HEADERS)
    assert stale.status_code == 409
    assert stale.json()["code"] == "stale_revision"

    bad_scope = seeded_client.post(
        "/api/v1/companies", json=_write(scope_id="nope"), headers=HEADERS
    )
    assert bad_scope.status_code == 404
    assert bad_scope.json()["code"] == "scope_not_found"


def test_eligibility_demo_company_all_unknown(seeded_client: TestClient) -> None:
    # Seeded company-demo carries no evidence: every leaf stays unknown.
    res = seeded_client.post(
        "/api/v1/eligibility/check",
        json={
            "tender_id": TENDER,
            "scope_id": SCOPE,
            "company_id": companies_service.DEMO_COMPANY_ID,
            "company_revision": 1,
            "interpretation_revision": 1,
        },
        headers=HEADERS,
    )
    assert res.status_code == 200, res.text
    result = g.EligibilityResult.model_validate(res.json()).model_dump(mode="json")
    assert result["verdict"] == "unknown"
    assert result["hypothetical_company"] is True
    assert (result["assessed_count"], result["unassessed_count"]) == (0, 5)
    assert {i["requirement_id"] for i in result["items"]} == {
        "req-econ-turnover",
        "req-econ-insurance",
        "req-econ-networth",
        "req-tech-amount",
        "req-tech-similarity",
    }
    assert all(i["verdict"] == "unknown" for i in result["items"])
    assert _item(result, "req-econ-networth")["reason_codes"] == ["manual_review_required"]


def test_eligibility_partial_evidence(seeded_client: TestClient) -> None:
    created = seeded_client.post(
        "/api/v1/companies",
        json=_write(
            evidence=[_evidence("annual_turnover_best_3y_net", "300000.00", "cuentas-2024")]
        ),
        headers=HEADERS,
    )
    company_id = str(created.json()["id"])
    res = seeded_client.post(
        "/api/v1/eligibility/check",
        json={
            "tender_id": TENDER,
            "scope_id": SCOPE,
            "company_id": company_id,
            "company_revision": 1,
            "interpretation_revision": 1,
        },
        headers=HEADERS,
    )
    assert res.status_code == 200, res.text
    result = g.EligibilityResult.model_validate(res.json()).model_dump(mode="json")
    # OR(met, unknown, unknown) = met; AND(met, unknown) stays unknown.
    assert result["verdict"] == "unknown"
    assert (result["assessed_count"], result["unassessed_count"]) == (1, 4)
    turnover = _item(result, "req-econ-turnover")
    assert turnover["verdict"] == "met"
    assert turnover["evidence_refs"] == ["cuentas-2024"]


def test_eligibility_fail_propagates_through_and(seeded_client: TestClient) -> None:
    created = seeded_client.post(
        "/api/v1/companies",
        json=_write(
            evidence=[
                _evidence("annual_turnover_best_3y_net", "100000.00", "cuentas-2024"),
                _evidence("annual_similar_services_best_3y_net", "50000.00", "cert-tech"),
            ]
        ),
        headers=HEADERS,
    )
    company_id = str(created.json()["id"])
    res = seeded_client.post(
        "/api/v1/eligibility/check",
        json={
            "tender_id": TENDER,
            "scope_id": SCOPE,
            "company_id": company_id,
            "company_revision": 1,
            "interpretation_revision": 1,
        },
        headers=HEADERS,
    )
    assert res.status_code == 200, res.text
    result = g.EligibilityResult.model_validate(res.json()).model_dump(mode="json")
    # AND(not_met, unknown) in req-tech fails the whole AND root.
    assert result["verdict"] == "not_met"
    assert (result["assessed_count"], result["unassessed_count"]) == (2, 3)
    assert _item(result, "req-tech-amount")["reason_codes"] == ["value_below_threshold"]
    assert _item(result, "req-econ-turnover")["verdict"] == "not_met"


def test_eligibility_errors(seeded_client: TestClient) -> None:
    body = {
        "tender_id": TENDER,
        "scope_id": SCOPE,
        "company_id": companies_service.DEMO_COMPANY_ID,
        "company_revision": 1,
        "interpretation_revision": 1,
    }
    forbidden = seeded_client.post("/api/v1/eligibility/check", json=body)
    assert forbidden.status_code == 403

    missing = seeded_client.post(
        "/api/v1/eligibility/check",
        json={**body, "company_id": "no-such-company"},
        headers=HEADERS,
    )
    assert missing.status_code == 404
    assert missing.json()["code"] == "company_not_found"

    bad = seeded_client.post(
        "/api/v1/eligibility/check",
        json={**body, "company_id": "not valid!"},
        headers=HEADERS,
    )
    assert bad.status_code == 422
    assert bad.json()["code"] == "validation_error"
