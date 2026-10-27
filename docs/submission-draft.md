# BidLab — hackathon submission draft (T34)

Status: DRAFT. Do NOT publish or send. Final review and submission are the author's.
Language/video/rules fields are NC until the accepted official rules are checked.

## Title

BidLab — from a real tender document to a traceable bid decision

## Short description (≤ 500 chars)

When an SME must decide whether to bid, BidLab turns the real Spanish tender
PAI Tías 2026/00006554N (net budget 118,336 EUR, 49 price points) into a decision
lab: page-cited requirements instead of scattered PDFs, price/cost/points under
explicit hypotheses from a deterministic engine instead of gut feel, and an
exportable report with sources to defend the call. No win prediction, no
confidential rival data.

## What it does

- Loads the real Tías tender (net budget 118,336 EUR, 49 price points) into a local
  library and workspace (Summary, Requirements, Pricing Lab, Evidence, Report).
- Shows each requirement with its verdict (met / not met / unknown) and page
  evidence: e.g. the technical threshold stays unknown with its quote on PCAP p. 6.
- Pricing Lab: own discount slider (0–40 %), two hypothetical rivals A/B,
  KPIs (price, profit/margin, scenario points, anomaly presumption), price–points
  curve, step-by-step trace, declared assumptions. All numbers come from the
  Python backend as decimal strings; the frontend computes nothing.
- Anomaly verdict is a conditional presumption ("possible justification required"),
  never an automatic exclusion.
- Save immutable scenarios (64-hex snapshot hash, survives reload) and export an
  HTML report with decision, note, pendings, hypotheses, sources and rule ids.
  User note HTML is escaped; the export contains no secrets.

## Meta models usage (only what really ran)

- Model: muse-spark-1.3.
- Real evidence: evidence/meta_smoke_status.json — status PASS, HTTP 200,
  executed_inference true, checked 2026-10-26T19:05:43Z, usage 14 prompt +
  236 completion tokens (222 reasoning, 0 cached), 250 total, 1647 ms,
  provider_request_id da5dbf70-cf11-436d-910a-e3140e4caa8b.
- Backend analysis pipeline exists (POST /analysis → job → verified citations)
  and returns honest 503 provider_not_configured without a key; unit/integration
  covered with an explicitly labelled offline stub (fixture_stub).
- NOT claimed: live document extraction in the demo UI is pending; the demo runs
  on a manually curated seed labelled "Demo curada", and the frontend "live
  analysis" button truthfully reports unavailability (E09). G3 is partial:
  smoke green, real extraction pending.

## Verification (real runs, Windows)

- Playwright E2E E01–E12 + smoke: 14 passed on real local API + web, Chromium,
  every spec guarded to loopback-only traffic (0 external calls).
- Backend: pytest unit + integration + contracts green; ruff and mypy clean.
- Frontend: lint, typecheck, build green; unit tests 8 passed; npm audit 0 vulns.
- Demo oracles: fixtures/demo/expected.json (cost 90000.00, rivals 106502.40 /
  110052.48; 5/15/30 % cases; anomaly possible_justification_required at 30 %).
- Detail: docs/verification-log.md.

## Limits (stated honestly)

- One real tender fully modelled; company and rivals are synthetic hypotheses.
- No national search, no OCR, no win prediction, no probability rankings.
- Rule engine covers proportional-inverse + reviewed DSL templates only;
  unsupported formulas yield score unknown.
- "Add tender" upload button is disabled in this version (no creation endpoint).
- Original PDFs are research copies, not redistributed (publication-manifest
  flags); the report embeds citations and links, not full private documents.
- No video recorded yet; duration/language/format per official rules (NC).

## Links

- Repo: https://github.com/iggykimi/bidlab (public, main).
- Demo video (≤180 s): NC (record from docs/demo-script-180s.md after author review).
- Live demo URL: NC — local-only app; no localhost URL presented as public.
- Report sample: generated locally via Export (see E08), not hosted.

## Declarations

- Code is the team's own; official tender documents are attributed third-party
  material, not team-authored.
- No secrets in repo, logs or fixtures (.env never tracked).
- No organizer contact made by the agent.
