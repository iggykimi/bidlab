"""Own-tender intake: creation + local PDF upload over HTTP."""

from bidlab.schemas import generated as g
from bidlab.services import pdf as pdf_service
from fastapi.testclient import TestClient
from httpx import Response

HEADERS = {"X-BidLab-Client": "local-ui"}


def _headers(key: str) -> dict[str, str]:
    return {**HEADERS, "Idempotency-Key": key}


def _create_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "title": "Servicio de limpieza (expediente propio)",
        "external_id": "2026/00009999X",
        "contracting_body": "Ayuntamiento de Ejemplo",
        "source_url": None,
        "scope_label": None,
        "basis": {
            "pbl_net": "118336.00",
            "pbl_gross": None,
            "tax_kind": "IGIC",
            "period_months": 24,
            "currency": "EUR",
        },
    }
    body.update(overrides)
    return body


def _create(client: TestClient, key: str, **overrides: object) -> dict:
    res = client.post("/api/v1/tenders", json=_create_body(**overrides), headers=_headers(key))
    assert res.status_code == 201, res.text
    return res.json()


def _page_stream(text: str) -> bytes:
    return f"BT /F1 12 Tf 10 180 Td ({text}) Tj ET".encode("latin-1")


def _two_page_pdf(
    first: str = "Precio neto: 118336.00 euros", second: str = "Plazo: 24 meses"
) -> bytes:
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


def _upload_res(
    client: TestClient,
    tender_id: str,
    key: str,
    pdf_bytes: bytes,
    filename: str = "pliego.pdf",
    kind: str | None = None,
) -> Response:
    data = {} if kind is None else {"kind": kind}
    return client.post(
        f"/api/v1/tenders/{tender_id}/documents",
        files={"file": (filename, pdf_bytes, "application/pdf")},
        data=data,
        headers=_headers(key),
    )


def test_create_tender_happy_path(fresh_client: TestClient) -> None:
    created = _create(fresh_client, "intake-happy")
    tender = g.Tender.model_validate(created)
    assert tender.title == "Servicio de limpieza (expediente propio)"
    assert tender.external_id == "2026/00009999X"
    assert tender.contracting_body == "Ayuntamiento de Ejemplo"
    assert tender.pbl_net is not None and tender.pbl_net.root == "118336.00"
    assert tender.pbl_gross is None
    (scope,) = tender.scopes
    assert scope.tender_id.root == tender.id.root
    assert scope.basis.budget_net is not None and scope.basis.budget_net.root == "118336.00"
    assert scope.basis.tax_kind == "IGIC"
    assert scope.basis.period_months is not None and scope.basis.period_months.root == 24
    assert scope.basis.review_status == "pending"
    assert scope.basis.currency == "EUR"

    fetched = fresh_client.get(f"/api/v1/tenders/{tender.id.root}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == tender.id.root


def test_create_tender_minimal_no_basis(fresh_client: TestClient) -> None:
    body = _create_body(basis=None)
    res = fresh_client.post("/api/v1/tenders", json=body, headers=_headers("intake-min"))
    assert res.status_code == 201, res.text
    tender = g.Tender.model_validate(res.json())
    assert tender.pbl_net is None
    assert tender.pbl_gross is None
    (scope,) = tender.scopes
    assert scope.basis.budget_net is None
    assert scope.basis.tax_kind == "unknown"
    assert scope.basis.period_months is None


def test_create_tender_scope_label_and_source_url(fresh_client: TestClient) -> None:
    created = _create(
        fresh_client,
        "intake-label",
        source_url="https://contratacion.example/exp/99",
        scope_label="Lote 1",
    )
    tender = g.Tender.model_validate(created)
    assert tender.source_url == "https://contratacion.example/exp/99"
    (scope,) = tender.scopes
    assert scope.label == "Lote 1"


def test_create_tender_tax_non_inference(fresh_client: TestClient) -> None:
    net_only = _create(fresh_client, "intake-net")
    assert net_only["pbl_gross"] is None
    assert net_only["scopes"][0]["basis"]["ceiling_net"] is None
    assert net_only["scopes"][0]["basis"]["scoring_reference_net"] is None

    gross_body = _create_body(
        basis={
            "pbl_net": None,
            "pbl_gross": "126619.52",
            "tax_kind": "IGIC",
            "period_months": None,
            "currency": "EUR",
        }
    )
    res = fresh_client.post("/api/v1/tenders", json=gross_body, headers=_headers("intake-gross"))
    assert res.status_code == 201, res.text
    gross_only = res.json()
    assert gross_only["pbl_net"] is None
    assert gross_only["pbl_gross"] == "126619.52"
    assert gross_only["scopes"][0]["basis"]["budget_net"] is None
    assert gross_only["scopes"][0]["basis"]["reference_kind"] == "unknown"


def test_create_tender_money_failures_keep_no_tender(fresh_client: TestClient) -> None:
    before = fresh_client.get("/api/v1/tenders").json()["total"]
    bad_values: list[object] = ["1.000,00", "abc", "-5.00", "9999999999999.99", 118336.00, 118336]
    for index, bad in enumerate(bad_values):
        body = _create_body(
            basis={
                "pbl_net": bad,
                "pbl_gross": None,
                "tax_kind": "IGIC",
                "period_months": 24,
                "currency": "EUR",
            }
        )
        res = fresh_client.post(
            "/api/v1/tenders", json=body, headers=_headers(f"intake-bad-{index}")
        )
        assert res.status_code == 422, (bad, res.text)
        assert res.json()["code"] in ("money_unparseable", "validation_error"), bad
    after = fresh_client.get("/api/v1/tenders").json()["total"]
    assert after == before


def test_create_tender_required_fields(fresh_client: TestClient) -> None:
    for field in ("title", "external_id", "contracting_body"):
        body = _create_body(**{field: "   "})
        res = fresh_client.post("/api/v1/tenders", json=body, headers=_headers(f"blank-{field}"))
        assert res.status_code == 422, field
        assert res.json()["code"] == "validation_error"

    body = _create_body(title="x" * 2001)
    res = fresh_client.post("/api/v1/tenders", json=body, headers=_headers("too-long"))
    assert res.status_code == 422
    assert res.json()["code"] == "validation_error"

    missing = _create_body()
    del missing["title"]
    res = fresh_client.post("/api/v1/tenders", json=missing, headers=_headers("missing"))
    assert res.status_code == 422
    assert res.json()["code"] == "validation_error"


def test_create_tender_idempotent_retry(fresh_client: TestClient) -> None:
    first = fresh_client.post(
        "/api/v1/tenders", json=_create_body(), headers=_headers("intake-retry")
    )
    assert first.status_code == 201, first.text
    second = fresh_client.post(
        "/api/v1/tenders", json=_create_body(), headers=_headers("intake-retry")
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert fresh_client.get("/api/v1/tenders").json()["total"] == 1

    other = _create_body(title="Otro titulo")
    conflict = fresh_client.post("/api/v1/tenders", json=other, headers=_headers("intake-retry"))
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"


def test_create_tender_guards(fresh_client: TestClient) -> None:
    no_key = fresh_client.post("/api/v1/tenders", json=_create_body(), headers=HEADERS)
    assert no_key.status_code == 422
    assert no_key.json()["code"] == "validation_error"
    no_client = fresh_client.post(
        "/api/v1/tenders", json=_create_body(), headers={"Idempotency-Key": "k"}
    )
    assert no_client.status_code == 403
    assert no_client.json()["code"] == "forbidden"


def test_upload_happy_path(fresh_client: TestClient) -> None:
    tender_id = str(_create(fresh_client, "up-happy-t")["id"])
    pdf_bytes = _two_page_pdf()
    res = _upload_res(fresh_client, tender_id, "up-happy", pdf_bytes, kind="pcap")
    assert res.status_code == 201, res.text
    doc = g.Document.model_validate(res.json())
    assert doc.tender_id.root == tender_id
    assert doc.kind == "pcap"
    assert doc.display_name == "pliego.pdf"
    assert doc.pages_count == 2
    assert doc.parse_status == "ready"
    assert doc.rights_status == "unknown"
    assert doc.source_url is None

    content = fresh_client.get(f"/api/v1/documents/{doc.id.root}/content")
    assert content.status_code == 200
    assert content.content == pdf_bytes

    page = fresh_client.get(f"/api/v1/documents/{doc.id.root}/pages/1")
    assert page.status_code == 200
    assert "118336.00" in page.json()["raw_text"]

    workspace = fresh_client.get(f"/api/v1/tenders/{tender_id}/workspace")
    assert workspace.status_code == 200
    assert [d["id"] for d in workspace.json()["documents"]] == [doc.id.root]


def test_upload_kind_defaults_to_other(fresh_client: TestClient) -> None:
    tender_id = str(_create(fresh_client, "up-kind-t")["id"])
    res = _upload_res(fresh_client, tender_id, "up-kind", _two_page_pdf())
    assert res.status_code == 201, res.text
    assert res.json()["kind"] == "other"

    bad_kind = fresh_client.post(
        f"/api/v1/tenders/{tender_id}/documents",
        files={"file": ("pliego.pdf", _two_page_pdf("otro", "texto"), "application/pdf")},
        data={"kind": "contrato"},
        headers=_headers("up-kind-bad"),
    )
    assert bad_kind.status_code == 422


def test_upload_rejects_non_pdf_by_magic_bytes(fresh_client: TestClient) -> None:
    tender_id = str(_create(fresh_client, "up-magic-t")["id"])
    res = _upload_res(fresh_client, tender_id, "up-magic", b"just text, not a pdf", "pliego.pdf")
    assert res.status_code == 415, res.text
    assert res.json()["code"] == "upload_not_pdf"
    assert fresh_client.get(f"/api/v1/tenders/{tender_id}").status_code == 200


def test_upload_rejects_corrupt_pdf(fresh_client: TestClient) -> None:
    tender_id = str(_create(fresh_client, "up-corrupt-t")["id"])
    corrupt = b"%PDF-1.4\n%this is not a real pdf body at all, just garbage bytes"
    res = _upload_res(fresh_client, tender_id, "up-corrupt", corrupt)
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "pdf_unreadable"
    assert fresh_client.get(f"/api/v1/tenders/{tender_id}").status_code == 200


def test_upload_rejects_oversize(fresh_client: TestClient) -> None:
    tender_id = str(_create(fresh_client, "up-big-t")["id"])
    big = b"%PDF-1.4\n" + b"x" * pdf_service.MAX_PDF_BYTES
    res = _upload_res(fresh_client, tender_id, "up-big", big)
    assert res.status_code == 413, res.text[:200]
    assert res.json()["code"] == "pdf_too_large"
    assert fresh_client.get(f"/api/v1/tenders/{tender_id}").status_code == 200


def test_upload_unknown_tender_404(fresh_client: TestClient) -> None:
    res = _upload_res(fresh_client, "no-such-tender", "up-404", _two_page_pdf())
    assert res.status_code == 404
    assert res.json()["code"] == "tender_not_found"


def test_upload_idempotent_retry_and_duplicate(fresh_client: TestClient) -> None:
    tender_id = str(_create(fresh_client, "up-idem-t")["id"])
    pdf_bytes = _two_page_pdf()
    first = _upload_res(fresh_client, tender_id, "up-idem", pdf_bytes, kind="pcap")
    assert first.status_code == 201, first.text
    doc_id = first.json()["id"]

    retry = _upload_res(fresh_client, tender_id, "up-idem", pdf_bytes, kind="pcap")
    assert retry.status_code == 200
    assert retry.json()["id"] == doc_id

    other_bytes = _two_page_pdf("diferente", "contenido")
    conflict = _upload_res(fresh_client, tender_id, "up-idem", other_bytes, kind="pcap")
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"

    duplicate = _upload_res(fresh_client, tender_id, "up-idem-new-key", pdf_bytes, kind="pcap")
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "document_duplicate"
