"""PKG-T12: library search and pagination over the complete tender set."""

from typing import Any, cast

from fastapi.testclient import TestClient

HEADERS = {"X-BidLab-Client": "local-ui"}


def _headers(key: str) -> dict[str, str]:
    return {**HEADERS, "Idempotency-Key": key}


def _create(client: TestClient, key: str, title: str, external_id: str) -> dict[str, Any]:
    res = client.post(
        "/api/v1/tenders",
        json={
            "title": title,
            "external_id": external_id,
            "contracting_body": "Ayuntamiento de Ejemplo",
            "source_url": None,
            "scope_label": None,
            "basis": None,
        },
        headers=_headers(key),
    )
    assert res.status_code == 201, res.text
    return cast("dict[str, Any]", res.json())


def test_q_finds_expediente_beyond_the_first_page(fresh_client: TestClient) -> None:
    """Acceptance 1: search scans the complete set, not the visible page."""
    for index in range(1, 21):
        _create(fresh_client, f"t12-{index}", f"Obra menor {index}", f"2026/{index:05d}")
    _create(fresh_client, "t12-102", "Reforma profunda", "2026/00102")
    first = fresh_client.get("/api/v1/tenders")
    assert first.status_code == 200
    assert first.json()["total"] == 21
    assert len(first.json()["items"]) == 20
    found = fresh_client.get("/api/v1/tenders", params={"q": "102"})
    assert found.status_code == 200
    assert found.json()["total"] == 1
    assert found.json()["items"][0]["external_id"] == "2026/00102"
    second = fresh_client.get("/api/v1/tenders", params={"page": 2})
    assert second.status_code == 200
    assert second.json()["page"] == 2
    assert len(second.json()["items"]) == 1
    deep = second.json()["items"][0]["external_id"]
    via_search = fresh_client.get("/api/v1/tenders", params={"q": deep})
    assert via_search.status_code == 200
    assert via_search.json()["total"] == 1
    assert via_search.json()["items"][0]["external_id"] == deep


def test_q_matches_title_and_cpv_case_insensitively(seeded_client: TestClient) -> None:
    """The label promise (title, file number, CPV) holds server-side."""
    by_title = seeded_client.get("/api/v1/tenders", params={"q": "tías"})
    assert by_title.status_code == 200
    assert by_title.json()["total"] == 1
    assert by_title.json()["items"][0]["id"] == "tias"
    by_cpv = seeded_client.get("/api/v1/tenders", params={"q": "79411000"})
    assert by_cpv.status_code == 200
    assert by_cpv.json()["total"] == 1
    assert by_cpv.json()["items"][0]["id"] == "tias"
    exact = seeded_client.get("/api/v1/tenders", params={"cpv": "71356200"})
    assert exact.status_code == 200
    assert exact.json()["total"] == 1
    missing = seeded_client.get("/api/v1/tenders", params={"q": "no-existe-este-titulo"})
    assert missing.status_code == 200
    assert missing.json() == {"items": [], "page": 1, "page_size": 20, "total": 0}


def test_page_size_is_honored_and_out_of_range_is_empty(seeded_client: TestClient) -> None:
    _create(seeded_client, "t12-a", "Obra A", "2026/00011A")
    _create(seeded_client, "t12-b", "Obra B", "2026/00012B")
    one = seeded_client.get("/api/v1/tenders", params={"page_size": 2})
    assert one.status_code == 200
    assert one.json()["total"] == 3
    assert len(one.json()["items"]) == 2
    two = seeded_client.get("/api/v1/tenders", params={"page": 2, "page_size": 2})
    assert two.status_code == 200
    assert len(two.json()["items"]) == 1
    assert two.json()["total"] == 3
    far = seeded_client.get("/api/v1/tenders", params={"page": 9, "page_size": 2})
    assert far.status_code == 200
    assert far.json()["items"] == []
    assert far.json()["total"] == 3
