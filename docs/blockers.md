# BidLab blockers

- B01 (G0, external/author): admission, accepted rules version and credit
  claim/balance unverified. Code work continues; no submission or eligibility
  claims until the author confirms.
- B02 (G3, pending action): Meta smoke not run yet. Needs `MODEL_API_KEY`
  from the author `.env`. Attempt in T03 with bounded consumption; record the
  real result (PASS or BLOCKED, never fixture-as-live).
- B03 (env): system Python lacks `jsonschema`; use the project venv for
  validation scripts.
- B04 (rights): `evidence/originals/` excluded from the repo per
  `docs/publication-manifest.json` (pending review). The app must run from the
  curated seed only, never from those files.
- B05 (platform): Orca orchestration unavailable here; using native subagents
  (verified working) with sequential lead integration. Writer helpers get
  worktrees only if isolation proves available; readers share the checkout.
