# BidLab × Meta: generation 0/12 (BLOCKED — no inference yet)

Doc purpose: stop unproven Meta claims. Evidence, when it exists, lives only
in `evidence/private/`.

## Current status

- Repository HEAD: `5a5ee35` (V5 freeze commit; V2 smoke stays separate).
- Execution date (UTC): 2026-10-29 (presence check; no inference run).
- Status: BLOCKED / NOT RUN.
- Model/endpoint in code: muse-spark-1.3 / Meta Model API Chat Completions.
- Historical smoke test: see META_EVIDENCE_V2.md (separate proof).
- Reason for BLOCKED: no key (no META_API_KEY/MODEL_API_KEY), no
  META_CONFIRM_LIVE, no budget. Presence-checked 2026-10-29; values
  never printed, no key ever pasted.
- Scope: 12 synthetic cases, 0 private PDFs.
- New synthetic corpus: 12 author-created PDFs; ground truth known;
  model NOT evaluated.
- Live extractions executed: 0/12. Jury re-runnable subset: 0/12.
- E2E document extraction: NOT VERIFIED.
- Demo: curated examples labelled fixture/hand-reviewed; no real Meta
  run attributed.
- Next external requirement: authorized Standard account, live call,
  human grounding review.
- Shots: jury captures for this blocked generation live in
  `evidence/jury/` (2 offline UI + 4 corpus renders, SHAs in
  FINAL_HEAD_VALIDATION); no live run is attributed to them.

## Budget and spend

- META_BUDGET_USD_TOTAL: unset. META_BUDGET_USD_DAILY: unset.
- Spent total: 0. Spent primary attempts: 0. Private jobs executed: 0.
- App-level spend guard exists; provider-side limits govern regardless.

## How this freezes

1. Copy `generation 0/12` template, increment only from counted scorer output.
2. Paste exact `scorecard.json` counters; never infer evaluated cases.
3. Replace placeholders under `evidence/private/`; never claim latent capacity.

## Live-runner checklist (all NOT run)

- [ ] Key present only via `META_API_KEY` env (never chat/CLI/tests).
- [ ] `$META_CONFIRM_LIVE=1` exported for this process only.
- [ ] Prompt/hash and page manifests match this doc's SHAs.
- [ ] Preflight passes on the sent schema (`strict`).
- [ ] All pages observed; images OCR-free PNGs inspected.
- [ ] Receipts and scorecard copied under `evidence/private/`.
- [ ] Shots re-captured at the frozen head and linked here.
