# BidLab × Meta: generation 12/12 (EVALUATED 30-oct-2026, contributor)

Doc purpose: stop unproven Meta claims. Evidence lives only
in `evidence/private/` (gitignored; SHAs below for the record).

## Current status

- Repository HEAD (live run): `74dca62` (code) — offline freeze `ffa7c78`.
- Execution date (UTC): 2026-10-30 06:47–06:54 (waves 07:47–07:54 local).
- Status: EVALUATED 12/12, human-reviewed.
- Model/endpoint: muse-spark-1.3-contributor / Meta Model API
  Chat Completions (`https://api.meta.ai/v1/chat/completions`).
- Account: Contributor (trains on content) — author authorized 30-oct;
  corpus is 100% synthetic author-created, 0 private PDFs.
- Scope: 12 synthetic cases, 0 private PDFs.
- Live extractions executed: 12/12 ok (15 attempts: 2 truncated at
  the old 4096 cap, 1 retried ok at 4096, 1 retried ok at 8192).
- Preflight: strict PASS (23 props, depth 3) before every wave.
- Jury re-runnable subset: 0/12 (needs the author's key; corpus +
  gold are public, attempts and scorecard stay private).
- Scorecard (exact counters, `evidence/private/scorecard.json`):
  evaluated 12, blocked 0, TP 18, FP 0, FN 0,
  field precision 1.0, field recall 1.0,
  citations claimed 18, human-verified 18 (17 vs PDF text + S06
  vs render), critical errors 0.
- Key hygiene: S08 + all 12 attempts scanned for key fragments —
  clean. Key lived in process env only, never in files/logs/git.

## Budget and spend (receipts, contributor rates 0.10/0.20 USD per M)

- META_BUDGET_USD_TOTAL: 20. Spent total: 0.016680 (15 attempts).
- Daily cap agreed: 5. Generation-1 set (12 ok): 0.013086.
- Latency: avg 29131 ms, max 43729 ms (S10).
- Cached input tokens observed (753–3697 on 4 cases); the app
  estimator ignores cached tokens, so every figure above is a
  conservative upper bound. Provider-side limits govern regardless.
- Generation-0 (29-oct): 0/12 BLOCKED (no key/consent/budget) —
  superseded by this run. V2 smoke stays separate.

## Artifacts (all under `evidence/private/`, gitignored)

- `live_run_1/`: 10 ok attempts + 2 truncation records + 12 renders.
- `live_run_1_retry1/`: S06 ok + S11 truncation record.
- `live_run_1_retry2/`: S11 ok (8192 cap).
- `annotations.json`: 12 evaluated, human transcription of verified
  claims (latency + cost per case from receipts).
- `scorecard.json`: exact scorer output (no inference).
- Attempt files carry: pages/text+image SHAs, prompt messages
  (images by reference), payload identity, proposal, receipt
  (usage/cost/latency/provider id), finish reason. No key material.

## Live-runner checklist (generation 1)

- [x] Key present only via `MODEL_API_KEY` process env (never files).
- [x] Author consent + budget recorded in chat 30-oct (20/5, 12/12).
- [x] Prompt/hash and page manifests match gold SHAs (asserted per case).
- [x] Preflight passes on the sent schema (`strict`, every wave).
- [x] All pages observed; S06 verified against the render PNG.
- [x] Receipts and scorecard copied under `evidence/private/`.
- [ ] Shots re-captured at the frozen head and linked here (V6 jury
      shots are offline UI + corpus renders, no live run attributed).
