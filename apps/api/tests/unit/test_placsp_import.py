"""PLACSP import: input parsing, URL guard and the recorded real record."""

import json
from pathlib import Path

import pytest
from bidlab.api.errors import ApiError
from bidlab.services import placsp_import as placsp

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "placsp"
ID_EVL = "4mTE7tVTKp4IYE3ZiZ+xmQ=="
CANONICAL = (
    "https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion"
    "&idEvl=4mTE7tVTKp4IYE3ZiZ%2BxmQ%3D%3D"
)


@pytest.mark.parametrize(
    "pasted",
    [
        CANONICAL,
        f"  {CANONICAL}\n",
        CANONICAL.replace("&idEvl", "&amp;idEvl"),
        f"https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl={ID_EVL}",
        CANONICAL.replace("https://", "http://").replace(
            "contrataciondelestado.es", "contrataciondelsectorpublico.gob.es"
        ),
        CANONICAL.removeprefix("https://"),
        "https://contrataciondelestado.es/wps/poc?uri=deeplink%3Adetalle_licitacion&idEvl=4mTE7tVTKp4IYE3ZiZ%2BxmQ%3D%3D",
        ID_EVL,
        "4mTE7tVTKp4IYE3ZiZ%2BxmQ%3D%3D",
    ],
)
def test_reference_shapes_resolve_to_one_official_url(pasted: str) -> None:
    ref = placsp.parse_reference(pasted)
    assert ref.id_evl == ID_EVL
    assert ref.source_url == CANONICAL


@pytest.mark.parametrize(
    ("pasted", "reason"),
    [
        (CANONICAL.replace("contrataciondelestado.es", "evil.example"), "other_host"),
        (CANONICAL.replace("contrataciondelestado.es", "127.0.0.1"), "other_host"),
        (CANONICAL.replace("https://", "https://user@"), "other_host"),
        ("ftp://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion", "other_host"),
        (
            "https://contrataciondelestado.es/wps/portal/plataforma/buscadores/detalle/!ut/p/z1/hY9J/",
            "portal_session_url",
        ),
        (
            "https://contrataciondelestado.es/wps/poc?uri=deeplink:perfilContratante&idBp=94bJJbsgrdxvYnTkQN0%2FZA%3D%3D",
            "not_a_tender_deeplink",
        ),
        ("20777838", "numeric_id_not_resolvable"),
        ("2026/00006554N", "not_a_placsp_link"),
        ("   ", "empty_or_too_long"),
    ],
)
def test_reference_refusals(pasted: str, reason: str) -> None:
    with pytest.raises(ApiError) as caught:
        placsp.parse_reference(pasted)
    assert caught.value.code == "unsupported_url"
    assert caught.value.details == [reason]


def test_url_guard_allows_only_https_official_host_and_paths() -> None:
    doc = "/FileSystem/servlet/GetDocumentByIdServlet?DocumentIdParam=x"
    assert placsp.is_allowed(f"https://contrataciondelestado.es{doc}", placsp.DOCUMENT_PATHS)
    refused = [
        f"http://contrataciondelestado.es{doc}",
        f"https://evil.example{doc}",
        f"https://contrataciondelestado.es.evil.example{doc}",
        f"https://127.0.0.1{doc}",
        f"https://[::1]{doc}",
        f"https://user:pw@contrataciondelestado.es{doc}",
        f"https://contrataciondelestado.es:8443{doc}",
        "https://contrataciondelestado.es/wps/portal/other",
    ]
    for url in refused:
        assert not placsp.is_allowed(url, placsp.DOCUMENT_PATHS), url


def test_recorded_real_record_parses() -> None:
    provenance = json.loads((FIXTURES / "provenance.json").read_text(encoding="utf-8"))
    page = placsp.parse_detail_page((FIXTURES / "detail.html").read_bytes())
    assert page.expediente == "2026/00006554N"
    assert page.estado == "Publicada"
    assert page.latest_pliego_xml() == provenance["record_url"]

    record = placsp.parse_call_for_tenders((FIXTURES / "call_for_tenders.xml").read_bytes())
    assert record.external_id == "2026/00006554N"
    assert record.title.startswith("Servicios de asistencia técnica de gestión del Plan")
    assert record.contracting_body == "Pleno del Ayuntamiento de Tías"
    assert (record.pbl_net, record.pbl_gross, record.estimated_value) == (
        "118336.00",
        "126619.52",
        "295840.00",
    )
    assert record.currency == "EUR"
    assert record.cpv_codes == ["79411000", "71356200"]
    assert record.deadline_at == "2026-11-25T23:59:00+01:00"
    assert record.deadline_literal == "2026-11-25+01:00 23:59:00.000 (Hora peninsular)"
    assert record.period_months == 24
    assert [(d.kind, d.label) for d in record.documents] == [
        ("pcap", "PCAP 6554.pdf"),
        ("ppt", "Pliego.pdf"),
        ("other", "ANEXO I.docx"),
    ]
    assert record.documents[0].published_sha1 == "DKu8jA7vvBSFzySzlkLHr3jrTZ8="
    assert all(placsp.is_allowed(d.url, placsp.DOCUMENT_PATHS) for d in record.documents)
    assert record.evidence_paths["pbl_net"] == (
        "cac:ProcurementProject/cac:BudgetAmount/cbc:TaxExclusiveAmount",
        "118336",
    )


def test_record_with_dtd_is_refused() -> None:
    hostile = b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><CallForTenders/>'
    with pytest.raises(ApiError) as caught:
        placsp.parse_call_for_tenders(hostile)
    assert caught.value.code == "source_unavailable"
