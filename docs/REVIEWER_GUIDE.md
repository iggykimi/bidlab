# BidLab — reviewer guide

**Project:** https://github.com/iggykimi/bidlab
**Domain:** public tender analysis and bid pricing decisions
**Scope:** local-first demo plus opt-in Meta document-adapter capability
**Evidence status:** links below refer to current public repo; rerun checks on the submitted revision.

## In 30 seconds

Tender teams face a difficult trade-off: **How much bid margin should we sacrifice for economic points?** BidLab helps them compare prices under explicit assumptions, verify which document rule applies, and preserve a defensible decision record. A model can propose document fields and citations, but the final math and review-state logic remain deterministic.

**Demonstrable case (curated data):** BidLab compares 10% and 15% discounts under synthetic company costs and rival bids for Tías tender 2026/00006554N. Both achieve 49/49 *economic* points; the 10% scenario retains **€5,916.80 more hypothetical profit**. This is not a predicted award outcome or a real competitor-price forecast.

![Pricing screen](demo/02-precio.png)

## Inspect in five minutes

| Question | Evidence and entry point |
|---|---|
| What does the product look like? | [Screenshots and quick tour](demo/README.md) |
| Where is the numerical result defined and verified? | [Backend golden comparison tests](../apps/api/tests/integration/test_compare.py) and [E2E comparison tests](../tests/e2e/compare.spec.ts) |
| Which code governs pricing UI? | [PricingLab.tsx](../apps/web/src/features/pricing/PricingLab.tsx), [CurveChart.tsx](../apps/web/src/features/pricing/CurveChart.tsx), [StressSection.tsx](../apps/web/src/features/pricing/StressSection.tsx) |
| How is evidence distinguished from approval? | [EvidenceDrawer.tsx](../apps/web/src/features/evidence/EvidenceDrawer.tsx), [domain rules](RULE_ENGINE.md), [architecture](ARCHITECTURE.md) |
| How are late/stale stress results handled? | [StressSection.tsx](../apps/web/src/features/pricing/StressSection.tsx) and its unit/E2E tests |
| What architectural tradeoffs were chosen? | [Architecture](ARCHITECTURE.md) and [V2 decision log](DECISION_LOG_V2.md) |
| What did the project actually test? | [V2 QA report](QA_REPORT_V2.md) and [verification log](verification-log.md) |
| What really ran on Meta? | [Meta evidence](META_EVIDENCE_V2.md), including explicit unverified paths |

> **Documentation note:** the 26-oct `EXECUTIVE_AUDIT` research snapshot is
> preserved at [docs/archive/EXECUTIVE_AUDIT_2026-10-26.md](archive/EXECUTIVE_AUDIT_2026-10-26.md);
> the living root [EXECUTIVE_AUDIT.md](../EXECUTIVE_AUDIT.md) is authoritative.

## Evidence index

Every important README claim traces to a source, not to marketing language.

| Claim | Source of truth | Validation | Limit |
|---|---|---|---|
| 10/15 case | demo fixture + backend comparator | golden integration test + E2E compare | synthetic costs/rivals |
| `Decimal` engine | domain services | oracle tests | supported rule schemas |
| Provenance | job/citation/review states | integration + E2E evidence | localized ≠ approved |
| Stale stress | `stressInputKey` + sequence state | out-of-order request tests | input changes need rerun |
| QA V2 | `docs/QA_REPORT_V2.md` | commands + SHA | local run, no remote CI |
| Meta | documented live/smoke evidence | receipts with model + request ID | live doc extraction unproven |
| Security | loopback bind, validations | API tests | no SaaS auth implied |

## Architecture and deliberate trade-offs

1. **Deterministic economic engine:** Python `Decimal` is authoritative for money and scores. React renders values returned by the API, avoiding a second independent calculator. **Trade-off:** supported rule schemas instead of arbitrary LLM-generated code.
2. **Human review gates:** citations, proposed fields, accepted rules and unknown company information are different states. **Trade-off:** an explicit approval step in exchange for auditability.
3. **No invented predictions:** scenario rivals and company costs are declared assumptions. BidLab does not estimate probability of winning from incomplete public results. **Trade-off:** less marketing spectacle; more epistemic integrity.
4. **Reproducible snapshots:** scenario hash and input-revision checks protect conclusions when hypotheses change. **Trade-off:** additional state management; better protection against stale decision displays.
5. **Local-first:** loopback API, SQLite WAL and a single-process architecture keep the demo installable. **Trade-off:** not a production-ready public multi-tenant service. No claim of full auth or horizontal scale.

## Run the demonstration

```bash
uv sync --all-packages
npm install
npm run build
python scripts/demo.py
```

Open http://127.0.0.1:8000/. The curated demonstration should start without Model API credentials. See [README](../README.md) for full environment, build, and testing requirements. For a clean review avoid `--reset-demo` on any storage directory that may contain user data; use an isolated temporary/demo storage.

### Run quality gates

```bash
python scripts/verify.py
```

The [V2 QA report](QA_REPORT_V2.md) reports **557 passed / 2 skipped backend, 252 frontend unit tests and 85 E2E tests**, plus `10/10` verification gates, on its recorded Windows build/commit. These are **project-reported results**, not an independently reproduced claim here. Re-run on the final submitted checkout, preserve real exit codes and update figures if they changed.

## Meta usage — precise boundary

The opt-in Meta integration exists as backend code and documented test paths. The V2 evidence report differentiates:

- a **historical real minimal inference smoke test** using Muse Spark 1.3;
- **offline curated/fixture** paths used to make the reproducible demo available without credentials;
- **end-to-end live document extraction**, which V2 did **not** establish as verified.

Do not conflate these. If the live extraction is completed later, add evidence (document hash, pages actually submitted, model and request ID, response, citations, reviewed claims, latency and tokens) tied to a commit. Do not overwrite or retroactively change what V2 verified.

## Explicit limitations

- The curated tender is an example; model coverage across arbitrary procurement documents is not proven.
- Business costs and hypothetical rival offers in the demonstration are synthetic.
- Other tender categories, OCR coverage, and legal interpretations may be unsupported or require review.
- Potentially abnormal offers require human/legal assessment; the application does not automatically exclude them from a tender.
- The app is local-first, not an authenticated public multi-user service.
- No guaranteed win prediction, no unauthorized competitor data, no fabricated Meta live run.

## Verification principle

Every important claim above is paired with a source path, a reproducible check or an explicit limitation. A reviewer should follow those links and draw their own conclusion. This guide does not request a favorable rating or special treatment.
