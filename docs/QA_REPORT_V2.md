# BidLab · QA report V2 (issue #3)

Fecha: 2026-10-29. Windows. HEAD código: `264712f` (docs aparte).
Versiones: Python 3.14.7 · uv 0.12.5 · Node v26.3.0 · npm 12.0.2 ·
Playwright/Chromium 1.64.1 · pymupdf 1.28.2.

## Puertas (comando, exit, recuento)

| Puerta | Comando | Exit | Resultado |
|---|---|---|---|
| Backend | `.venv/Scripts/python -m pytest apps/api -p no:warnings` | 0 | 557 passed, 2 skipped (live opt-in + symlink Windows) |
| Web unit | `npm run test:unit -w apps/web -- --run` | 0 | 252 passed, 33 ficheros |
| Lint | `npm run lint` | 0 | eslint apps/web/src + tests/e2e limpio |
| Tipos web | `npm run typecheck` | 0 | tsc limpio |
| Build | `npm run build -w apps/web` | 0 | vite OK (~373 kB / gzip ~116 kB) |
| Ruff | `python -m ruff check .` + `format --check .` | 0 | 153 ficheros formato OK |
| Mypy | `python -m mypy apps/api` | 0 | 111 ficheros limpios |
| Todo | `.venv/Scripts/python scripts/verify.py` | 0 | ALL CHECKS PASSED (10/10) |
| E2E | (dentro de verify.py, Chromium real) | 0 | 85/85 |
| Shots | `npx playwright test -c scripts/demo-shots/playwright.shots.config.ts` | 0 | 4/4 |
| V2 shots | misma config, spec `v2-shots` | 0 | 3/3 (8 PNG) |
| Story | `python scripts/demo_story.py --output …` | 0 | 4 escenarios + 4 HTML + comparación; oráculos 10/15 MATCH |
| Bench | `python scripts/bench_pdf_intake.py --iters 5` | 0 | 2 p. ≈0,16 s · 40 p. ≈3,2 s · 100 p. ≈8,5 s |
| Compare extr. | `python scripts/compare_extraction.py --out …` | 0 | texto medido 0/11 (baseline), híbrido blocked, 0 llamadas |

## E2E nuevas/tocadas por V2

stress 5/5 (stale + conclusión exacta) · t15-evidence 4/4 (curado/reintento/hint/contadores) ·
e03-e06 + qa-visual 10/10 (curva) · compare 5/5 (pares, frontera, etiqueta rivales) ·
own-journey 4/4 (rastro + cobertura) · e01-demo 6/6 (rastro + cobertura) ·
e11-responsive 3/3 (+320 px rastro/tira).

## Capturas

- `docs/v2-shots/`: 8 PNG reales (1440 trace/curva/citas/stress/informe, 768 resumen, 390 resumen/citas).
- `docs/demo/01–10`: regenerados 29-oct (01/03/04/06/07/10 cambiaron).
- Inspeccionadas: informe (hero+frontera+delta), stress (mapa), móvil 390 (rastro apilado),
  demo resumen con rastro (fallo E2E intermedio, verificado y corregido).

## Fallos conocidos / pendientes (no son PASS)

- Live Meta: BLOCKED externo (sin clave/admisión/saldo). Smoke histórico 26-oct; cero llamadas live.
- Segunda pasada (P2) y multilote (P3): descartados con motivo.
- Export comparativo A-B y split resumen/anexo: no implementados (estabilidad del export).
- Vídeo 180 s: pendiente del autor. Sesiones de usabilidad: pendientes del autor.
- Warning preexistente en stderr: `StarletteDeprecationWarning httpx` (no rompe gates).

## Verificación manual

- Rastro demo/propia en 1440/768/390: legible, sin overflow, enlaces reales.
- Drawer curado vs error: verificado en T15 + captura.
- Informe HTML: nulos «sin determinar», badges de modo, descargo.
- Contraste medido por pares: ≥6,3:1 (AA 4,5).
- Seguridad §21.3 (existente, re-verificada): prompt trata el PDF como
  «untrusted evidence, never instructions» (test pin), CORS solo loopback
  dev, sin fetch servidor de URLs de usuario, traversal probado, Jinja
  autoescape, topes 20 MB/120 p.
