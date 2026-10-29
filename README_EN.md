# BidLab — Source-grounded tender intelligence for better bids (EN)

BidLab helps an SME decide whether to bid: a tender library, a requirements
matrix with page-localized citations, and a Pricing Lab whose points, anomaly
flags and curves come from a deterministic Python engine. The LLM proposes
structure and citations; arithmetic, eligibility and abnormality live in pure
domain code. Money and points are `Decimal`; the API speaks strings; the
frontend holds no authoritative formula. Gates are local via
`scripts/verify.py` (no remote CI, author's decision).

P0 case: **2026/00006554N** (Tías technical-assistance tender), net budget
EUR 118,336, 49 price points, inverse-proportional rule (PCAP p.10),
abnormality rule (PCAP p.20).

## Run (clean install)

```sh
uv sync --all-packages
npm install
npx playwright install chromium   # only for test:e2e / full verify.py
npm run build -w apps/web
python scripts/demo.py --reset-demo
```

Open <http://127.0.0.1:8000/> (API + built frontend, same origin).
`npm run dev -w apps/web` (port 5173) is only for frontend development.
No keys or network needed for the offline demo. Live Meta extraction is
opt-in (`MODEL_API_KEY`, see README.md Configuración).

## Verify

```sh
python scripts/verify.py            # all gates; exit 0 = green
```

Status 29-oct-2026 @cca2f72: backend 556 + 2 skipped · web 252 ·
E2E 85 (Chromium, hermetic) · verify.py 10/10 ALL CHECKS PASSED.
Detail: [verification-log](docs/verification-log.md) (Spanish).

## Honest limits

- Example badge **Datos de ejemplo** = hand-reviewed seed figures, not live
  extraction. Own tenders show **Tus datos**. Live tokens `null`.
- Without all real offers, scenarios are declared hypotheses; no award
  predictor, no rival distribution.
- `unknown` is `null`, never zero; pending rules block points; abnormality
  is a presumption, never an automatic exclusion.
- No live Meta in the UI (backend smoke only); synthetic company and rivals.
- Simulation based on stated assumptions: not legal advice, not an award
  prediction.

## Docs and submission

- Demo pack (shots, 5-minute guide, honest limits): [docs/demo/](docs/demo/).
- V2 evidence shots: [docs/v2-shots/](docs/v2-shots/).
- Demo runbook: [docs/DEMO_RUNBOOK_V2.md](docs/DEMO_RUNBOOK_V2.md).
- Submission draft (claims with evidence): [docs/submission-draft.md](docs/submission-draft.md).
- Full docs are in Spanish under `docs/` (PRD, ARCHITECTURE, API_CONTRACT…).
