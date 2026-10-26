"""T18: semantic review — approve/correct proposals with audit."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from bidlab.api import deps
from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.main import app
from bidlab.schemas import generated as g
from bidlab.services import seed as seed_service
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

client = TestClient(app)
CLIENT_HEADERS = {"X-BidLab-Client": "local-ui"}


@pytest.fixture()
def demo_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_engine.cache_clear()
    seed_service.seed()

    def override_db() -> Iterator[Session]:
        session = Session(get_engine())
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[deps.get_db] = override_db
    try:
        yield client
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()
        get_engine.cache_clear()


def _review_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "expected_revision": 1,
        "approved_claim_keys": [],
        "requirement_trees": [],
        "scope_basis": None,
        "pricing_rule": None,
        "corrected_proposal": None,
        "actor": "reviewer-test",
        "reason": "checked against PCAP excerpts",
    }
    body.update(overrides)
    return body


def _claim_keys(demo_client: TestClient) -> list[str]:
    res = demo_client.get("/api/v1/tenders/tias/workspace")
    assert res.status_code == 200
    return [claim["key"] for claim in res.json()["claims"]]


def _current_revision() -> int:
    with Session(get_engine()) as session:
        return int(
            session.scalar(
                select(func.max(models.InterpretationRevision.revision)).where(
                    models.InterpretationRevision.tender_id == "tias"
                )
            )
            or 0
        )


def test_approve_claims_creates_manual_revision(demo_client: TestClient) -> None:
    keys = _claim_keys(demo_client)
    assert len(keys) >= 2
    res = demo_client.post(
        "/api/v1/tenders/tias/reviews",
        json=_review_body(approved_claim_keys=keys[:2]),
        headers=CLIENT_HEADERS,
    )
    assert res.status_code == 200
    workspace = g.Workspace.model_validate(res.json())
    assert workspace.interpretation_revision == 2
    with Session(get_engine()) as session:
        revision = session.get(models.InterpretationRevision, ("tias", 2))
        assert revision is not None
        assert revision.mode == "manual"
        assert revision.actor == "reviewer-test"
        reviewed = revision.reviewed_json
        assert isinstance(reviewed, dict)
        assert reviewed["approved_claim_keys"] == keys[:2]
        audit = session.get(models.AuditEvent, "audit-tias-interp-2")
        assert audit is not None
        assert audit.entity_type == "interpretation"


def test_unknown_claim_key_rejected(demo_client: TestClient) -> None:
    res = demo_client.post(
        "/api/v1/tenders/tias/reviews",
        json=_review_body(approved_claim_keys=["no-such-claim"]),
        headers=CLIENT_HEADERS,
    )
    assert res.status_code == 422
    assert res.json()["code"] == "unknown_claim_key"


def test_revision_conflict(demo_client: TestClient) -> None:
    res = demo_client.post(
        "/api/v1/tenders/tias/reviews",
        json=_review_body(expected_revision=0),
        headers=CLIENT_HEADERS,
    )
    assert res.status_code == 409
    assert res.json()["code"] == "revision_conflict"


def test_unknown_tender_and_missing_header(demo_client: TestClient) -> None:
    res = demo_client.post(
        "/api/v1/tenders/nope/reviews",
        json=_review_body(),
        headers=CLIENT_HEADERS,
    )
    assert res.status_code == 404
    res = demo_client.post("/api/v1/tenders/tias/reviews", json=_review_body())
    assert res.status_code == 403


def _corrected_with_real_quote() -> dict[str, Any]:
    with Session(get_engine()) as session:
        existing = session.scalars(
            select(models.Citation)
            .where(models.Citation.document_id == "doc-tias-pcap")
            .order_by(models.Citation.page_number)
        ).first()
        assert existing is not None
        doc_id, page, quote = (
            existing.document_id,
            existing.page_number,
            existing.quote,
        )
    return {
        "schema_version": "1.0",
        "claims": [
            {
                "key": "pbl_check",
                "raw_value": "118336.00",
                "normalized_value": "118336.00",
                "unit": "EUR",
                "citations": [
                    {
                        "document_id": doc_id,
                        "page_number": page,
                        "verbatim_excerpt": quote,
                    }
                ],
                "confidence": "high",
                "status": "proposed",
                "notes": [],
            }
        ],
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
        "warnings": [],
    }


def test_corrected_proposal_citation_located(demo_client: TestClient) -> None:
    corrected = _corrected_with_real_quote()
    res = demo_client.post(
        "/api/v1/tenders/tias/reviews",
        json=_review_body(
            corrected_proposal=corrected, approved_claim_keys=["pbl_check"]
        ),
        headers=CLIENT_HEADERS,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["interpretation_revision"] == 2
    assert [c["key"] for c in body["claims"]] == ["pbl_check"]
    with Session(get_engine()) as session:
        stored = session.get(models.Citation, "cit-tias-r2-000")
        assert stored is not None
        assert stored.match_status == "exact"
        assert stored.quote == corrected["claims"][0]["citations"][0][
            "verbatim_excerpt"
        ]


def _tree() -> dict[str, Any]:
    return {
        "kind": "group",
        "id": "req-root",
        "label": "root",
        "operator": "AND",
        "children": [
            {
                "kind": "leaf",
                "id": "req-turnover",
                "label": "turnover",
                "company_field": "annual_turnover_best_3y_net",
                "operator": "gte",
                "threshold": "100000.00",
                "unit": None,
                "review_status": "pending",
                "evidence_ids": [],
            }
        ],
    }


def test_tree_stored_and_idempotency_optional(demo_client: TestClient) -> None:
    keys = _claim_keys(demo_client)
    payload = _review_body(approved_claim_keys=keys[:1], requirement_trees=[_tree()])
    headers = {**CLIENT_HEADERS, "Idempotency-Key": "r1"}
    first = demo_client.post("/api/v1/tenders/tias/reviews", json=payload, headers=headers)
    assert first.status_code == 200
    assert first.json()["requirements"][0]["operator"] == "AND"
    replay = demo_client.post(
        "/api/v1/tenders/tias/reviews", json=payload, headers=headers
    )
    assert replay.status_code == 200
    assert _current_revision() == 2
    without_key = demo_client.post(
        "/api/v1/tenders/tias/reviews",
        json=_review_body(
            expected_revision=2,
            approved_claim_keys=keys[:1],
            requirement_trees=[_tree()],
        ),
        headers=CLIENT_HEADERS,
    )
    assert without_key.status_code == 200
    assert _current_revision() == 3


def test_scope_basis_recorded(demo_client: TestClient) -> None:
    keys = _claim_keys(demo_client)
    basis: dict[str, Any] = {
        "scope_id": "tias-whole",
        "budget_net": "118336.00",
        "ceiling_net": None,
        "scoring_reference_net": "118336.00",
        "reference_kind": "pbl",
        "currency": "EUR",
        "unit": "lump_sum",
        "period_months": 24,
        "tax_kind": "IGIC",
        "review_status": "approved",
        "evidence_ids": [],
        "metadata_evidence": [],
    }
    res = demo_client.post(
        "/api/v1/tenders/tias/reviews",
        json=_review_body(approved_claim_keys=keys[:1], scope_basis=basis),
        headers=CLIENT_HEADERS,
    )
    assert res.status_code == 200
    with Session(get_engine()) as session:
        revision = session.get(models.InterpretationRevision, ("tias", 2))
        assert revision is not None
        reviewed = revision.reviewed_json
        assert isinstance(reviewed, dict)
        stored_basis = reviewed["scope_basis"]
        assert isinstance(stored_basis, dict)
        assert stored_basis["scope_id"] == "tias-whole"
