# BidLab environment (T01)

Date: 2026-10-26. Machine: Windows. Repo root: workspace root, branch `main`.

## Toolchain (observed, not assumed)

- Python 3.14.7 (system)
- Node v26.3.0, npm 12.0.2
- uv 0.12.5
- Muse Code 1.4.13
- gh: login `iggykimi` (id 198978748)
- git author: `iggykimi <198978748+iggykimi@users.noreply.github.com>`

## Gaps

- `jsonschema` missing in system Python → `tools/validate_blueprint.py` fails
  there; rerun inside the project venv (T05). No system-wide installs.
- Playwright/Chromium not installed yet → T05/T29.

## Keys (presence only, values never logged)

- `.env` present at workspace root (author-created, gitignored). Content not inspected.
- `MODEL_API_KEY` smoke (T03/G3) pending: run `tools/meta_smoke.py` once with
  bounded consumption and record the real result in `docs/verification-log.md`.
