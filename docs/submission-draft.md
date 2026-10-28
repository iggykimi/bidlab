# BidLab — hackathon submission draft

Status: DRAFT. NOT SENT. Do NOT publish or send. The author reviews every field and sends from their own account. Language, video, and rules fields stay NC until the accepted official rules are checked.

## Story

**Understand the rule. Compare the trade-off. Keep the decision.**

A small supplier reads a real tender. They check what each requirement asks. They compare what each discount costs in profit and gains in points. They keep the decision with its sources.

## Hook (conditional)

Verified hook (use this one). A 15 % discount reaches 49.0000 price points. But it keeps 11,833.60 EUR less profit than 5 % (10,585.60 vs 22,419.20). Is the deeper discount worth it? Profits: `fixtures/demo/expected.json`. Points: E2E E03 (`tests/e2e/e03-e06-pricing.spec.ts`).

Verified hook (repo-side, 27-oct). "Would you give up 5,916.80 EUR for the same price score?" The 10 % case scores 49/49 at 106,502.40 EUR price and 16,502.40 EUR profit under stated synthetic hypotheses (cost 90,000 EUR, rivals as seeded). Sources: `apps/api/tests/integration/test_compare.py` golden + `tests/e2e/compare.spec.ts` CMP-02. Always paired with the synthetic-hypotheses label.

## Title

BidLab — Understand the rule. Compare the trade-off. Keep the decision.

## Short description (≤ 500 chars)

BidLab turns the real Spanish tender PAI Tías 2026/00006554N (net budget 118,336 EUR, 49 price points) into a reviewable bid lab: page-cited requirements, price scenarios under explicit hypotheses from a deterministic engine, and an exportable report with sources. No win prediction. No confidential rival data.

## What it does

- Loads the real Tías tender into a local library and workspace (Summary, Requirements, Pricing Lab, Evidence, Report).
- Shows each requirement with its verdict (met / not met / unknown) and page evidence. The technical threshold stays unknown with its quote on PCAP p. 6.
- Pricing Lab: own discount slider (0–40 %), two hypothetical rivals A/B, KPIs (price, profit/margin, scenario points, anomaly presumption), price–points curve, step-by-step trace, declared assumptions. All numbers come from the Python backend as decimal strings. The frontend computes nothing.
- Anomaly verdict is a conditional presumption ("possible justification required"), never an automatic exclusion.
- Saves immutable scenarios (64-hex snapshot hash, survives reload). Compares 2–3 scenarios side by side with backend Decimal deltas (price, profit, points, cost per point) and plain-language trade-off/dominance verdicts.
- Own-tender intake: manual tender creation plus PDF upload (validated, stored locally); company cost editing with revision-conflict handling.
- Exports an HTML report with decision, note, pendings, hypotheses, sources, and rule ids. User note HTML is escaped. The export contains no secrets.
- Guided tour (`?tour=1`): four real-DOM verified steps (load demo, 15 % rebate, save proof, draft decision); stops honestly at the first unverified step. Pinned by `tests/e2e/tour.spec.ts`.
- Stress mesh: declared discount grid × rival hypotheses over the deterministic engine with frozen context; unknown cells never selected, anomaly only warns. Contracted (`/stress-tests`) and pinned by `tests/e2e/stress.spec.ts`.

## Meta models usage (only what really ran)

- Model: muse-spark-1.3.
- Real evidence: `evidence/meta_smoke_status.json` — status PASS, HTTP 200, executed_inference true, checked 2026-10-26T19:05:43Z, usage 14 prompt + 236 completion tokens (222 reasoning, 0 cached), 250 total, 1647 ms, provider_request_id da5dbf70-cf11-436d-910a-e3140e4caa8b.
- Backend analysis pipeline exists (POST /analysis → job → verified citations). It returns honest 503 provider_not_configured without a key. Unit and integration tests cover it with an explicitly labelled offline stub (fixture_stub).
- NOT claimed: live document extraction in the demo UI is pending. The demo runs on a manually curated seed labelled "Demo curada". The frontend "live analysis" button truthfully reports unavailability (E09). G3 is partial: smoke green, real extraction pending.

## Verification (real runs, Windows)

- `scripts/verify.py`: 10/10 ALL CHECKS PASSED, exit 0, observed 28-oct-2026 (deps, pytest-unit, pytest-integration-contracts, lint, typecheck, build, test-unit, ruff, mypy, playwright-e2e).
- Backend: 333 tests passing (220 unit + 113 integration/contracts), exit 0, observed 28-oct. Web: 202 unit tests passing (25 files, vitest exit 0, observed 28-oct). Ruff, mypy, tsc, eslint and vite build clean, observed 28-oct.
- Playwright E2E: 62/62 green (hermetic per-run storage), observed 28-oct. Specs run on real local API + web, Chromium, every spec guarded to loopback-only traffic (0 external calls).
- CI (GitHub Actions, incl. Playwright): green on b00dda8 pre-round-2; final push pending confirmation (single push, CI-minutes budget).
- Demo oracles: `fixtures/demo/expected.json` (cost 90000.00, rivals 106502.40 / 110052.48; 5/15/30 % cases; anomaly possible_justification_required at 30 %).
- Detail: `docs/verification-log.md`.

## Claim labels (per `BidLab_Revision_UX_2026-10-27/submission/CLAIMS.json`)

| # | Claim | Label | Source |
|---|---|---|---|
| C01 | Engine calculates price, profit, price score, conditional anomaly | OBSERVED | verification-log T09–T12, T22; E03–E05 |
| C02 | 10 % vs 15 %: same 49 points, 5,916.80 EUR profit gap | OBSERVED | `test_compare.py` golden + `compare.spec.ts` CMP-02 |
| C03 | Minimal real Meta inference on record | OBSERVED (minimal) | `evidence/meta_smoke_status.json`, 2026-10-26T19:05:43Z |
| C04 | Document → Meta extraction → reviewed rule → simulator, end to end in UI | NOT VERIFIED | Demo uses curated seed; live button reports E09 |
| C05 | Guided tour in app (?tour=1, verified steps) | OBSERVED | `tests/e2e/tour.spec.ts` + `apps/web/src/tour/` |
| C10 | Animated comparison in app | PROPOSED | Not implemented; do not script or claim (repo-side id, 28-oct; not in UX CLAIMS.json) |
| C06 | Work survives navigation and reload | OBSERVED | E07 + UX-01/UX-02 (drafts) + cost draft |
| C07 | Commercial superiority or exclusive feature | NOT CLAIMED | No comparative test exists |
| C08 | Win probability or optimal bid across all criteria | NOT CLAIMED | Engine covers price only; no predictor |
| C09 | 180 s video as official requirement | NOT CONFIRMED | User target only; check accepted rules |

## Limits (stated honestly)

- One real tender fully modelled. Company cost and rivals are synthetic hypotheses, always labelled.
- No national search, no OCR, no win prediction, no probability rankings.
- Rule engine covers proportional-inverse + reviewed DSL templates only. Unsupported formulas yield score unknown.
- "Nueva licitación" creates own tenders and stores PDFs (`intake.spec.ts`); one-click extraction-review from an upload is not wired yet.
- Original PDFs are research copies, not redistributed (publication-manifest flags). The report embeds citations and links, not full private documents.
- Unnarrated real footage recorded 28-oct (`docs/demo/footage-oro-20261028.webm`, gold flow). Narrated ≤180 s video pending author. Duration, language, and format per official rules (NC).

## Links

- Repo: https://github.com/iggykimi/bidlab (public, main).
- Demo video (≤180 s target): NC (narrate over `docs/demo/footage-oro-20261028.webm` or re-record from `docs/demo-script-180s.md` after author review).
- Live demo URL: NC — local-only app; no localhost URL presented as public.
- Report sample: generated locally via Export (see E08), not hosted.
- Submission portal: NC — no form URL invented; the author maps these fields to the real form.

## Declarations

- Code is the team's own. Official tender documents are attributed third-party material, not team-authored.
- No secrets in repo, logs, or fixtures (.env never tracked).
- No organizer contact made by the agent.
- No submission sent. This file is preparation only.
