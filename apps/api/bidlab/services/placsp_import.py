"""Import one published tender from the Plataforma de Contratación (PLACSP).

Input is whatever the user pasted; it is parsed into the stable PLACSP
identifier ``idEvl`` (the encrypted token in the public deeplink
``https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion
&idEvl=...``, which is also the ``atom:link`` of every entry in the official
open-data syndication). The pasted URL is never fetched: the official URL is
rebuilt server-side from the token (SSRF guard). Accepted shapes: that
deeplink on either official host (``contrataciondelestado.es`` or
``contrataciondelsectorpublico.gob.es``, with or without ``www.``, http or
https, percent-encoded or raw, ``&amp;`` escaped) or the bare token. The
numeric Atom id and the expediente number are refused: no public endpoint
resolves them to one record without sweeping the paginated feeds, and the
expediente number is not unique nationally (DATA_FEASIBILITY, ETL step 6).
The browser address-bar URL (``/wps/portal/...!ut/p/z1/...``) is portal
session state, not an identifier: refused with a hint to copy the
«Enlace a la licitación» instead.

Route (one import = at most four resources, no crawling, no pagination):
1. GET the public detail page for the deeplink (three hops of portal
   redirects, all on the allowlisted host). This is the only HTML step and
   it is parsed minimally with the stdlib ``html.parser``: the expediente
   and estado spans (an empty expediente means the token resolves to no
   tender: ``not_found``) and the document table rows, to find the XML link
   of the latest «Pliego» row. Nothing else is read from HTML. There is no
   per-tender open-data endpoint keyed by ``idEvl``; scanning the Atom feeds
   for it would be the pagination sweep this module must not do.
2. GET that XML: the official CODICE ``CallForTenders`` document, the same
   CODICE schema the open-data feed carries (DATA_FEASIBILITY, «Rutas XML
   exactas»). Every imported field comes from it: ContractFolderID, title,
   contracting body, BudgetAmount (net, gross, estimated value), CPV,
   submission deadline, planned duration and the Legal/Technical/Additional
   document references with their URIs and published SHA-1 hashes. Tax kind
   is not published there, so it stays ``unknown``; absent values stay null.
3. GET the first PDF PCAP (LegalDocumentReference) and the first PDF PPT
   (TechnicalDocumentReference). Other references are listed with their
   official URL, never downloaded.

Network guard (:class:`PlacspClient`): https only, exact host allowlist
(``contrataciondelestado.es``; every observed record and document link,
115/115 in the feed probe, lives there), per-step path allowlist, port 443,
no userinfo, IP literals refused by construction, redirects followed
manually (max four) and each hop re-checked against the allowlist,
connect/read timeouts plus a wall-clock budget per resource (the servlet
streams at ~100 KB/s without Content-Length), streamed size caps (2 MiB
HTML/XML, the manual-upload PDF cap for the PCAP, 4 MiB and 30 s for the
optional PPT), content-type checks, DTD/entity XML refused.
Requests are spaced ``pause_seconds`` apart (one connection, >= 1 s between
resources, DATA_FEASIBILITY «Descarga responsable»). 403/429 stop the import
as ``source_unavailable`` and the user falls back to manual upload; nothing
retries or rotates. robots.txt on both hosts says ``Disallow: /``
(SOURCE_AUDIT D07): that targets automated navigation; this is one
user-initiated retrieval of the page the user pasted plus the resources
the official record links to, the same reads the user would do by hand.

Documents go through the SAME validation as manual upload
(``intake.stage_document_upload``: PDF magic, byte/page/char caps,
readability, sha256, duplicate check) and keep provenance: official
``source_url``, sha256 and pages; the published SHA-1 is checked and a
mismatch skips the document instead of storing unverified bytes. The PCAP
over the caps fails the import (``document_too_large``); an oversized or
unusable PPT is only listed. No PDF downloaded means ``no_documents``.
Rights stay ``unknown`` (official publication is not a redistribution
licence, SOURCE_AUDIT D08). The raw CODICE XML is kept as a notice version
(sha256, URL, retrieval time) and every metadata field carries a
``metadata_evidence`` entry pointing at its XPath in that snapshot.

Idempotency: the tender key is ``(feed_id="placsp_deeplink", atom_id=idEvl)``
under the existing unique constraint. A second import of the same tender
links the existing one before any network call; an own tender whose
``source_url`` is that canonical deeplink is linked too. Demo/seed tenders
are never matched (different ``feed_id``). Fetching happens before any
write and the whole import is one transaction, so a run that dies midway
leaves nothing and the next run starts clean; a concurrent duplicate loses
on the unique key and is answered with the winner. No model call starts:
the user lands in the normal own-tender flow and opts into analysis there.
"""

from __future__ import annotations

import base64
import binascii
import datetime as dt
import hashlib
import html
import re
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from html.parser import HTMLParser
from ipaddress import ip_address
from typing import TYPE_CHECKING, Any, ClassVar
from urllib.parse import quote, unquote, urljoin, urlsplit

import httpx
from sqlalchemy import or_, select

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.services import intake as intake_service
from bidlab.services import pdf as pdf_service
from bidlab.services import workspace as workspace_service
from bidlab.settings import get_settings

if TYPE_CHECKING:
    from pathlib import Path

    from sqlalchemy.orm import Session

FEED_ID = "placsp_deeplink"
OFFICIAL_HOST = "contrataciondelestado.es"
ALLOWED_HOSTS = frozenset({OFFICIAL_HOST})
INPUT_HOSTS = frozenset(
    {
        OFFICIAL_HOST,
        f"www.{OFFICIAL_HOST}",
        "contrataciondelsectorpublico.gob.es",
        "www.contrataciondelsectorpublico.gob.es",
    }
)
DEEPLINK_PREFIX = f"https://{OFFICIAL_HOST}/wps/poc?uri=deeplink:detalle_licitacion&idEvl="
DETAIL_PATHS = ("/wps/poc", "/wps/portal/")
DOCUMENT_PATHS = ("/FileSystem/servlet/GetDocumentByIdServlet",)
MAX_PAGE_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 4
PAUSE_SECONDS = 1.0
# The servlet streams without Content-Length at ~100 KB/s (measured on the
# real import), so every resource also gets a wall-clock budget. The PPT is
# optional: it is fetched only when cheap (byte and time caps below).
PAGE_MAX_SECONDS = 30.0
PCAP_MAX_SECONDS = 180.0
PPT_MAX_BYTES = 4 * 1024 * 1024
PPT_MAX_SECONDS = 30.0
TIMEOUT = httpx.Timeout(20.0, connect=5.0)
USER_AGENT = "BidLab/1.0 (single user-initiated tender import)"
RIGHTS_OFFICIAL_DOWNLOAD = "official_public_download_local"
INPUT_MAX = 3000

HTML_TYPES = frozenset({"text/html"})
XML_TYPES = frozenset({"application/xml", "text/xml"})
PDF_TYPES = frozenset({"application/pdf", "application/x-pdf", "application/octet-stream"})

CBC = "urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2"
CAC = "urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2"
NS = {"cbc": CBC, "cac": CAC}

_TOKEN_RE = re.compile(r"^[A-Za-z0-9+/]{8,200}={0,2}$")
_IDEVL_RE = re.compile(r"(?:^|&)idEvl=([^&#]*)", re.IGNORECASE)
_DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})(Z|[+-]\d{2}:\d{2})?$")
_TIME_RE = re.compile(r"^(\d{2}:\d{2}:\d{2})(?:\.\d+)?$")
_ROW_DATE_RE = re.compile(r"(\d{2})/(\d{2})/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?")


# ---------------------------------------------------------------- input


@dataclass(frozen=True)
class TenderRef:
    """Parsed PLACSP identifier; the only thing derived from user input."""

    id_evl: str

    @property
    def source_url(self) -> str:
        return DEEPLINK_PREFIX + quote(self.id_evl, safe="")


def _unsupported(reason: str) -> ApiError:
    return ApiError(
        422,
        "unsupported_url",
        "paste the «Enlace a la licitación» deeplink of contrataciondelestado.es",
        [reason],
    )


def _valid_token(token: str) -> bool:
    """idEvl is base64 of a block-cipher output: 8n bytes, n >= 1."""
    if _TOKEN_RE.match(token) is None:
        return False
    try:
        raw = base64.b64decode(token, validate=True)
    except (binascii.Error, ValueError):
        return False
    return len(raw) >= 8 and len(raw) % 8 == 0


def parse_reference(raw: str) -> TenderRef:
    """Pasted link or bare token -> TenderRef. Never touches the network."""
    text = html.unescape(raw.strip())
    if not text or len(text) > INPUT_MAX:
        raise _unsupported("empty_or_too_long")
    if text.isdigit():
        raise _unsupported("numeric_id_not_resolvable")
    bare = unquote(text)
    if _valid_token(bare):
        return TenderRef(bare)
    # Anything else must be the deeplink itself. http is accepted on input
    # only: the URL is rebuilt as https and the pasted one is never fetched.
    parts = urlsplit(text if "://" in text else f"https://{text}")
    host = (parts.hostname or "").lower()
    if "." not in host:
        raise _unsupported("not_a_placsp_link")
    if parts.scheme not in ("http", "https") or host not in INPUT_HOSTS:
        raise _unsupported("other_host")
    try:
        port = parts.port
    except ValueError:
        port = -1
    if parts.username or parts.password or port not in (None, 80, 443):
        raise _unsupported("other_host")
    if parts.path.startswith("/wps/portal"):
        raise _unsupported("portal_session_url")
    query = parts.query
    if parts.path.rstrip("/") != "/wps/poc" or "deeplink:detalle_licitacion" not in unquote(query):
        raise _unsupported("not_a_tender_deeplink")
    match = _IDEVL_RE.search(query)
    token = unquote(match.group(1)).strip() if match else ""
    if not _valid_token(token):
        raise _unsupported("bad_idevl")
    return TenderRef(token)


# ---------------------------------------------------------------- network


class _DocumentError(Exception):
    """A document that cannot be stored; the caller lists or fails it."""

    def __init__(self, reason: str, size_bytes: int | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.size_bytes = size_bytes


@dataclass(frozen=True)
class Fetched:
    url: str
    body: bytes
    content_type: str
    retrieved_at: str


def source_unavailable(*, detail: str) -> ApiError:
    return ApiError(
        502,
        "source_unavailable",
        "the Plataforma de Contratación did not answer usably",
        [detail],
    )


def is_allowed(url: str, paths: tuple[str, ...]) -> bool:
    """True when ``url`` is https on an allowlisted host and path prefix."""
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        return False
    host = (parts.hostname or "").lower()
    try:
        ip_address(host.strip("[]"))
    except ValueError:
        pass
    else:
        return False
    return (
        parts.scheme == "https"
        and host in ALLOWED_HOSTS
        and port in (None, 443)
        and not parts.username
        and not parts.password
        and any(parts.path.startswith(prefix) for prefix in paths)
    )


class PlacspClient:
    """Allowlisted, size-capped, paced HTTP reader for one import."""

    def __init__(
        self, transport: httpx.BaseTransport | None = None, pause_seconds: float = PAUSE_SECONDS
    ) -> None:
        self._transport = transport
        self._pause = pause_seconds
        self._http: httpx.Client | None = None
        self._last_request: float | None = None

    def __enter__(self) -> PlacspClient:
        self._http = httpx.Client(
            transport=self._transport,
            timeout=TIMEOUT,
            follow_redirects=False,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "es"},
        )
        return self

    def __exit__(self, *_exc: object) -> None:
        if self._http is not None:
            self._http.close()
        self._http = None

    def _wait_turn(self) -> None:
        if self._last_request is not None and self._pause > 0:
            remaining = self._pause - (time.monotonic() - self._last_request)
            if remaining > 0:
                time.sleep(remaining)
        self._last_request = time.monotonic()

    def get(
        self,
        url: str,
        *,
        paths: tuple[str, ...],
        max_bytes: int,
        content_types: frozenset[str],
        max_seconds: float = PAGE_MAX_SECONDS,
    ) -> Fetched:
        """GET one resource; every redirect hop is re-checked. Raises typed errors."""
        if self._http is None:
            raise RuntimeError("placsp_client_not_open")
        self._wait_turn()
        deadline = time.monotonic() + max_seconds
        current = url
        for _hop in range(MAX_REDIRECTS + 1):
            if not is_allowed(current, paths):
                raise source_unavailable(detail=f"refused off-allowlist URL {current[:200]}")
            try:
                with self._http.stream("GET", current) as response:
                    if response.is_redirect:
                        location = response.headers.get("location", "")
                        current = urljoin(current, location)
                        continue
                    return self._read(response, current, max_bytes, content_types, deadline)
            except httpx.TimeoutException as exc:
                raise source_unavailable(detail="timeout") from exc
            except httpx.HTTPError as exc:
                raise source_unavailable(detail=f"network error: {type(exc).__name__}") from exc
        raise source_unavailable(detail="too many redirects")

    @staticmethod
    def _read(
        response: httpx.Response,
        url: str,
        max_bytes: int,
        content_types: frozenset[str],
        deadline: float,
    ) -> Fetched:
        status = response.status_code
        if status == 404:
            raise ApiError(404, "not_found", "the Plataforma has no tender for that link")
        if status in (403, 429):
            raise source_unavailable(detail=f"HTTP {status}: source refused; download by hand")
        if status != 200:
            raise source_unavailable(detail=f"HTTP {status}")
        declared = response.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > max_bytes:
            raise _DocumentError("too_large", int(declared))
        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type not in content_types:
            raise _DocumentError("unexpected_type")
        chunks: list[bytes] = []
        size = 0
        for chunk in response.iter_bytes():
            size += len(chunk)
            if size > max_bytes:
                raise _DocumentError("too_large")  # true size unknown: no Content-Length
            if time.monotonic() > deadline:
                raise _DocumentError("too_slow")
            chunks.append(chunk)
        return Fetched(
            url=url,
            body=b"".join(chunks),
            content_type=content_type,
            retrieved_at=dt.datetime.now(dt.UTC).isoformat(),
        )


def get_client() -> PlacspClient:
    """FastAPI dependency: the real network client (tests override it)."""
    return PlacspClient()


# ---------------------------------------------------------------- detail page


@dataclass
class DetailPage:
    expediente: str = ""
    estado: str = ""
    rows: list[tuple[str, str, str]] = field(default_factory=list)  # (date, label, xml_url)

    def latest_pliego_xml(self) -> str | None:
        """XML link of the most recent «Pliego» row (rectifications included)."""
        best: tuple[tuple[int, ...], int, str] | None = None
        for index, (date_text, label, url) in enumerate(self.rows):
            if not label.strip().casefold().startswith("pliego"):
                continue
            match = _ROW_DATE_RE.search(date_text)
            key: tuple[int, ...] = ()
            if match:
                day, month, year, hh, mm, ss = match.groups()
                key = (int(year), int(month), int(day), int(hh or 0), int(mm or 0), int(ss or 0))
            candidate = (key, index, url)
            if best is None or candidate[:2] > best[:2]:
                best = candidate
        return best[2] if best else None


class _DetailParser(HTMLParser):
    """Reads only the expediente/estado spans and the document table rows."""

    _SPANS: ClassVar[dict[str, str]] = {"text_Expediente": "expediente", "text_Estado": "estado"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.page = DetailPage()
        self._span: str | None = None
        self._cell: str | None = None
        self._row: dict[str, str] | None = None
        self._href: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: value or "" for name, value in attrs}
        if tag == "span":
            suffix = values.get("id", "").rsplit(":", 1)[-1]
            self._span = self._SPANS.get(suffix)
        elif tag == "tr":
            self._row = {"date": "", "label": "", "xml": ""}
        elif tag == "td" and self._row is not None:
            classes = values.get("class", "").split()
            if "fechaPubLeft" in classes:
                self._cell = "date"
            elif "tipoDocumento" in classes:
                self._cell = "label"
            else:
                self._cell = None
        elif tag == "a":
            self._href = values.get("href")
        elif tag == "img" and self._row is not None and self._href:
            if values.get("alt", "").strip().lower() == "documento xml" and not self._row["xml"]:
                self._row["xml"] = self._href

    def handle_endtag(self, tag: str) -> None:
        if tag == "span":
            self._span = None
        elif tag == "td":
            self._cell = None
        elif tag == "a":
            self._href = None
        elif tag == "tr" and self._row is not None:
            row = self._row
            if row["xml"] and row["label"].strip():
                self.page.rows.append((row["date"].strip(), row["label"].strip(), row["xml"]))
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._span is not None:
            current = getattr(self.page, self._span)
            setattr(self.page, self._span, (current + data).strip())
        if self._row is not None and self._cell is not None:
            self._row[self._cell] += data


def parse_detail_page(body: bytes) -> DetailPage:
    parser = _DetailParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    parser.close()
    return parser.page


# ---------------------------------------------------------------- CODICE record


@dataclass(frozen=True)
class SourceDocument:
    kind: str  # pcap | ppt | other
    label: str
    url: str
    published_sha1: str | None


@dataclass
class TenderRecord:
    external_id: str
    title: str
    contracting_body: str
    issued_at: str | None
    pbl_net: str | None
    pbl_gross: str | None
    estimated_value: str | None
    currency: str | None
    cpv_codes: list[str]
    deadline_literal: str | None
    deadline_at: str | None
    period_months: int | None
    lot_count: int
    documents: list[SourceDocument]
    evidence_paths: dict[str, tuple[str, str]]  # key -> (xpath, raw value)
    quality_flags: list[str]


def _text(node: ET.Element | None, path: str) -> str | None:
    if node is None:
        return None
    found = node.find(path, NS)
    if found is None or found.text is None:
        return None
    value = " ".join(found.text.split())
    return value or None


def _iso_datetime(date_text: str | None, time_text: str | None) -> str | None:
    """Combine CODICE date (with explicit offset) and time; no offset -> None."""
    if not date_text or not time_text:
        return None
    date_match = _DATE_RE.match(date_text)
    time_match = _TIME_RE.match(time_text)
    if date_match is None or time_match is None or date_match.group(2) is None:
        return None
    offset = "+00:00" if date_match.group(2) == "Z" else date_match.group(2)
    try:
        return dt.datetime.fromisoformat(
            f"{date_match.group(1)}T{time_match.group(1)}{offset}"
        ).isoformat()
    except ValueError:
        return None


def _money(value: str | None, flags: list[str], key: str) -> str | None:
    if value is None:
        return None
    try:
        return intake_service.parse_money_input(value, field=key)
    except ApiError:
        flags.append(f"unparseable_amount:{key}")
        return None


def parse_call_for_tenders(data: bytes) -> TenderRecord:
    """Official CODICE CallForTenders XML -> TenderRecord. Pure, no network."""
    head = data[:4096].upper()
    if b"<!DOCTYPE" in head or b"<!ENTITY" in data.upper():
        raise source_unavailable(detail="record XML declares a DTD; refused")
    try:
        # DTDs and entities are refused above, so expat sees plain XML only.
        root = ET.fromstring(data)  # noqa: S314
    except ET.ParseError as exc:
        raise source_unavailable(detail="record XML is not well-formed") from exc
    if root.tag.rsplit("}", 1)[-1] != "CallForTenders":
        raise source_unavailable(detail=f"unexpected record type {root.tag.rsplit('}', 1)[-1]}")
    flags: list[str] = []
    evidence: dict[str, tuple[str, str]] = {}

    def keep(key: str, xpath: str, value: str | None) -> str | None:
        if value is not None:
            evidence[key] = (xpath, value)
        return value

    external_id = keep("external_id", "cbc:ContractFolderID", _text(root, "cbc:ContractFolderID"))
    title = keep(
        "title", "cac:ProcurementProject/cbc:Name", _text(root, "cac:ProcurementProject/cbc:Name")
    )
    body_path = "cac:ContractingParty/cac:Party/cac:PartyName/cbc:Name"
    contracting_body = keep("contracting_body", body_path, _text(root, body_path))
    if not external_id or not title or not contracting_body:
        raise source_unavailable(detail="record lacks expediente, title or contracting body")

    budget = root.find("cac:ProcurementProject/cac:BudgetAmount", NS)
    amounts: dict[str, str | None] = {}
    currencies: set[str] = set()
    for key, tag in (
        ("pbl_net", "TaxExclusiveAmount"),
        ("pbl_gross", "TotalAmount"),
        ("estimated_value", "EstimatedOverallContractAmount"),
    ):
        node = budget.find(f"cbc:{tag}", NS) if budget is not None else None
        raw = (node.text or "").strip() if node is not None else ""
        if node is not None and raw:
            currencies.add(node.get("currencyID", ""))
            keep(key, f"cac:ProcurementProject/cac:BudgetAmount/cbc:{tag}", raw)
        amounts[key] = raw or None
    currency = currencies.pop() if len(currencies) == 1 else None
    if currencies or (currency is not None and currency != "EUR"):
        # Mixed or non-EUR amounts never enter EUR fields.
        flags.append("currency_not_eur")
        amounts = dict.fromkeys(amounts)
        currency = None

    cpv_path = (
        "cac:ProcurementProject/cac:RequiredCommodityClassification/cbc:ItemClassificationCode"
    )
    cpv_codes: list[str] = []
    for node in root.findall(cpv_path, NS):
        code = (node.text or "").strip()
        if code and len(code) <= 12 and code not in cpv_codes and len(cpv_codes) < 30:
            cpv_codes.append(code)
    if cpv_codes:
        keep("cpv_codes", cpv_path, " ".join(cpv_codes))

    deadline_path = "cac:TenderingProcess/cac:TenderSubmissionDeadlinePeriod"
    end_date = _text(root, f"{deadline_path}/cbc:EndDate")
    end_time = _text(root, f"{deadline_path}/cbc:EndTime")
    note = _text(root, f"{deadline_path}/cbc:Description")
    literal_parts = [part for part in (end_date, end_time) if part]
    deadline_literal = " ".join(literal_parts) if literal_parts else None
    if deadline_literal and note:
        deadline_literal = f"{deadline_literal} ({note})"
    if deadline_literal:
        deadline_literal = deadline_literal[:300]
        keep("deadline", deadline_path, deadline_literal)

    period_months: int | None = None
    duration = root.find("cac:ProcurementProject/cac:PlannedPeriod/cbc:DurationMeasure", NS)
    if duration is not None and (duration.text or "").strip().isdigit():
        count = int((duration.text or "").strip())
        factor = {"ANN": 12, "MON": 1}.get(duration.get("unitCode", ""))
        if factor and count > 0:
            period_months = count * factor
            keep(
                "period_months",
                "cac:ProcurementProject/cac:PlannedPeriod/cbc:DurationMeasure",
                f"{count} {duration.get('unitCode')}",
            )

    lot_count = len(root.findall("cac:ProcurementProjectLot", NS))
    if lot_count:
        flags.append("lots_not_imported")

    documents: list[SourceDocument] = []
    for tag, kind in (
        ("LegalDocumentReference", "pcap"),
        ("TechnicalDocumentReference", "ppt"),
        ("AdditionalDocumentReference", "other"),
    ):
        for ref_node in root.findall(f"cac:{tag}", NS):
            url = _text(ref_node, "cac:Attachment/cac:ExternalReference/cbc:URI")
            if not url:
                continue
            label = _text(ref_node, "cbc:ID") or kind.upper()
            published = _text(ref_node, "cac:Attachment/cac:ExternalReference/cbc:DocumentHash")
            documents.append(SourceDocument(kind, label[:300], url, published))

    return TenderRecord(
        external_id=external_id[: intake_service.EXTERNAL_ID_MAX],
        title=title[: intake_service.TITLE_MAX],
        contracting_body=contracting_body[: intake_service.CONTRACTING_BODY_MAX],
        issued_at=_iso_datetime(_text(root, "cbc:IssueDate"), _text(root, "cbc:IssueTime")),
        pbl_net=_money(amounts["pbl_net"], flags, "pbl_net"),
        pbl_gross=_money(amounts["pbl_gross"], flags, "pbl_gross"),
        estimated_value=_money(amounts["estimated_value"], flags, "estimated_value"),
        currency=currency,
        cpv_codes=cpv_codes,
        deadline_literal=deadline_literal,
        deadline_at=_iso_datetime(end_date, end_time),
        period_months=period_months,
        lot_count=lot_count,
        documents=documents,
        evidence_paths=evidence,
        quality_flags=flags,
    )


# ---------------------------------------------------------------- fetch


@dataclass
class Download:
    source: SourceDocument
    body: bytes | None
    reason: str | None  # set when not downloaded
    size_bytes: int | None
    hash_verified: bool | None


@dataclass
class FetchedTender:
    ref: TenderRef
    page: DetailPage
    record: TenderRecord
    record_url: str
    record_bytes: bytes
    record_sha256: str
    retrieved_at: str
    downloads: list[Download]


def _looks_pdf(label: str) -> bool:
    return label.lower().endswith(".pdf") or "." not in label.rsplit("/", 1)[-1]


def _sha1_matches(body: bytes, published: str | None) -> bool | None:
    if not published:
        return None
    digest = hashlib.sha1(body, usedforsecurity=False).digest()
    return base64.b64encode(digest).decode("ascii") == published.strip()


def _download(client: PlacspClient, source: SourceDocument, *, required: bool) -> Download:
    """Fetch one PDF. The required PCAP fails the import when over a cap."""
    try:
        fetched = client.get(
            source.url,
            paths=DOCUMENT_PATHS,
            max_bytes=pdf_service.MAX_PDF_BYTES if required else PPT_MAX_BYTES,
            content_types=PDF_TYPES,
            max_seconds=PCAP_MAX_SECONDS if required else PPT_MAX_SECONDS,
        )
    except _DocumentError as problem:
        if required and problem.reason == "too_large":
            raise document_too_large(source.label, problem.size_bytes) from problem
        if required and problem.reason == "too_slow":
            raise source_unavailable(detail=f"{source.label}: download too slow") from problem
        reason = {"too_large": "too_large", "too_slow": "download_failed"}.get(
            problem.reason, "not_pdf"
        )
        return Download(source, None, reason, problem.size_bytes, None)
    except ApiError:
        if required:
            raise
        return Download(source, None, "download_failed", None, None)
    body = fetched.body
    if body[:5] != b"%PDF-":
        return Download(source, None, "not_pdf", len(body), None)
    verified = _sha1_matches(body, source.published_sha1)
    if verified is False:
        return Download(source, None, "hash_mismatch", len(body), False)
    return Download(source, body, None, len(body), verified)


def document_too_large(label: str, size_bytes: int | None) -> ApiError:
    size = f"{size_bytes} bytes" if size_bytes is not None else "over the cap"
    return ApiError(
        413,
        "document_too_large",
        f"{label}: {size}; limits are {pdf_service.MAX_PDF_BYTES} bytes "
        f"and {pdf_service.MAX_PAGES} pages",
        [label[:200]],
    )


def fetch_tender(ref: TenderRef, client: PlacspClient) -> FetchedTender:
    """All network work for one import (<= 4 resources). Writes nothing."""
    with client:
        try:
            detail = client.get(
                ref.source_url,
                paths=DETAIL_PATHS,
                max_bytes=MAX_PAGE_BYTES,
                content_types=HTML_TYPES,
            )
        except _DocumentError as problem:
            raise source_unavailable(detail=f"detail page: {problem.reason}") from problem
        page = parse_detail_page(detail.body)
        if not page.expediente:
            raise ApiError(404, "not_found", "the Plataforma has no tender for that link")
        xml_link = page.latest_pliego_xml()
        xml_url = urljoin(detail.url, xml_link) if xml_link else None
        if xml_url is None:
            raise ApiError(
                422, "no_documents", "the tender has no published pliego yet", ["no_pliego_row"]
            )
        try:
            record_doc = client.get(
                xml_url, paths=DOCUMENT_PATHS, max_bytes=MAX_PAGE_BYTES, content_types=XML_TYPES
            )
        except _DocumentError as problem:
            raise source_unavailable(detail=f"record XML: {problem.reason}") from problem
        record = parse_call_for_tenders(record_doc.body)

        downloads: list[Download] = []
        wanted: dict[str, bool] = {"pcap": True, "ppt": False}  # kind -> required
        for source in record.documents:
            take = source.kind in wanted and _looks_pdf(source.label)
            if not take:
                downloads.append(Download(source, None, "not_requested", None, None))
                continue
            if not is_allowed(source.url, DOCUMENT_PATHS):
                downloads.append(Download(source, None, "other_host", None, None))
                continue
            downloads.append(_download(client, source, required=wanted.pop(source.kind)))
        if not any(item.body is not None for item in downloads):
            raise ApiError(
                422,
                "no_documents",
                "no PCAP or PPT in PDF could be downloaded",
                [f"{d.source.label}: {d.reason}" for d in downloads][:30],
            )
    return FetchedTender(
        ref=ref,
        page=page,
        record=record,
        record_url=record_doc.url,
        record_bytes=record_doc.body,
        record_sha256=hashlib.sha256(record_doc.body).hexdigest(),
        retrieved_at=record_doc.retrieved_at,
        downloads=downloads,
    )


# ---------------------------------------------------------------- persistence


@dataclass
class PendingWrite:
    path: Path
    body: bytes
    document_id: str | None = None
    tender_id: str | None = None
    sha256: str | None = None


def find_existing(session: Session, ref: TenderRef) -> models.Tender | None:
    """Same tender already here: imported (feed key) or an own tender with this link."""
    return session.scalars(
        select(models.Tender)
        .where(
            or_(
                (models.Tender.feed_id == FEED_ID) & (models.Tender.atom_id == ref.id_evl),
                models.Tender.feed_id.in_(("local", FEED_ID))
                & (models.Tender.source_url == ref.source_url),
            )
        )
        .order_by(models.Tender.feed_id.desc())
    ).first()


def _evidence(fetched: FetchedTender) -> list[dict[str, str]]:
    updated = fetched.record.issued_at or fetched.retrieved_at
    items = [
        {
            "key": key,
            "source_url": fetched.record_url[:3000],
            "snapshot_sha256": fetched.record_sha256,
            "field_path": xpath,
            "raw_value": raw[:2000],
            "source_updated_at": updated,
        }
        for key, (xpath, raw) in fetched.record.evidence_paths.items()
    ]
    if fetched.page.estado:
        items.append(
            {
                "key": "status_raw",
                "source_url": fetched.ref.source_url,
                "snapshot_sha256": "",
                "field_path": "html:span[id$=text_Estado]",
                "raw_value": fetched.page.estado[:2000],
                "source_updated_at": fetched.retrieved_at,
            }
        )
    return items[:30]


def persist_import(session: Session, fetched: FetchedTender) -> tuple[str, list[PendingWrite]]:
    """Create tender + scope + notice snapshot + documents in the open transaction.

    Returns the new tender id and the byte writes the caller performs after the idempotency
    record is stored (same ordering as manual upload). Any validation error
    propagates and the session rolls back as a whole.
    """
    record = fetched.record
    storage_root = get_settings().storage_path.resolve()
    tender_id = uuid.uuid4().hex
    scope_id = f"{tender_id}-whole"
    session.add(
        models.Tender(
            id=tender_id,
            feed_id=FEED_ID,
            atom_id=fetched.ref.id_evl,
            external_id=record.external_id,
            title=record.title,
            source_url=fetched.ref.source_url,
            source_updated_at=record.issued_at or fetched.retrieved_at,
            metadata_json={
                "contracting_body": record.contracting_body,
                "cpv_codes": record.cpv_codes,
                "status_raw": fetched.page.estado[:40],
                "deadline_literal": record.deadline_literal,
                "deadline_at": record.deadline_at,
                "pbl_gross": record.pbl_gross,
                "estimated_value": record.estimated_value,
                "quality_flags": [*record.quality_flags, "tax_kind_not_published"],
                "metadata_evidence": _evidence(fetched),
                "source_record": {
                    "url": fetched.record_url,
                    "sha256": fetched.record_sha256,
                    "retrieved_at": fetched.retrieved_at,
                },
                "source_documents": [],
            },
        )
    )
    session.flush()  # unique (feed_id, atom_id): a concurrent duplicate fails here
    session.add(
        models.Scope(
            id=scope_id,
            tender_id=tender_id,
            lot_key="__whole__",
            basis_json=intake_service.build_basis_json(
                scope_id=scope_id,
                pbl_net=record.pbl_net,
                pbl_gross=record.pbl_gross,
                tax_kind="unknown",
                period_months=record.period_months,
                currency=record.currency,
            ),
            budget_net_cents=intake_service.money_cents(record.pbl_net),
        )
    )
    raw_rel = f"raw/placsp/{fetched.record_sha256}.xml"
    session.add(
        models.NoticeVersion(
            id=uuid.uuid4().hex,
            tender_id=tender_id,
            updated_utc=record.issued_at or fetched.retrieved_at,
            raw_sha256=fetched.record_sha256,
            blob_path=raw_rel,
            retrieved_at=fetched.retrieved_at,
            source_url=fetched.record_url,
            tombstone=0,
        )
    )
    session.flush()
    writes = [PendingWrite(storage_root / raw_rel, fetched.record_bytes)]
    listing: list[dict[str, Any]] = []
    for item in fetched.downloads:
        entry: dict[str, Any] = {
            "kind": item.source.kind,
            "label": item.source.label,
            "source_url": item.source.url[:3000],
            "status": "not_downloaded",
            "reason": item.reason,
            "size_bytes": item.size_bytes,
            "pages_count": None,
            "document_id": None,
            "hash_verified": item.hash_verified,
        }
        if item.body is not None:
            try:
                staged, blob_abs = intake_service.stage_document_upload(
                    session,
                    tender_id,
                    item.body,
                    item.source.label,
                    item.source.kind,
                    source_url=item.source.url[:3000],
                    rights_status=RIGHTS_OFFICIAL_DOWNLOAD,
                )
            except pdf_service.PdfError as exc:
                too_big = exc.code in ("pdf_too_large", "pdf_too_many_pages")
                if item.source.kind == "pcap":
                    if too_big:
                        raise document_too_large(item.source.label, item.size_bytes) from exc
                    raise
                entry["reason"] = "too_many_pages" if too_big else "unreadable"
            else:
                entry.update(
                    status="downloaded",
                    reason=None,
                    pages_count=staged["pages_count"],
                    document_id=staged["id"],
                )
                writes.append(
                    PendingWrite(
                        blob_abs, item.body, str(staged["id"]), tender_id, str(staged["sha256"])
                    )
                )
        listing.append(entry)
    if not any(entry["status"] == "downloaded" for entry in listing):
        raise ApiError(
            422,
            "no_documents",
            "no downloaded document passed validation",
            [f"{e['label']}: {e['reason']}" for e in listing][:30],
        )
    tender = session.get(models.Tender, tender_id)
    if tender is not None:
        tender.metadata_json = {**tender.metadata_json, "source_documents": listing}
    session.flush()
    return tender_id, writes


def import_payload(session: Session, tender_id: str, *, already_imported: bool) -> dict[str, Any]:
    """TenderImport body for a new or linked tender (same shape both ways)."""
    tender = session.get(models.Tender, tender_id)
    if tender is None:
        raise ApiError(404, "tender_not_found", f"unknown tender {tender_id}")
    meta = tender.metadata_json if isinstance(tender.metadata_json, dict) else {}
    record = meta.get("source_record")
    record = record if isinstance(record, dict) else {}
    listing = meta.get("source_documents")
    if not isinstance(listing, list):
        listing = _listing_from_documents(session, tender_id)
    return {
        "tender": workspace_service.tender_to_dict(session, tender_id),
        "already_imported": already_imported,
        "record_url": record.get("url"),
        "record_sha256": record.get("sha256"),
        "retrieved_at": record.get("retrieved_at"),
        "documents": listing[:50],
    }


def _listing_from_documents(session: Session, tender_id: str) -> list[dict[str, Any]]:
    """Linked own tender without an import record: describe its stored PDFs."""
    root = get_settings().storage_path.resolve()
    docs = session.scalars(
        select(models.Document).where(models.Document.tender_id == tender_id)
    ).all()
    listing: list[dict[str, Any]] = []
    for doc in docs:
        blob = (root / doc.blob_path).resolve() if doc.blob_path else None
        size = (
            blob.stat().st_size
            if blob is not None and blob.is_relative_to(root) and blob.is_file()
            else None
        )
        listing.append(
            {
                "kind": doc.kind,
                "label": doc.display_name,
                "source_url": doc.source_url or "",
                "status": "downloaded",
                "reason": None,
                "size_bytes": size,
                "pages_count": doc.pages_count,
                "document_id": doc.id,
                "hash_verified": None,
            }
        )
    return listing


def write_pending(writes: list[PendingWrite]) -> None:
    """Write snapshot + PDF bytes, then render PDFs (render never fails the import)."""
    storage_root = get_settings().storage_path.resolve()
    for item in writes:
        item.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            item.path.write_bytes(item.body)
        except OSError:
            item.path.unlink(missing_ok=True)
            raise
    for item in writes:
        if item.document_id and item.tender_id and item.sha256:
            intake_service.render_staged_upload(
                storage_root, item.tender_id, item.document_id, item.body, item.sha256
            )


__all__ = [
    "FEED_ID",
    "PlacspClient",
    "TenderRef",
    "fetch_tender",
    "find_existing",
    "get_client",
    "import_payload",
    "is_allowed",
    "parse_call_for_tenders",
    "parse_detail_page",
    "parse_reference",
    "persist_import",
    "write_pending",
]
