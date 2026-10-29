# BidLab Final Head Validation (V5 freeze)

- Date/time UTC: 2026-10-29 20:51 (gates); freeze commit SHA below.
- Branch: main.
- Full HEAD: `5a5ee35602a4d23038000a5de5af5f413a7081d7` (this file lands in the freeze commit).
- Git state at freeze: clean (`git status --short` empty, `git diff --check` exit 0).
- Python 3.14.7 / uv 0.12.5 / Node v26.3.0 / npm 12.0.2 / Playwright 1.64.1 (Chromium, Windows).
- `python scripts/verify.py`: exit 0, ALL CHECKS PASSED 10/10 (backend 588+1s, vitest 260/33, E2E 98/98).
- Shots: `evidence/jury/` 6 PNG (Playwright 1280x720 + PyMuPDF 150 dpi), SHAs below.
- Meta live: BLOCKED (no key/consent/budget; 0 calls; refusal path tested).
- Demo video: pending (author records from a real run; script v5 current).
- Submission URL: none confirmed.
- Known risks and descartes: OPT-01 discarded (no live cached tokens to
  observe; conservative estimate kept as documented upper bound); S08
  key-exfiltration check needs a live run (corpus case ready, 0/12 run);
  Meta docs unreachable from this env on 29-oct (rules = plan-cited +
  own conservative preflight, nothing claimed as re-read).
- Official sources applied: https://dev.meta.ai/docs/overview,
  /structured-output, /image-understanding, /file-handling,
  /pricing-rate-limits, /events/global-hackathon (as cited by the pack
  plan; re-verification from this environment failed, see log).

## Pack integrity

- Pack ZIP SHA-256: 4469799A057AC5134D251BEADAEF293B5C495EDED685FE0CAF96D2130A6400BC
- Manifest files verified: 27/27 (hash + bytes, 2026-10-29).
- Pack self-check reproduced: 16 passed, PACK_ONLY_PASS, 12 PDFs,
  0 evaluated / 12 blocked (system python, PyMuPDF present).

## Real schema gate (META-01)

- `observations_json_schema()` passes strict preflight:
  23 properties, 6 enum values, 343 string chars, 50 nodes,
  max object depth 3 (limits: 5000/10/120000/5000/10).
- Preflight runs inside `build_hybrid_request` before any payload.

## Corpus (PR-4)

- 12 synthetic PDFs + gold at `examples/meta_eval_synthetic/`
  (generated in-repo, self-verified at generation).
- Extraction spot-check: all expected values present in 11 text
  cases; S06-image-only yields 0 text chars by design.
- Template generation verified: 12/12 `blocked`, no accuracy
  (output kept out of git per plan).
- Lote-0 (S9.3): `page_selection` over the frozen corpus selects <=6
  pages per case and covers every gold page (S07: [1,2,3,4,5,8] of 8,
  p8 included; S06: 0 text chars, kept for render). Gold semantics
  read: lots carry distinct scope rule, extensions never 36 as initial,
  S11 net-only, S03 two candidates + conflict, S12 no invented formula.

## Live (PR-5)

- Live extractions executed: 0/12. Reason: BLOCKED — no
  `META_API_KEY`/`MODEL_API_KEY` in environment, no
  `META_CONFIRM_LIVE`, no budget configured (presence-checked
  2026-10-29, values never printed).
- No-key refusal path covered by
  `test_execute_live_without_key_fails_attempt` (green).
- Jury re-runnable subset: 0/12. Spend: 0 USD (all counters).

## Jury shots (fresh at frozen head)

| Shot | SHA-256 | Shows |
|---|---|---|
| evidence/jury/u1-expert-state.png | 9CAEE8AC59C40FF7C41FA489898EF6541D99AC5DC722814CBFDB0DC566A95D71 | Resumen with backend verdict after saving the 10/15 pair |
| evidence/jury/u2-compare-10v15.png | 9CF4C33EC919675B95F2525FBF239D4EA8E3BC62F9C9C894140E86FF8ABAFE0F | Informe compare executed: hero + frontier (10 vs 15) |
| evidence/jury/S07-long-partial-p8.png | 6E63FD2F3D8428ECCC2F8230A37ADC31D81A51A572E46ABA63C1B59D63A0125F | S07 page 8: late relevant value (partial coverage) |
| evidence/jury/S08-injection-p1.png | B3488D0B08B2E501916A5DFF70FA899D5C85BC3239A943F8116A89F3556729A7 | S08 page 1: injection text + real 50000.00 datum |
| evidence/jury/S04-lots-p1.png | 54C09C79750FB72C5247054F543F19557D32346D1FFA2518D86353236BC512B6 | S04 page 1: lots table |
| evidence/jury/S12-ambiguous-formula-p1.png | 7972EA075EA6FC69DBD1489330A3C5E04386322BC6DB29BBA4B207706CEF2E2B | S12 page 1: ambiguous formula text |

UI shots: Playwright + seeded demo + offline guard, 1280x720,
animations disabled. Corpus renders: PyMuPDF 150 dpi from the
frozen corpus bytes. S08 visually inspected.

## Prompt and extractor versions

- PROMPT_VERSION: bidlab-extract-3. SCHEMA_VERSION: 1.0.
- EXTRACTOR_VERSION: bidlab-pdf-1. Render: bidlab-render-1.

## Gates at freeze

Recorded in docs/verification-log.md (verify.py 10/10 + E2E +
backend + vitest + lint/types). No live claims without receipts.
