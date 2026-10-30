# BidLab — reviewer guide

Every claim in the README maps to code, a test or an explicit limit. This page is the index.

## In 30 seconds

A small firm must decide whether it can bid on a public tender and how much margin to give up for price points. BidLab lets Meta's Muse Spark read the tender and propose requirements with page citations, keeps a person in charge of approving them, and computes every price, point and risk flag in a deterministic Python engine. The curated example (Tías, 2026/00006554N) shows a 10 % and a 15 % discount both scoring 49/49 price points, with the 10 % bid keeping €5,916.80 more hypothetical profit.

![Pricing screen](demo/02-precio.png)

## Claims and where to check them

| Claim | Source of truth | Check |
|---|---|---|
| The 10 % / 15 % result | demo fixture + backend comparator | [`tests/integration/test_compare.py`](../apps/api/tests/integration/test_compare.py), [`tests/e2e/compare.spec.ts`](../tests/e2e/compare.spec.ts) |
| Money and points in `Decimal`, formulas as whitelisted AST | [`domain/`](../apps/api/bidlab/domain) | unit oracle tests in `apps/api/tests/unit/` (`test_scoring.py`, `test_expressions.py`, `test_money.py`) |
| A citation is not an approval | review states in [RULE_ENGINE](RULE_ENGINE.md) | `test_review*.py`, [`EvidenceDrawer.tsx`](../apps/web/src/features/evidence/EvidenceDrawer.tsx) |
| Muse Spark extraction is bounded, schema-strict and bound to the pages sent | [`meta_adapter.py`](../apps/api/bidlab/services/meta_adapter.py), [`meta_schema_preflight.py`](../apps/api/bidlab/services/meta_schema_preflight.py) | `test_meta_adapter.py`, `test_meta_schema_preflight.py`, `test_jobs.py` |
| Live extraction ran: 12/12 adversarial cases, 18/18 figures verified, $0.013 | [META_EVIDENCE](META_EVIDENCE.md) | corpus + gold in [`examples/meta_eval_synthetic/`](../examples/meta_eval_synthetic); receipts kept private (they contain prompts) |
| Clarification drafts are grounded in one stored citation | [`clarification.py`](../apps/api/bidlab/services/clarification.py) | [`test_clarifications.py`](../apps/api/tests/integration/test_clarifications.py) |
| Voice answers only use numbers returned by engine tools | [`assistant.py`](../apps/api/bidlab/services/assistant.py) | `test_assistant*.py` |
| Spend is reserved before each call and settled after | [`budget.py`](../apps/api/bidlab/services/budget.py) | `test_spend_ledger.py`, `test_cost_ceiling.py` |
| The demo never calls the network | E2E loopback guard in [`tests/e2e/helpers.ts`](../tests/e2e/helpers.ts) | every E2E spec asserts zero blocked requests |
| Accessibility | design block in [`styles.css`](../apps/web/src/styles.css) | axe checks in [`qa-visual.spec.ts`](../tests/e2e/qa-visual.spec.ts), layout specs at 390/768/1280 px |

## Deliberate trade-offs

1. **Deterministic engine over model arithmetic.** Supported formula templates instead of arbitrary generated code; unsupported formulas are flagged.
2. **Human review gates.** Proposed, cited and approved are different states; unknown company data stays unknown, never zero.
3. **No win prediction.** Public award data does not identify the distribution of rival bids, so rivals are declared hypotheses.
4. **Immutable snapshots.** Saved trials carry a hash of their full context and only compare within the same context.
5. **Local-first.** Loopback API and SQLite keep it installable in minutes; it is not a hosted multi-user service.

## Run and verify

```bash
uv sync --all-packages && npm install && npm run build
python scripts/demo.py --reset-demo      # http://127.0.0.1:8000/
python scripts/verify.py                 # all gates, exit 0 = green
```

## Limits

- The curated tender is one real example; coverage of arbitrary tenders is not proven.
- Company costs and rival bids in the example are synthetic and labelled as such.
- The abnormal-offer flag is a legal presumption that requires justification, not an exclusion.
- No authentication: run it on your own machine.
