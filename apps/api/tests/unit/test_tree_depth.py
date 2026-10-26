"""S2: requirements-tree walkers share MAX_TREE_DEPTH; deep trees are 422."""

from __future__ import annotations

from typing import Any

import pytest
from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.domain import eligibility as EL
from bidlab.schemas import generated as g
from bidlab.services import eligibility as eligibility_service
from bidlab.services import scenarios as scenarios_service
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


def _chain(depth: int) -> dict[str, Any]:
    """One manual leaf nested under `depth` single-child AND groups."""
    node: dict[str, Any] = {
        "kind": "leaf",
        "id": "bottom",
        "label": "bottom",
        "company_field": "manual",
        "operator": "manual",
        "threshold": None,
        "unit": None,
        "review_status": "approved",
        "evidence_ids": [],
    }
    for level in range(depth):
        node = {
            "kind": "group",
            "id": f"g{level}",
            "label": f"g{level}",
            "operator": "AND",
            "children": [node],
        }
    return node


def _session_with_deep_tree(depth: int) -> Session:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    models.Base.metadata.create_all(engine)
    session = Session(engine)
    session.add(
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
    session.add(
        models.Scope(
            id="s1", tender_id="t1", lot_key="__whole__", basis_json={}, budget_net_cents=100
        )
    )
    session.add(models.Company(id="c1", created_at="2026-01-01T00:00:00Z"))
    session.add(
        models.CompanyRevision(
            company_id="c1",
            revision=1,
            scope_id="s1",
            direct_cost_cents=None,
            overhead_cents=None,
            profile_json={"synthetic": True, "evidence": []},
            created_at="2026-01-01T00:00:00Z",
        )
    )
    session.add(
        models.InterpretationRevision(
            tender_id="t1",
            revision=1,
            mode="manual",
            proposal_json={},
            reviewed_json={"requirements_tree": _chain(depth)},
            document_hashes_json={},
            actor="test",
            reason="deep tree fixture",
            created_at="2026-01-01T00:00:00Z",
        )
    )
    session.commit()
    return session


def test_walkers_share_one_bound() -> None:
    assert scenarios_service.MAX_TREE_DEPTH is EL.MAX_TREE_DEPTH
    assert EL.MAX_TREE_DEPTH < 500


def test_manual_leaves_rejects_500_deep_tree() -> None:
    with pytest.raises(ApiError) as exc:
        scenarios_service._manual_leaves(_chain(500), [])
    assert exc.value.status_code == 422
    assert exc.value.code == "requirements_tree_too_deep"


def test_build_tree_rejects_500_deep_tree() -> None:
    with pytest.raises(ApiError) as exc:
        eligibility_service._build_tree(_chain(500), [], [])
    assert exc.value.status_code == 422
    assert exc.value.code == "requirements_tree_too_deep"


def test_check_rejects_deep_stored_tree() -> None:
    session = _session_with_deep_tree(500)
    try:
        req = g.EligibilityRequest.model_validate(
            {
                "tender_id": "t1",
                "scope_id": "s1",
                "company_id": "c1",
                "company_revision": 1,
                "interpretation_revision": 1,
            }
        )
        with pytest.raises(ApiError) as exc:
            eligibility_service.check(session, req)
    finally:
        session.close()
    assert exc.value.status_code == 422
    assert exc.value.code == "requirements_tree_too_deep"


def test_depth_at_bound_still_walks() -> None:
    out: list[str] = []
    scenarios_service._manual_leaves(_chain(EL.MAX_TREE_DEPTH), out)
    assert out == ["Pendiente de revisión manual: bottom"]
    items: list[dict[str, Any]] = []
    eligibility_service._build_tree(_chain(EL.MAX_TREE_DEPTH), [], items)
    assert [item["verdict"] for item in items] == ["unknown"]
