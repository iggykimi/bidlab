# BidLab environment (T01)

Date: 2026-10-26. Machine: Windows. Repo root: workspace root, branch `main`.

## Toolchain (observed, not assumed)

- Python 3.14.7 (system)
- Node v26.3.0, npm 12.0.2
- uv 0.12.5
- Muse Code 1.4.13
- gh: login `iggykimi` (id 198978748)
- git author: `iggykimi <198978748+iggykimi@users.noreply.github.com>`

## Resolved toolchain (T05, pinned in uv.lock / package-lock.json)

Python 3.14 (venv `.venv`, `uv sync --all-packages`):
fastapi 0.162.0, starlette 1.10.0, pydantic 2.14.1, pydantic-settings 2.16.1,
sqlalchemy 2.1.6, alembic 1.20.1, uvicorn 0.54.0, pypdf 6.21.2,
pdfplumber 0.11.10, jinja2 3.1.6, httpx 0.28.1, openai 3.38.0,
python-multipart 0.0.32, pytest 9.1.1, hypothesis 6.170.12, ruff 0.17.2,
mypy 2.4.0, jsonschema 4.26.0.

Node (npm workspaces, root `package-lock.json`):
react/react-dom 19.3.1, @types/react(-dom) 19.3.0, react-router-dom 7.18.4,
@tanstack/react-query 5.105.0, react-hook-form 7.91.0, zod 3.25.76,
recharts 2.15.4, pdfjs-dist 4.10.38, vite 6.4.5, @vitejs/plugin-react 4.7.0,
tailwindcss 4.3.3, typescript 5.7.3, vitest 2.1.9, openapi-typescript 7.13.0,
@playwright/test 1.64.1, eslint 9 + @eslint/js 9.39.5 + typescript-eslint.
Chromium installed via `npx playwright install chromium`.

Deviations from ARCHITECTURE (resolved, recorded):
- Python 3.14 instead of 3.12 (system toolchain; ruff/mypy target py312).
- Node 26 instead of 22 (system toolchain; satisfies Vite >=20.19/22.12).
- `uv sync` needs `--all-packages` in this uv version to install apps/api;
  verify.py and CI use it.
- npm 12 blocks esbuild postinstall until approved:
  `npm install-scripts approve esbuild` (recorded in package.json).
- `npm audit` reports 7 vulnerabilities (3 moderate, 2 high, 2 critical);
  left for T27 security review, no blind `audit fix --force` on scaffold day.

## Gaps

- `tools/validate_blueprint.py` now runnable in venv (jsonschema installed);
  rerun pending with T06 contracts.

## Keys (presence only, values never logged)

- `.env` present at workspace root (author-created, gitignored). Content not inspected.
- `MODEL_API_KEY` smoke (T03/G3) pending: run `tools/meta_smoke.py` once with
  bounded consumption and record the real result in `docs/verification-log.md`.
