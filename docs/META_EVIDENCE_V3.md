# BidLab × Meta: generation 0/12 (BLOCKED — no inference yet)

Doc purpose: stop unproven Meta claims. Evidence, when it exists, lives only
in `evidence/private/`.

## Current status

- Verdict: BLOCKED (no inference, no measurement).
- Scope: 12 synthetic cases, 0 private PDFs.
- Live extractions executed: 0/12. Jury re-runnable subset: 0/12.
- Shots: none captured for this generation (claims require new captures).

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
