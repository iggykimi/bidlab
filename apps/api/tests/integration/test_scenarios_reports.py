"""Scenarios + reports: save/get roundtrip, stale 409, idempotency, HTML sources."""

import json
from pathlib import Path
from typing import Any, cast

import pytest
from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from bidlab.services import reports as reports_service
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[4]
HEADERS = {"X-BidLab-Client": "local-ui", "Idempotency-Key": "scn-1"}


def _input() -> dict[str, Any]:
    raw = (ROOT / "examples" / "evaluation_request.json").read_text(encoding="utf-8")
    payload = json.loads(raw)
    payload["pricing_rule_id"] = "tias-price-r1"
    return cast("dict[str, Any]", payload)


def test_save_get_roundtrip(seeded_client: TestClient) -> None:
    res = seeded_client.post(
        "/api/v1/scenarios", json={"name": "Base 5%", "input": _input()}, headers=HEADERS
    )
    assert res.status_code == 201, res.text
    saved = g.Scenario.model_validate(res.json())
    plain = saved.model_dump(mode="json")
    assert plain["name"] == "Base 5%"
    assert plain["result"]["price_net"] == "112419.20"
    assert plain["context"]["rule"]["id"] == "tias-price-r1"
    assert len(plain["snapshot_sha256"]) == 64
    assert plain["context"]["pending_items"], "expected pending items (manual leaves)"
    assert any("Pendiente de revisión manual" in item for item in plain["context"]["pending_items"])

    fetched = seeded_client.get(f"/api/v1/scenarios/{plain['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == res.json()

    replay = seeded_client.post(
        "/api/v1/scenarios", json={"name": "Base 5%", "input": _input()}, headers=HEADERS
    )
    assert replay.status_code == 200
    assert replay.json()["id"] == plain["id"]


def test_save_rejects_stale_revision(seeded_client: TestClient, tmp_path: Path) -> None:
    session = Session(get_engine())
    try:
        rule = session.get(models.RuleRevision, ("tias-price-r1", 1))
        assert rule is not None
        session.add(
            models.RuleRevision(
                rule_id=rule.rule_id,
                revision=2,
                scope_id=rule.scope_id,
                interpretation_revision=rule.interpretation_revision,
                rule_json=rule.rule_json,
                review_status="approved",
                actor="test",
                reason="newer revision",
                created_at="2026-10-26T00:00:00Z",
            )
        )
        session.commit()
    finally:
        session.close()
    res = seeded_client.post(
        "/api/v1/scenarios",
        json={"name": "stale", "input": _input()},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": "scn-stale"},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "stale_revision"


def test_report_with_html_sources(seeded_client: TestClient) -> None:
    res = seeded_client.post(
        "/api/v1/scenarios", json={"name": "Base 5%", "input": _input()}, headers=HEADERS
    )
    scenario_id = res.json()["id"]
    created = seeded_client.post(
        "/api/v1/reports",
        json={"scenario_id": scenario_id, "decision": "prepare", "note": "Margen OK <b>esc</b>"},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": "rep-1"},
    )
    assert created.status_code == 201, created.text
    report = g.Report.model_validate(created.json()).model_dump(mode="json")
    assert report["decision"] == "prepare"
    assert report["pending_items"] == report["scenario"]["context"]["pending_items"]

    fetched = seeded_client.get(f"/api/v1/reports/{report['id']}")
    assert fetched.status_code == 200

    html = seeded_client.get(f"/api/v1/reports/{report['id']}/html")
    assert html.status_code == 200
    assert html.headers["Content-Security-Policy"] == (
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    )
    assert html.headers["X-Content-Type-Options"] == "nosniff"
    assert "112.419,20" in html.text
    assert report["scenario"]["snapshot_sha256"] in html.text
    assert "207.088" in html.text
    assert "<b>esc</b>" not in html.text  # user note is escaped
    assert "Demo curada" in html.text
    assert "Detalle del cálculo" in html.text
    assert "Instantánea (snapshot)" in html.text
    assert "Traza de cálculo" not in html.text


def test_report_html_path_rejects_malformed_id(seeded_client: TestClient) -> None:
    """C7: non-uuid-hex ids never reach the filesystem (404, no traversal)."""
    for bad_id in ("not-a-uuid", "../escape", "..%2Fescape", "x" * 31, "Z" * 32, ""):
        with pytest.raises(ApiError) as exc:
            reports_service.html_path(bad_id)
        assert exc.value.status_code == 404
        assert exc.value.code == "report_not_found"
    http = seeded_client.get("/api/v1/reports/not-a-uuid/html")
    assert http.status_code == 404
    assert http.json()["code"] == "report_not_found"


def test_pending_items_spanish_copy(seeded_client: TestClient) -> None:
    """Copy A7/A9/A10/A11/A12: pending items read as Spanish action items."""
    incomplete = _input()
    incomplete["rivals"] = {
        "state": "assumed",
        "complete": False,
        "group_membership_confirmed": False,
        "own_group_id": None,
        "offers": [],
    }
    res = seeded_client.post(
        "/api/v1/scenarios", json={"name": "partial", "input": incomplete}, headers=HEADERS
    )
    assert res.status_code == 201, res.text
    pending = g.Scenario.model_validate(res.json()).model_dump(mode="json")["context"][
        "pending_items"
    ]
    assert any("Puntuación sin determinar" in item for item in pending)
    assert any("Anormalidad sin determinar" in item for item in pending)
    assert any("verificado solo por extractos" in item for item in pending)
    assert any("sustituir por el coste real" in item for item in pending)

    flagged = _input()
    flagged["discount_rate"] = "0.2600"
    flagged["rivals"] = {
        "state": "assumed",
        "complete": True,
        "group_membership_confirmed": True,
        "own_group_id": "own",
        "offers": [
            {"label": "R1", "price_net": "88000.00", "group_id": "g1"},
            {"label": "R2", "price_net": "88500.00", "group_id": "g2"},
        ],
    }
    res = seeded_client.post(
        "/api/v1/scenarios",
        json={"name": "flagged", "input": flagged},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": "scn-2"},
    )
    assert res.status_code == 201, res.text
    pending = g.Scenario.model_validate(res.json()).model_dump(mode="json")["context"][
        "pending_items"
    ]
    assert "Posible anormalidad: preparar justificación de costes" in pending


def _unfinished_report(score_status: str) -> dict[str, Any]:
    return {
        "scenario": {
            "name": "N",
            "context": {
                "tender_title": "T",
                "citations": [
                    {
                        "verbatim_excerpt": "q",
                        "document_id": "d",
                        "page_number": 1,
                        "match_status": "missing",
                    }
                ],
            },
            "result": {
                "price_net": "1.00",
                "cost_net": None,
                "profit_net": None,
                "margin_rate": None,
                "score": {"value": None, "status": score_status},
                "anomaly": {"status": "unknown"},
                "trace": [{"label": "L", "expression": "E", "value": None}],
                "assumptions": [],
                "engine_version": "1.0.0",
            },
            "snapshot_sha256": "ab" * 32,
        },
        "decision": "study",
        "note": "n",
        "pending_items": [],
        "created_at": "2026-10-26T00:00:00Z",
    }


@pytest.mark.parametrize(
    ("score_status", "expected"),
    [("unknown", "sin determinar"), ("unsupported", "no soportada")],
)
def test_report_template_translates_statuses(score_status: str, expected: str) -> None:
    """Copy B1/B3/B4: no raw unknown/unsupported/missing leaks into the HTML."""
    html = reports_service.render_html(_unfinished_report(score_status), "demo")
    assert expected in html
    assert "no localizada" in html
    assert "Detalle del cálculo" in html
    assert "Instantánea (snapshot)" in html
    assert "unknown" not in html
    assert "unsupported" not in html
    assert "missing" not in html


def test_report_template_v2_honesty() -> None:
    """BL-V2-15: nulls never render as dashes/zeros, mode always labeled."""
    html = reports_service.render_html(_unfinished_report("unknown"), "manual")
    assert "sin determinar" in html
    assert ">—<" not in html
    assert ">— €" not in html
    assert "Tus datos" in html
    assert "Tu nota de decisión" in html
    assert "ni predice la adjudicación" in html
    live = reports_service.render_html(_unfinished_report("unknown"), "live")
    assert "Análisis en vivo" in live
    demo = reports_service.render_html(_unfinished_report("unknown"), "demo")
    assert "no extracción en vivo" in demo


def _finished_report() -> dict[str, Any]:
    rep = _unfinished_report("defined")
    rep["scenario"]["result"].update(
        {
            "price_net": "100585.60",
            "cost_net": "90000.00",
            "profit_net": "10585.60",
            "margin_rate": "0.10523971622",
            "score": {"value": "49.000000000000", "status": "defined", "max_points": "49"},
            "anomaly": {"status": "not_flagged_under_assumptions"},
        }
    )
    rep["decision"] = "prepare"
    return rep


def test_report_template_paints_plain_spanish() -> None:
    """V6 F2: decision/fechas/cifras/estados en espanol llano, exactos."""
    html = reports_service.render_html(_finished_report(), "demo")
    assert "Preparar oferta" in html
    assert "100.585,60 €" in html
    assert "90.000,00 €" in html
    assert "49,0 de 49" in html
    assert "10,5 %" in html
    assert "Margen sobre ventas" in html
    assert "No, en este supuesto" in html
    assert "26 de octubre de 2026, 00:00 (UTC)" in html
    assert "redondeados a 1 decimal" in html
    assert "prepare" not in html
    assert "100585.60" not in html
    assert "not_flagged_under_assumptions" not in html


def test_report_template_uses_document_names_when_given() -> None:
    html = reports_service.render_html(
        _finished_report(), "demo", doc_names={"d": "Pliego de Tías"}
    )
    assert "Pliego de Tías" in html
    fallback = reports_service.render_html(_finished_report(), "demo")
    assert "Documento d," in fallback


def test_report_html_path_roundtrip(seeded_client: TestClient) -> None:
    res = seeded_client.post(
        "/api/v1/scenarios", json={"name": "Base 5%", "input": _input()}, headers=HEADERS
    )
    created = seeded_client.post(
        "/api/v1/reports",
        json={"scenario_id": res.json()["id"], "decision": "study", "note": "n"},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": "rep-roundtrip"},
    )
    assert created.status_code == 201, created.text
    report_id = str(created.json()["id"])
    assert reports_service.html_path(report_id).exists()
