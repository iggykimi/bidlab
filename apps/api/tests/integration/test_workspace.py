"""I02: Tías workspace — Money strings, schema-valid, p.6 citation, p.10/20 rules."""

from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_workspace_shape(seeded_client: TestClient) -> None:
    res = seeded_client.get("/api/v1/tenders/tias/workspace")
    assert res.status_code == 200
    assert res.headers.get("X-Request-ID")
    body = res.json()
    workspace = g.Workspace.model_validate(body)
    plain = workspace.model_dump(mode="json")
    assert plain["tender"]["pbl_net"] == "118336.00"
    assert plain["tender"]["pbl_gross"] == "126619.52"
    assert plain["tender"]["estimated_value"] == "295840.00"
    assert plain["interpretation_revision"] == 1
    assert plain["mode"] == "demo"
    page6 = [c for c in plain["citations"] if c["page_number"] == 6]
    assert page6, "expected p.6 citations"
    assert any("207.088" in c["verbatim_excerpt"] for c in page6)
    assert plain["pricing_rules"], "expected at least one pricing rule"
    rule = plain["pricing_rules"][0]
    assert rule["max_points"] == "49"
    assert rule["template_id"] == "proportional_inverse"
    assert rule["anomaly_policy"]["variant"] == "tias_18_5"
    assert plain["requirements"], "expected requirements tree"
    assert plain["requirements"][0]["operator"] == "AND"


def test_tender_detail_and_list(seeded_client: TestClient) -> None:
    res = seeded_client.get("/api/v1/tenders/tias")
    assert res.status_code == 200
    tender = g.Tender.model_validate(res.json())
    assert tender.external_id == "2026/00006554N"
    assert len(tender.scopes) == 1
    res = seeded_client.get("/api/v1/tenders", params={"q": "Tías"})
    assert res.status_code == 200
    listing = g.TenderList.model_validate(res.json())
    assert listing.total == 1
    res = seeded_client.get("/api/v1/tenders", params={"cpv": "79411000"})
    assert g.TenderList.model_validate(res.json()).total == 1
    res = seeded_client.get("/api/v1/tenders", params={"q": "inexistente-zzz"})
    assert g.TenderList.model_validate(res.json()).total == 0


def test_unknown_tender_404_envelope(seeded_client: TestClient) -> None:
    res = seeded_client.get("/api/v1/tenders/nope/workspace")
    assert res.status_code == 404
    body = res.json()
    assert body["code"] == "tender_not_found"
    assert body["request_id"]
    assert isinstance(body["details"], list)


def test_document_page_and_missing_bytes(seeded_client: TestClient) -> None:
    res = seeded_client.get("/api/v1/documents/doc-tias-pcap/pages/6")
    assert res.status_code == 200
    page = g.PageText.model_validate(res.json())
    assert page.page_number == 6
    assert "207.088" in page.raw_text
    res = seeded_client.get("/api/v1/documents/doc-tias-pcap/content")
    assert res.status_code == 404
    assert res.json()["code"] == "document_bytes_unavailable"
    res = seeded_client.get("/api/v1/documents/doc-tias-pcap/pages/7")
    assert res.status_code == 404


def test_document_content_jail(seeded_client: TestClient) -> None:
    """S3: escapes, absolute paths and missing files answer the same 404."""
    storage = get_settings().storage_path
    outside = storage.parent / "outside-jail.pdf"
    outside.write_bytes(b"%PDF-outside")
    try:
        cases = [
            "../" * 10 + "escape.pdf",
            str(outside),  # absolute, exists, but outside storage
            "blobs/missing.pdf",  # inside storage but absent
        ]
        with Session(get_engine()) as session:
            doc = session.get(models.Document, "doc-tias-pcap")
            assert doc is not None
            for blob_path in cases:
                doc.blob_path = blob_path
                session.commit()
                res = seeded_client.get("/api/v1/documents/doc-tias-pcap/content")
                assert res.status_code == 404, blob_path
                assert res.json()["code"] == "document_bytes_unavailable", blob_path
            served = storage / "blobs" / "inside.pdf"
            served.parent.mkdir(parents=True, exist_ok=True)
            served.write_bytes(b"%PDF-inside")
            doc.blob_path = "blobs/inside.pdf"
            session.commit()
            ok = seeded_client.get("/api/v1/documents/doc-tias-pcap/content")
            assert ok.status_code == 200
            assert ok.headers["content-type"] == "application/pdf"
            assert ok.content == b"%PDF-inside"
    finally:
        outside.unlink(missing_ok=True)
