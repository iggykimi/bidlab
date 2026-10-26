# BidLab blockers

- B01 (G0, external/author): admission, accepted rules version and credit
  claim/balance unverified. Code work continues; no submission or eligibility
  claims until the author confirms.
- B02 (G3, RESOLVED 26oct): Meta smoke PASS, real inference muse-spark-1.3,
  250 tokens, 1647 ms. Author key arrived as `MUSE_API`; wired explicitly to
  `MODEL_API_KEY` in the gitignored `.env` (both lines kept). No silent
  fallback in the app: only `MODEL_API_KEY` counts.
- B03 (env): system Python lacks `jsonschema`; use the project venv for
  validation scripts.
- B04 (rights): `evidence/originals/` excluded from the repo per
  `docs/publication-manifest.json` (pending review). The app must run from the
  curated seed only, never from those files.
- B05 (platform): Orca orchestration unavailable here; using native subagents
  (verified working) with sequential lead integration. Writer helpers get
  worktrees only if isolation proves available; readers share the checkout.
