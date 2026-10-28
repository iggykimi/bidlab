"""PKG-T20: the Workspace response carries the labeled consistency report."""

from bidlab.schemas import generated as g
from fastapi.testclient import TestClient


def test_workspace_carries_consistency_report(seeded_client: TestClient) -> None:
    res = seeded_client.get("/api/v1/tenders/tias/workspace")
    assert res.status_code == 200
    workspace = g.Workspace.model_validate(res.json())
    plain = workspace.model_dump(mode="json")
    report = plain["consistency"]
    # No persisted observations yet: real items are honestly empty.
    assert report["items"] == []
    example = report["synthetic_example"]
    assert example["synthetic"] is True
    assert example["field"] == "period_months"
    assert example["evidence_a"]["value"] == "24"
    assert example["evidence_b"]["value"] == "12"
    assert "?" in example["question"]
    assert example["same_document"] is False


def test_review_roundtrip_keeps_consistency(seeded_client: TestClient) -> None:
    payload = {
        "expected_revision": 1,
        "approved_claim_keys": [],
        "requirement_trees": [],
        "scope_basis": None,
        "pricing_rule": None,
        "corrected_proposal": None,
        "actor": "usuario",
        "reason": "Reviso el radar sin cambios.",
    }
    res = seeded_client.post(
        "/api/v1/tenders/tias/reviews",
        json=payload,
        headers={"X-BidLab-Client": "local-ui"},
    )
    assert res.status_code == 200, res.text
    workspace = g.Workspace.model_validate(res.json())
    plain = workspace.model_dump(mode="json")
    assert plain["consistency"]["synthetic_example"]["synthetic"] is True
