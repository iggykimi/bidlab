# BidLab — coding-agent notes

Maintenance guide for agents working on this repo. It governs code work;
it is not material for any jury. Precedence: PRD for scope, RULE_ENGINE
for math and states, API_CONTRACT for transport, DATA_MODELS/SQL for
persistence, SOURCE_AUDIT for verified facts. On conflict, log a decision
and fix the related documents before coding.

## Current product

React/TypeScript/Vite UI (Tailwind v4 CSS, hand-rolled SVG charts) +
FastAPI backend, domain logic in pure Python (Decimal), SQLite WAL
single process on loopback. PDF text via pypdf, page renders via
PyMuPDF served as backend PNGs (no PDF.js, no recharts at runtime).
Meta document adapter is opt-in backend code; the offline demo needs
no keys. See `docs/ARCHITECTURE.md` (CURRENT IMPLEMENTATION is
authoritative) and `docs/REVIEWER_GUIDE.md` for the honest state.

P0 scope (done, keep green): reviewed Tías example (golden 10/15 case)
+ full own-tender offline journey (create + PDF + company + analysis +
manual review + simulate + compare + export).

## Code paths and ownership

- `apps/api/bidlab/domain/` + `services/evaluation.py`: deterministic
  engine. `services/`: jobs, compare, stress, frontier, render, intake.
- `apps/api/bidlab/api/`: routes; `docs/API_CONTRACT.yaml` is generated
  from `tools/build_contract.py` (never hand-edit generated files).
- `apps/web/src/features/`: `workspace`, `pricing`, `report`, `review`,
  `evidence`, `intake`, `company`, `library`. Styles in `styles.css`.
- `tests/e2e/`: hermetic Playwright specs (loopback-only guard).
- `scripts/`: `verify.py` (gates), `demo.py`, `demo_story.py`,
  `bench_pdf_intake.py`, `compare_extraction.py`, `demo-shots/`.
- `docs/`: specs + `verification-log.md`, `QA_REPORT_V*.md`,
  `DECISION_LOG_V*.md`, `META_EVIDENCE_V*.md`, `CHANGELOG_IMPLEMENTACION_V*.md`.

## Verify commands

```sh
python scripts/verify.py            # all gates; exit 0 = green
python -m pytest apps/api -p no:warnings
npm run test:unit -w apps/web -- --run
npm run lint && npm run typecheck && npm run build -w apps/web
python -m ruff check . && python -m ruff format --check .
python -m mypy apps/api
```

Run focused tests per change, then the full gate before finishing.
Log runs in `docs/verification-log.md` (date, command, exit code,
commit, evidence). FAIL is FAIL; BLOCKED/SKIPPED are not PASS. Never
change oracles or tests to hide bugs. A video only exists once recorded.

## Non-negotiable invariants

- No RAG chatbot as the product, no vector DB, no win predictor, no
  collection of current confidential prices.
- The LLM proposes structure and citations; arithmetic, eligibility and
  abnormality live in pure Python. No `eval`/`exec`/LLM code: templates
  and whitelisted AST only. Money, ratios and points in Decimal; API
  speaks strings; amounts persisted in cents. The frontend holds no
  authoritative formula and never recomputes one.
- Localized citation and semantic review are distinct states. Pending
  rule or scope blocks points. Unknown is null, never zero.
- Anomaly is a conditional presumption (possible justification), never
  an automatic exclusion. Never apply art.85 universally or mix PCAP
  variants.
- Without all real offers, scenarios are declared hypotheses. Never
  present awards as a rival distribution; never fabricate samples.
- Preserve document, source, version, hash and page. No portal crawler:
  expressly published official resources or local upload only.
- No secrets in frontend, logs or fixtures. `MODEL_API_KEY` belongs to
  the app runtime, `META_API_KEY` to the CLI environment.
- Offline demo labelled Datos de ejemplo (Tus datos on own tenders).
  No fake API animations or logs. Tokens null for fixture/manual.
- No live Meta in the UI (backend smoke only); synthetic company and
  rivals; no prediction, no automatic legal exclusion.

## Work protocol

- Inspect `git status`, HEAD, current tests and docs before editing.
  Minimal diffs tied to acceptance criteria; no second TS engine.
- Regenerate real UI screenshots for visual changes
  (`scripts/demo-shots/`); never commit mockups as captures.
- Keep docs consistent: no test figures without commit, no live claims
  without receipts, no stale root documents contradicting the build.
- Ask only for unverifiable access/secrets and unauthorized irreversible
  decisions. On external blockers, document and continue independently.
- Spending needs the author's applicable balance; never enable extra
  payments to unblock. Pause before any agreed ceiling.

## Commits and publishing

- Standing author order: commit and push per wave on `main`
  (see `docs/DECISION_LOG_V2.md` D-V2-8). Clear local commits; never
  amend/reset others' work. Tags, releases, hosting, originals and the
  candidacy itself need the author's explicit final authorization.
- Never contact organizers or third parties on your own. Report
  PASS/FAIL/BLOCKED with real commands, limits and debts; do not
  self-score.
