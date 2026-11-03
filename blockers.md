# BidLab blockers

## 2026-11-03 — PLACSP document downloads rejected (EXTERNAL, open)

`POST /api/v1/tenders/import` on the default Munilla tender (5/2026) fails with
`source_unavailable`, detail `record XML: unexpected_type`.

Diagnosis: the tender detail page still loads (expediente found, document rows
parsed), but the Plataforma's `GetDocumentByIdServlet` answers the record XML
with `200 text/html` and a "Request Rejected" WAF page instead of the CODICE
document. Our client identifies honestly as
`BidLab/1.0 (single user-initiated tender import)`; we do not impersonate a
browser to bypass the filter.

Impact: live capture test 1 (import → consent → Muse Spark proposals →
evidence) cannot refresh its 4 shots (`live-import`, `live-consent`,
`live-proposal`, `live-evidence` still show the pre-hierarchy UI from 30-oct).
Live test 2 (clarification + voice) passed and its 5 shots are current.

Next: retry the import later in case the WAF block is transient, or pick
another open tender via `BIDLAB_PLACSP_URL`. Two bounded attempts were made on
2026-11-03 (~21:45 and ~21:55 CET); both failed identically.
