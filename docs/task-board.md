# BidLab task board (from examples/tasks.csv)

Status values: done | in_progress | pending | blocked | parked.
DoD per block in docs/MILESTONES.md; evidence in docs/verification-log.md.

## Gates

- G0 admission/rules/credit: pending (B01, author).
- G1 data/PCAP, G2 feasibility: researched; hashes to re-verify, no redownloads.
- G3 Meta access: pending smoke (B02).
- G4 base/formula: researched (Tías p.10/p.20); engine must still prove oracles.

## P0

| ID | Day | h | Deps | Status | Acceptance |
|----|-----|---|------|--------|------------|
| T01 | 26oct | 1 | — | done | environment.md + board + blockers |
| T02 | 26oct | 0.5 | — | pending | admission/bases check; G0 partial/external |
| T03 | 26oct | 0.5 | T01 | done | real minimal Meta smoke + balance; G3 |
| T04 | 26oct | 0.5 | — | pending | Tías rights/attribution review + manifest |
| T05 | 26oct | 2 | T01 | done | monorepo bootstrap, locks, scripts, empty lint/build |
| T06 | 27oct | 1.5 | T05 | done | models, SQLite/migration, API contract |
| T07 | 27oct | 1.5 | T06 | done | Tías/company/curated-evidence seed + idempotence |
| T08 | 27oct | 1.5 | T07 | pending | library/workspace/document routes |
| T09 | 27oct | 2 | T05 | pending | money, scope, numeric oracles |
| T10 | 28oct | 1.5 | T09 | pending | inverse proportion, safe AST, unknown |
| T11 | 28oct | 3 | T10 | pending | Tías policy 18.5 + abnormality edges |
| T12 | 28oct | 1 | T11 | pending | grouping, hypotheses, non-computable cases |
| T13 | 28oct | 2 | T06 | pending | AND/OR requirements tree + evidence |
| T14 | 29oct | 2 | T06 | pending | safe PDF, page extraction, limits |
| T15 | 29oct | 2 | T14 | pending | citation/text/page verification + gold |
| T16 | 29oct | 2.5 | T03 T15 | pending | Meta adapter, JSON schema, retry/cost/cache |
| T17 | 30oct | 2 | T16 | pending | persisted jobs/restart/idempotence |
| T18 | 30oct | 2 | T13 T15 | pending | semantic review + review audit |
| T19 | 30oct | 2 | T08 | pending | UI layout, states, navigation |
| T20 | 30oct | 1.5 | T19 | pending | library/summary + honest demo badge |
| T21 | 31oct | 2 | T18 T19 | pending | requirements matrix / PDF drawer with sources |
| T22 | 31oct | 2.5 | T10 T19 | pending | Pricing Lab, slider/KPI, backend curve |
| T23 | 31oct | 1.5 | T12 T22 | pending | rival panel + complete fields/groups |
| T24 | 31oct | 1.5 | T21 T22 | pending | calc trace + source links |
| T25 | 1nov | 2 | T24 | pending | HTML/print report + pendings |
| T26 | 1nov | 1.5 | T25 | pending | scenarios/snapshots/persistence + reload |
| T27 | 1nov | 2 | T14 T17 T25 | pending | security controls, origin, secrets, PDF |
| T28 | 2nov | 2 | T17 T26 | pending | integration/contracts + fixes |
| T29 | 2nov | 3 | T28 | pending | Playwright Chromium E01–E12 + offline |
| T30 | 2nov | 2 | T29 | pending | visual QA desktop/mobile + a11y |
| T31 | 3nov | 1.5 | T30 | pending | clean install rehearsal, perf, freeze |
| T32 | 3nov | 1.5 | T31 | pending | reproducible README, licenses, verification |
| T33 | 3nov | 2 | T32 | pending | record 180s demo, verify video |
| T34 | 4nov | 0.5 | T33 T02 T04 | pending | delivery fields/links review; author sends |

## P1 (parked unless P0 solid + time)

H01 ETL ZIP, H02 curated history, H03 gated table/histogram, H04 extra
templates. Cut order per MILESTONES; never cut accuracy, citations,
hypothesis labelling, offline demo or reproducible export.
