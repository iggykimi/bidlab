# BidLab — coding-agent notes

Maintenance guide for agents working on this repo. It governs code work;
it is not material for any jury. Precedence: PRD for scope, RULE_ENGINE
for math and states, API_CONTRACT for transport, DATA_MODELS/SQL for
persistence, SOURCE_AUDIT for verified facts. On conflict, log a decision
and fix the related documents before coding.

## Current product

React/TypeScript/Vite UI (Tailwind v4 CSS, curve charts via recharts 3,
lazy-loaded with their section) + FastAPI backend, domain logic in pure
Python (Decimal), SQLite WAL single process on loopback. PDF text via
pypdf, page renders via PyMuPDF served as backend PNGs (no PDF.js).
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
- `docs/`: public specs (`ARCHITECTURE`, `RULE_ENGINE`, `DATA_MODELS`,
  generated `API_CONTRACT.yaml`, `META_EVIDENCE`, `REVIEWER_GUIDE`, `demo/`).
  `docs/internal/` is the author's local working log (gitignored).
- `video/`: the demo video as code (Playwright captures + Remotion).

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
Log runs in the local `docs/internal/verification-log.md` (date,
command, exit code, commit, evidence). FAIL is FAIL; BLOCKED/SKIPPED are not PASS. Never
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
- Every live Meta call (extraction, clarification drafts, voice) is
  opt-in: consent + key + budget, one attempt, receipt kept. Live
  extraction evidence: `docs/META_EVIDENCE.md` (12/12 synthetic cases).
  Synthetic company and rivals; no prediction, no automatic legal exclusion.

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
  (author decision D-V2-8). Clear local commits; never
  amend/reset others' work. Tags, releases, hosting, originals and the
  candidacy itself need the author's explicit final authorization.
- Never contact organizers or third parties on your own. Report
  PASS/FAIL/BLOCKED with real commands, limits and debts; do not
  self-score.
