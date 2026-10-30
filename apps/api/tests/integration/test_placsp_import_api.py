"""PLACSP import over HTTP against the recorded real record (offline transport)."""

import base64
import hashlib
from collections.abc import Callable, Iterator
from pathlib import Path

import fitz
import httpx
import pytest
from bidlab.main import app
from bidlab.services import pdf as pdf_service
from bidlab.services import placsp_import as placsp
from fastapi.testclient import TestClient

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "placsp"
DEEPLINK = (
    "https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion"
    "&idEvl=4mTE7tVTKp4IYE3ZiZ%2BxmQ%3D%3D"
)
PORTAL = "https://contrataciondelestado.es/wps/portal/plataforma/buscadores/detalle/x/"
PUBLISHED_PCAP_SHA1 = b"DKu8jA7vvBSFzySzlkLHr3jrTZ8="

Handler = Callable[[httpx.Request], httpx.Response]


def _tiny_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Presupuesto base de licitacion 118.336,00 euros")
    data: bytes = doc.tobytes()
    doc.close()
    return data


PDF = _tiny_pdf()
XML = (FIXTURES / "call_for_tenders.xml").read_bytes()
# The test PDF stands in for the real PCAP, so its "published" hash is the
# test PDF's own SHA-1; the PPT keeps the real hash and must be refused.
XML_FOR_PDF = XML.replace(
    PUBLISHED_PCAP_SHA1, base64.b64encode(hashlib.sha1(PDF, usedforsecurity=False).digest())
)
HTML = (FIXTURES / "detail.html").read_bytes()
RECORD_URL = placsp.parse_detail_page(HTML).latest_pliego_xml()
DOCS = {d.kind: d.url for d in placsp.parse_call_for_tenders(XML).documents}


def official_source(pdf: bytes = PDF) -> Handler:
    def handle(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url == DEEPLINK:
            return httpx.Response(301, headers={"location": PORTAL})
        if url == PORTAL:
            return httpx.Response(200, headers={"content-type": "text/html"}, content=HTML)
        if url == RECORD_URL:
            return httpx.Response(
                200, headers={"content-type": "application/xml"}, content=XML_FOR_PDF
            )
        if url in (DOCS["pcap"], DOCS["ppt"]):
            return httpx.Response(200, headers={"content-type": "application/pdf"}, content=pdf)
        return httpx.Response(599)  # anything else is a test bug

    return handle


@pytest.fixture()
def source(fresh_client: TestClient) -> Iterator[Callable[[Handler], list[str]]]:
    """Install a handler as the PLACSP transport; returns the requested URLs."""

    def install(handler: Handler) -> list[str]:
        seen: list[str] = []

        def recording(request: httpx.Request) -> httpx.Response:
            seen.append(str(request.url))
            return handler(request)

        app.dependency_overrides[placsp.get_client] = lambda: placsp.PlacspClient(
            transport=httpx.MockTransport(recording), pause_seconds=0
        )
        return seen

    yield install


def _import(client: TestClient, key: str, url: str = DEEPLINK) -> httpx.Response:
    return client.post(
        "/api/v1/tenders/import",
        json={"url_or_id": url},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": key},
    )


def test_import_creates_tender_with_official_provenance(
    fresh_client: TestClient, source: Callable[[Handler], list[str]]
) -> None:
    seen = source(official_source())
    res = _import(fresh_client, "imp-1")
    assert res.status_code == 201, res.text
    body = res.json()
    tender = body["tender"]
    assert body["already_imported"] is False
    assert tender["external_id"] == "2026/00006554N"
    assert tender["contracting_body"] == "Pleno del Ayuntamiento de Tías"
    assert tender["source_url"] == DEEPLINK
    assert (tender["pbl_net"], tender["pbl_gross"], tender["estimated_value"]) == (
        "118336.00",
        "126619.52",
        "295840.00",
    )
    assert tender["deadline_at"] == "2026-11-25T23:59:00+01:00"
    assert tender["cpv_codes"] == ["79411000", "71356200"]
    assert tender["status_raw"] == "Publicada"
    assert tender["raw_snapshot_sha256"] == hashlib.sha256(XML_FOR_PDF).hexdigest()
    basis = tender["scopes"][0]["basis"]
    assert (basis["tax_kind"], basis["period_months"], basis["review_status"]) == (
        "unknown",
        24,
        "pending",
    )

    by_kind = {d["kind"]: d for d in body["documents"]}
    pcap = by_kind["pcap"]
    assert (pcap["status"], pcap["hash_verified"], pcap["size_bytes"]) == (
        "downloaded",
        True,
        len(PDF),
    )
    assert pcap["pages_count"] == 1 and pcap["source_url"] == DOCS["pcap"]
    assert (by_kind["ppt"]["status"], by_kind["ppt"]["reason"]) == (
        "not_downloaded",
        "hash_mismatch",
    )
    assert (by_kind["other"]["reason"], by_kind["other"]["label"]) == (
        "not_requested",
        "ANEXO I.docx",
    )
    # Detail (+1 redirect hop), record XML, PCAP, PPT: nothing else is fetched.
    assert seen == [DEEPLINK, PORTAL, RECORD_URL, DOCS["pcap"], DOCS["ppt"]]

    workspace = fresh_client.get(f"/api/v1/tenders/{tender['id']}/workspace").json()
    (doc,) = workspace["documents"]
    assert doc["sha256"] == hashlib.sha256(PDF).hexdigest()
    assert doc["source_url"] == DOCS["pcap"] and doc["rights_status"] == "unknown"
    content = fresh_client.get(f"/api/v1/documents/{doc['id']}/content")
    assert content.content == PDF


def test_reimport_links_existing_without_network(
    fresh_client: TestClient, source: Callable[[Handler], list[str]]
) -> None:
    source(official_source())
    first = _import(fresh_client, "imp-a")
    assert first.status_code == 201, first.text
    replay = _import(fresh_client, "imp-a")
    assert replay.status_code == 200 and replay.json() == first.json()

    seen = source(official_source())
    again = _import(fresh_client, "imp-b", url="4mTE7tVTKp4IYE3ZiZ+xmQ==")
    assert again.status_code == 200, again.text
    assert again.json()["already_imported"] is True
    assert again.json()["tender"]["id"] == first.json()["tender"]["id"]
    assert again.json()["documents"] == first.json()["documents"]
    assert seen == []
    assert fresh_client.get("/api/v1/tenders").json()["total"] == 1


def test_oversized_pcap_fails_and_creates_nothing(
    fresh_client: TestClient,
    source: Callable[[Handler], list[str]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(pdf_service, "MAX_PDF_BYTES", len(PDF) - 1)
    source(official_source())
    res = _import(fresh_client, "imp-big")
    assert res.status_code == 413, res.text
    assert res.json()["code"] == "document_too_large"
    assert fresh_client.get("/api/v1/tenders").json()["total"] == 0


def _down(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("unreachable", request=request)


def _offsite_redirect(request: httpx.Request) -> httpx.Response:
    if str(request.url) == DEEPLINK:
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest/"})
    return httpx.Response(599)


@pytest.mark.parametrize(
    "handler",
    [_down, lambda _r: httpx.Response(503), lambda _r: httpx.Response(429), _offsite_redirect],
    ids=["connect_error", "http_503", "http_429", "offsite_redirect"],
)
def test_source_problems_are_source_unavailable(
    fresh_client: TestClient, source: Callable[[Handler], list[str]], handler: Handler
) -> None:
    seen = source(handler)
    res = _import(fresh_client, "imp-down")
    assert res.status_code == 502, res.text
    assert res.json()["code"] == "source_unavailable"
    assert all(url.startswith("https://contrataciondelestado.es/") for url in seen)
    assert fresh_client.get("/api/v1/tenders").json()["total"] == 0


def test_pasted_url_on_other_host_is_never_fetched(
    fresh_client: TestClient, source: Callable[[Handler], list[str]]
) -> None:
    seen = source(official_source())
    res = _import(
        fresh_client, "imp-ssrf", url=DEEPLINK.replace("contrataciondelestado.es", "10.0.0.1")
    )
    assert res.status_code == 422
    assert res.json()["code"] == "unsupported_url"
    assert seen == []
