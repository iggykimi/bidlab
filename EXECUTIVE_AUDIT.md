# BidLab — executive status (living document)

> **Product IMPLEMENTED.** This file replaced the 26-oct research snapshot
> (preserved byte-identical at [docs/archive/EXECUTIVE_AUDIT_2026-10-26.md](docs/archive/EXECUTIVE_AUDIT_2026-10-26.md)).
> Start here: [README.md](README.md) · [Reviewer guide](docs/REVIEWER_GUIDE.md)

**Checked:** 2026-10-29 · **Verified code:** `c179813` (V3 `scripts/verify.py` ALL CHECKS PASSED 10/10, exit 0; docs-only P1-06 follows) · **Mode:** local-first demo + opt-in Meta adapter.

## Verdict

BidLab is a working decision lab: from a real tender document to a traceable,
human-reviewed bid decision. The deterministic Python engine (Decimal) computes
price, economic points, conditional anomaly flags and scenario comparisons;
the AI layer proposes structure and page citations but never the arithmetic.
Curated demo figures are hand-reviewed seeds, never presented as live extraction.

## Current capabilities

1. **Library + workspace** over the real Tías tender 2026/00006554N (49 price points).
2. **Pricing Lab**: discount simulator, price/points curve, stress mesh, Pareto frontier.
3. **Evidence**: page-localized citations with provenance; citation ≠ approved rule.
4. **Human review gates**: pending rules block points; unknown stays null, never zero.
5. **Reports**: immutable scenario snapshots + printable HTML with sources and assumptions.

## Status table

| Area | State | Evidence |
|---|---|---|
| App (API + web + E2E) | IMPLEMENTED | Repo tree; `scripts/verify.py` 10/10 |
| Golden case 10/15 (49,0 + 5.916,80 €) | VERIFIED LOCALLY | `test_compare.py`, `compare.spec.ts`, `demo_story.py` MATCH |
| QA figures 565/259/98 | VERIFIED LOCALLY | `scripts/verify.py` @`c179813`; [V3 changelog](docs/CHANGELOG_IMPLEMENTACION_V3.md) (V2 figures stay in `docs/QA_REPORT_V2.md` @`264712f`) |
| Meta smoke (minimal inference) | VERIFIED LOCALLY | `evidence/meta_smoke_status.json` (26-oct) |
| Live end-to-end extraction | BLOCKED EXTERNAL | No key/admission/balance; 0 live calls (`docs/META_EVIDENCE_V2.md`) |
| Demo video / submission | BLOCKED EXTERNAL | Author's; script v5 ready |
| Win prediction, multi-user SaaS, CI badge | NOT CLAIMED | Explicitly out of scope |

## Limits

Synthetic company costs and rival bids in the demo; unknown tolerated as null;
anomaly is a presumption (possible justification), never an automatic exclusion;
originals not redistributed; loopback + SQLite single process, no public auth.

Historical research, event rules and credit notes: see the archived snapshot above.
