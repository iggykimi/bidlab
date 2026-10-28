# BidLab task board (from examples/tasks.csv)

Status values: done | in_progress | pending | blocked | parked.
DoD per block in docs/MILESTONES.md; evidence in docs/verification-log.md.

## Plan Integral Meta 28-oct (leído ENTERO 93/93 + HTML; goal nuevo activo)

- Paquete BidLab_Plan_Integral_Meta_2026-10-28 verificado (MANIFEST
  93/93) y leído al completo: PLAN_MAESTRO 21 capítulos, backlog
  PKG-T01–PKG-T30, contratos, backend_referencia, evidencia,
  diseno_anterior (LEER 1050 líneas, GALERÍA 549, 16 SVG texto
  idéntico embebido/standalone, app.js/style.css/vistas,
  motor.json 972 outcomes + licitaciones.json 68 === inline
  index.html, validación, sistema, ingenieria, investigación),
  prototipo standalone (index.html sin refs externas) y 6 PNG
  inspeccionados (Vista_General contact-sheet 16 láminas,
  Vista_Oferta, Vista_Frontera, pipeline, radar, límite-coste).
- DECISIÓN D28-1: tareas del paquete se citan PKG-T01–PKG-T30
  (T01–T30 del repo ya existen con otro significado).
- DECISIÓN D28-2: «siempre commit y push» (orden directa del
  autor) prevalece sobre la cláusula no-push del paquete y de
  AGENTS.md; vídeo lo narra el autor, no forzar CI.
- Goal nuevo: camino crítico PKG-T01–T09 → PKG-T12–T15 →
  PKG-T10–T11 → (PKG-T20–T21 condicional) → PKG-T16–T19;
  P1 diferido; PKG-T28–T30 descartados.
- Siguiente: reproducir B01–B05 en checkout real, empezar
  PKG-T01 + PKG-T02. Paquete (zip + extraído + HTML) queda
  untracked hasta que el autor diga si se versiona.
- 28-oct: B01–B05 reproducidos; PKG-T01 + PKG-T02 hechos
  (recibos live, ledger micro-USD, migración 0005);
  backend 355 verdes. Siguiente: PKG-T03 (jobs async).
- 28-oct: PKG-T03 hecho (worker in-process, claim CAS,
  fence, migración 0006); backend 363 + E2E 7/7 verdes.
  Siguiente: PKG-T04 (cobertura de páginas).
- 28-oct: PKG-T04 hecho (coverage usable/entregado,
  warnings job+workspace, manifest); backend 373 +
  E2E 62/62 verdes. Siguiente: PKG-T05 (render).
- 28-oct: PKG-T05 hecho (render PyMuPDF versionado,
  cache_key, hook upload); backend 383 + E2E 62/62.
  Ayudas render inexistentes en paquete (ver log).
  Siguiente: PKG-T06 (payload híbrido).
- 28-oct: PKG-T06 hecho (payload híbrido acotado,
  bindings, tope real en budget); backend 391 +
  E2E 62/62. SME Spark pendiente autor.
- 28-oct: PKG-T07 hecho (observations v2 live +
  bindings + adapt v1, v2 crudo en manifest);
  backend 419 + E2E 62/62.
- 28-oct: PKG-T08 hecho (prompt extract-3 con
  unidades/ámbito/periodo/ambigüedad + ejemplo
  sintético); backend 424 + E2E 62/62.
- 28-oct: PKG-T09 hecho (Job +invocación, tracker
  rehidratable, E2E recarga); backend 427 + front
  208 + E2E 63/63. Crítico T01–T09 cerrado.
  Siguiente: PKG-T12 (búsqueda/paginación).

## Sesión 28-oct (tour + malla + contrato; sin commit, pendiente autor)

- Tour verificado + TourBar (?tour=1): E2E tour 2/2, runner unit 6/6.
- Malla E2E 2/2. Contrato stress: 27 paths/29 ops/79 schemas/104
  códigos, regen YAML/TS/py solo-aditiva, servicio a modelos g.
- verify.py 10/10 exit 0: backend 333, web 202/25, E2E 62/20.
- Capturas 01–08 regeneradas + inspeccionadas; footage oro real
  (docs/demo/footage-oro-20261028.webm); guion actualizado.
- US01–US13 auditadas en verification-log (12 PASS + US10 parcial
  visible). T33 sigue in_progress (narración pendiente autor).

## Revisión R01–R06 (revision_50e07cf, 27-oct; cerrada, sin commit de R07)

- R01: deep link ?prueba= selecciona al inicio; un clic posterior manda
  y exporta (tests/e2e/r01-r04-state.spec.ts).
- R02: borrador de coste obsoleto muestra conflicto y confirma explícito
  («Tus datos cambiaron en otro lugar.» → «Guardar de todas formas»).
- R03: prueba recién guardada aparece en Informe sin recargar.
- R04: fallo de cuota avisa una vez («Tu borrador no se guardó en este
  navegador.»), conserva memoria y limpia al reintentar.
- R05: recorrido propio completo offline (alta + PDF + empresa + análisis
  + revisión manual que materializa regla/ámbito + simular + comparar +
  exportar): tests/e2e/own-journey.spec.ts 3/3 (verde 27-oct).
- R06: rebaja arriba con asserts de bounding-box (1280×720 y 390×844),
  coste resumido + editor ancho, comparar desde Precio:
  tests/e2e/r06-layout.spec.ts 4/4 (verde 27-oct).
- Caso oro 10/15: mismos 49 puntos, el 10 % conserva 5916,80 € más
  (CMP-02 + backend golden + R06).
- Sin push, sin CI remota (prohibidos por el autor), sin vídeo grabado,
  sin jueces internos (prohibidos). Submission NOT sent.

## R07 docs honestos (in_progress, 27-oct)

- Guion 180 s reescrito al caso oro + runbook a la UI nueva
  (demo-script-180s.md, demo-runbook.md).
- Pack demo con conteos honestos y puertas locales (docs/demo/README.md).
- Reconciliados README.md, AGENTS.md, DEMO_SUBMISSION.md y este tablero.
- Fila revision_50e07cf en verification-log.md. NO commit, NO push.

## Ronda judge-fix 27-oct (cerrada 27-oct; push/CI cancelados por el autor)

- Alcance A + intake: drafts persistentes, comparar 2-3, coste
  editable, requisitos accionables, crear licitación + subir PDF.
- Round 2 interno: J1 7.5 (D1-D5) + J2 7.5 (F1-F4) + J4 9.0 (F1);
  J3 cancelado por el autor (juzga otro modelo). Residuales
  aplicados: vocabulario «prueba», URLs humanas (?tab=precio,
  ?campo=<slug>, ?prueba=), fixtures redactados, operador explicito,
  «poda» humanizada, dominancia honesta con empate, NBSP en €,
  controles 48px, drawer region, live-regions vacias fuera.
- Residuales honestos (juez externo): consolidar live-regions
  (anunciador unico + debounce slider), guion ASCII vs menos
  tipografico, glosario en app.
- Gates 27-oct (en su commit; este árbol va por delante sin
  re-ejecutar): backend 310, web 146, E2E 39/39 x2, verify.py
  10/10 exit 0, ruff/mypy/tsc/lint/build verdes. Push/CI
  cancelados por el autor (puertas locales desde entonces).
- T02/T04 still pending (author externals). Submission NOT sent.

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
| T08 | 27oct | 1.5 | T07 | done | library/workspace/document routes |
| T09 | 27oct | 2 | T05 | done | money, scope, numeric oracles |
| T10 | 28oct | 1.5 | T09 | done | inverse proportion, safe AST, unknown |
| T11 | 28oct | 3 | T10 | done | Tías policy 18.5 + abnormality edges |
| T12 | 28oct | 1 | T11 | done | grouping, hypotheses, non-computable cases |
| T13 | 28oct | 2 | T06 | done | AND/OR requirements tree + evidence (verif. 27oct: E02/T23/motivo/leafCitations) |
| T14 | 29oct | 2 | T06 | done | safe PDF, page extraction, limits |
| T15 | 29oct | 2 | T14 | done | citation/text/page verification + gold |
| T16 | 29oct | 2.5 | T03 T15 | done | Meta adapter, JSON schema, retry/cost/cache |
| T17 | 30oct | 2 | T16 | done | persisted jobs/restart/idempotence |
| T18 | 30oct | 2 | T13 T15 | done | semantic review + review audit |
| T19 | 30oct | 2 | T08 | done | UI layout, states, navigation |
| T20 | 30oct | 1.5 | T19 | done | library/summary + honest demo badge |
| T21 | 31oct | 2 | T18 T19 | done | requirements matrix / PDF drawer with sources |
| T22 | 31oct | 2.5 | T10 T19 | done | Pricing Lab, slider/KPI, backend curve |
| T23 | 31oct | 1.5 | T12 T22 | done | rival panel + complete fields/groups |
| T24 | 31oct | 1.5 | T21 T22 | done | calc trace + source links |
| T25 | 1nov | 2 | T24 | done | HTML/print report + pendings |
| T26 | 1nov | 1.5 | T25 | done | scenarios/snapshots/persistence + reload |
| T27 | 1nov | 2 | T14 T17 T25 | done | security controls, origin, secrets, PDF |
| T28 | 2nov | 2 | T17 T26 | done | integration/contracts + fixes |
| T29 | 2nov | 3 | T28 | done | Playwright Chromium E01–E12 + offline |
| T30 | 2nov | 2 | T29 | done | visual QA desktop/mobile + a11y |
| T31 | 3nov | 1.5 | T30 | done | clean install rehearsal, perf, freeze |
| T32 | 3nov | 1.5 | T31 | done | reproducible README, licenses, verification |
| T33 | 3nov | 2 | T32 | in_progress | guion 180s done (R07); grabación y verificación del vídeo pendientes |
| T34 | 4nov | 0.5 | T33 T02 T04 | done | delivery fields/links review; author sends |

## P1 (parked unless P0 solid + time)

H01 ETL ZIP, H02 curated history, H03 gated table/histogram, H04 extra
templates. Cut order per MILESTONES; never cut accuracy, citations,
hypothesis labelling, offline demo or reproducible export.
