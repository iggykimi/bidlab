"""Page image delivery: exact rendered PNG by document + page (T15)."""

import hashlib

from bidlab.services import render as render_service
from bidlab.settings import get_settings
from fastapi.testclient import TestClient

HEADERS = {"X-BidLab-Client": "local-ui"}


def _headers(key: str) -> dict[str, str]:
    return {**HEADERS, "Idempotency-Key": key}


def _create(client: TestClient, key: str) -> str:
    res = client.post(
        "/api/v1/tenders",
        json={
            "title": "Servicio de limpieza (expediente propio)",
            "external_id": "2026/00009999X",
            "contracting_body": "Ayuntamiento de Ejemplo",
            "source_url": None,
            "scope_label": None,
            "basis": None,
        },
        headers=_headers(key),
    )
    assert res.status_code == 201, res.text
    return str(res.json()["id"])


def _page_stream(text: str) -> bytes:
    return f"BT /F1 12 Tf 10 180 Td ({text}) Tj ET".encode("latin-1")


def _two_page_pdf(first: str = "Precio neto: 118336.00 euros", second: str = "Plazo: 24 meses") -> bytes:
    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>")
    page_tpl = (
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] "
        "/Resources << /Font << /F1 5 0 R >> >> /Contents {} 0 R >>"
    )
    objects.append(page_tpl.format(6).encode("ascii"))
    objects.append(page_tpl.format(7).encode("ascii"))
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for text in (first, second):
        stream = _page_stream(text)
        length = str(len(stream)).encode("ascii")
        objects.append(b"<< /Length " + length + b" >>\nstream\n" + stream + b"\nendstream")
    out = bytearray(b"%PDF-1.4\n")
    for number, body in enumerate(objects, start=1):
        out += str(number).encode("ascii") + b" 0 obj\n" + body + b"\nendobj\n"
    out += b"trailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    return bytes(out)


def _upload(client: TestClient, tender_id: str, key: str, pdf_bytes: bytes) -> str:
    res = client.post(
        f"/api/v1/tenders/{tender_id}/documents",
        files={"file": ("pliego.pdf", pdf_bytes, "application/pdf")},
        headers=_headers(key),
    )
    assert res.status_code == 201, res.text
    return str(res.json()["id"])


def test_page_image_serves_rendered_png(fresh_client: TestClient) -> None:
    tender_id = _create(fresh_client, "img-tender")
    doc_id = _upload(fresh_client, tender_id, "img-upload", _two_page_pdf())
    res = fresh_client.get(f"/api/v1/documents/{doc_id}/pages/1/image")
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "image/png"
    assert res.content[:8] == b"\x89PNG\r\n\x1a\n"
    storage = get_settings().storage_path.resolve()
    manifest = render_service.load_render_manifest(storage, tender_id, doc_id)
    assert manifest is not None and manifest["status"] == "ready"
    pages = manifest["pages"]
    assert isinstance(pages, list)
    (entry,) = [e for e in pages if isinstance(e, dict) and e.get("physical_page") == 1]
    assert hashlib.sha256(res.content).hexdigest() == entry["image_sha256"]
    assert res.headers["etag"] == f'"{entry["image_sha256"]}"'


def test_page_image_second_page_differs(fresh_client: TestClient) -> None:
    tender_id = _create(fresh_client, "img-tender-2")
    doc_id = _upload(fresh_client, tender_id, "img-upload-2", _two_page_pdf())
    first = fresh_client.get(f"/api/v1/documents/{doc_id}/pages/1/image")
    second = fresh_client.get(f"/api/v1/documents/{doc_id}/pages/2/image")
    assert first.status_code == 200 and second.status_code == 200
    assert first.content != second.content


def test_page_image_seed_doc_without_render_is_404(seeded_client: TestClient) -> None:
    res = seeded_client.get("/api/v1/documents/doc-tias-pcap/pages/6/image")
    assert res.status_code == 404
    assert res.json()["code"] == "document_bytes_unavailable"


def test_page_image_unknown_document_is_404(seeded_client: TestClient) -> None:
    res = seeded_client.get("/api/v1/documents/nope/pages/1/image")
    assert res.status_code == 404
    assert res.json()["code"] == "document_not_found"


def test_page_image_unknown_page_is_404(seeded_client: TestClient) -> None:
    res = seeded_client.get("/api/v1/documents/doc-tias-pcap/pages/999/image")
    assert res.status_code == 404
    assert res.json()["code"] == "page_not_found"


def test_page_image_corrupt_png_is_500(fresh_client: TestClient) -> None:
    tender_id = _create(fresh_client, "img-tender-3")
    doc_id = _upload(fresh_client, tender_id, "img-upload-3", _two_page_pdf())
    storage = get_settings().storage_path.resolve()
    target = render_service.render_dir_for(storage, tender_id, doc_id)
    (target / "p001.png").write_bytes(b"not a png anymore")
    res = fresh_client.get(f"/api/v1/documents/{doc_id}/pages/1/image")
    assert res.status_code == 500
    assert res.json()["code"] == "internal"
