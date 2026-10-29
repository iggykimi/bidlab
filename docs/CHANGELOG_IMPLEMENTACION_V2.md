# BidLab · CHANGELOG de implementación V2 (issue #3)

Base: `616b248` (docs post-RC issue #2). Final código: `264712f`.
Rama: `main`. Fecha: 2026-10-29. Árbol limpio tras cada push.
Prompt: `BIDLAB_V2_PROMPT_Y_GUIA_2026-10-29.zip` (2 ficheros, sin MANIFEST;
integridad = descarga + lectura íntegra 2183 + 131 líneas).

Estados: `IMPLEMENTADO` / `PARCIAL` / `YA_EXISTIA` / `BLOQUEADO` / `DESCARTADO`.

| ID | Estado | Qué se hizo / por qué no | Archivos / commits |
|---|---|---|---|
| BL-V2-01 | IMPLEMENTADO | Clave canónica `stressInputKey` + `submittedKey`/`latestSeq`: aviso de obsolescencia, `Aplicar` deshabilitado, respuestas tardías no promocionan. 3 unit + E2E red→green. | `stressGrid.ts`, `StressSection.tsx`, `tests/e2e/stress.spec.ts` · `f0cb455` |
| BL-V2-02 | BLOQUEADO | Sin `MODEL_API_KEY`/`META_API_URL`, sin admisión ni saldo verificado. Cero llamadas live. Infra (adapter/jobs/receipts) intacta; smoke histórico 26-oct no se vende como extracción. | Ver `docs/META_EVIDENCE_V2.md` |
| BL-V2-03 | IMPLEMENTADO | Leyenda externa + títulos de eje en HTML; etiquetas fuera del SVG; margen 56→28; fragmentos. E2E e03-e06 + qa-visual. | `CurveChart.tsx`, `styles.css` · `bf49982` |
| BL-V2-04 | IMPLEMENTADO | PageImage 3 estados (curado sin `<img>`, error real + reintento, pendiente), hint solo con overflow medido. T15 4/4. | `EvidenceDrawer.tsx`, `EvidenceTab.tsx` · `eca05ed` |
| BL-V2-05 | IMPLEMENTADO | `decision_frontier.py` Decimal puro + 7 unit; endpoint `POST /scenarios/frontier` aditivo (contrato regen, 85 schemas); UI `DecisionFrontier`; CMP-05. | `decision_frontier.py`, `scenarios.py`, contrato, `DecisionFrontier.tsx` · `fa315cb` + test 422 `264712f` |
| BL-V2-06 | IMPLEMENTADO | Heatmap rebajas×hipótesis como tabla accesible (caption, th scope, texto nunca solo color); reutiliza celdas backend; sin JS económico. | `StressSection.tsx` · `3795240` |
| BL-V2-07 | IMPLEMENTADO | Citas: tarjeta existente extendida (etiqueta curada, páginas citadas, nota integral, sin %). Revisar: tarjeta de envío con tira + contadores del trabajo. Modelo puro + 4 unit (red-first). Sin backend nuevo (§22.4: manifiesto vive en servidor). | `EvidenceTab.tsx`, `CoverageCard.tsx`, `coverageModel.ts` · `2c2cb5c`, `6776a5f` |
| BL-V2-08 | IMPLEMENTADO | Selector radio de par para el hero con 3 escenarios (2 pares backend); copy condicional; CMP-04. | `CompareSection.tsx` · `030600c` |
| BL-V2-09 | PARCIAL | Contadores reales + identidad «propuesta N de M» + E2E T15. Colisiones ambiguas, fences CAS/409 y cita-vs-revisión ya existían. Filtros por criticidad y batch aceptar/corregir/descartar: sin campo de criticidad ni endpoint por claim en contrato; inventarlos está prohibido (§11.2/§11.6). | `ProposalClaims.tsx`, `t15-evidence.spec.ts` · `5e698e9` |
| BL-V2-10 | IMPLEMENTADO | `scripts/bench_pdf_intake.py`: PDFs sintéticos 2/40/100 p., n=5, mediana/p95 por etapa, entorno registrado. Medido 29-oct: 2 p. ≈0,16 s; 40 p. ≈3,2 s; 100 p. ≈8,5 s (servicio, dpi 150). Veredicto §12.3: no tocar (demo/E2E ≤41 p.; cola asíncrona con más riesgo que ganancia). | `scripts/bench_pdf_intake.py` · `522ab32` |
| BL-V2-11 | PARCIAL | Offline YA_EXISTIA y verificado: `compare_extraction.py` (texto medido 0/11 baseline honesto) + `score_extraction.py` + 26 tests. Live BLOQUEADO (sin clave; hibrido blocked, cero llamadas). Sin `evaluate_extraction.py` nuevo: hay equivalentes funcionales (§22.5). | `scripts/compare_extraction.py` (existente, verificado 29-oct) |
| BL-V2-12 | IMPLEMENTADO | View-model puro `buildDecisionTrace` (5 nodos, enlaces solo reales, sin CTA ficticias) + barra navegable en Resumen + CSS componer (sin SVG estático). 8 unit + E2E demo/propia. | `decisionTrace.ts`, `DecisionTrail.tsx`, `SummaryTab.tsx` · `5b4824b` |
| BL-V2-13 | PARCIAL | Tokens/color existentes conservados (sin rebrand). Hecho: tabulares, microcopy §16.4 (veredicto→zona de aviso), etiqueta «supuestos de rivales» en comparador, denominador «X de 49». DecisionDelta/SourcePill/TrustBadge/MetricPair/ExplainablePanel/ScenarioTag: equivalentes existentes (DeltaBlock, botones de cita, estados textuales, TechnicalDetails); no se renombran por churn. | `KpiSection.tsx`, `CompareSection.tsx`, `compare.spec.ts` · `8b1bb93` |
| BL-V2-14 | IMPLEMENTADO | Auditoría 12 puntos §16.1 + guidelines Vercel + impeccable audit: tablist APG, foco drawer, skip links, live regions, contraste medido ≥6,3:1, reduced-motion sin animaciones nuevas, formularios autocomplete. Nuevo: test 320 px (rastro + tira sin overflow global). Sin axe: el proyecto no tiene esa dependencia; E2E cubre. | `tests/e2e/e11-responsive.spec.ts` · `8b1bb93` |
| BL-V2-15 | PARCIAL | Incremental sobre export existente: nulos «sin determinar» (nunca «—»/0), badge de modo live/manual, «Tu nota», descargo legal, test backend. Sin export comparativo A-B ni split resumen/anexo: desestabilizaría el export (§22.4). Stale imposible por diseño (snapshot congelado). | `report.html.jinja`, `test_scenarios_reports.py` · `c68964b` |
| BL-V2-16 | PARCIAL | §18.9 corregido (same-origin real), literales del guion actualizados, notas de cámara V2, runbook, README EN, draft EN actualizado. Vídeo: lo graba el autor (pendiente, no se finge). | `docs/demo-script-180s.md`, `docs/DEMO_RUNBOOK_V2.md`, `README_EN.md`, `docs/submission-draft.md` |
| BL-V2-17 | DESCARTADO | P2 condicional: exige live validado (BLOQUEADO). Sin bucle de segundas pasadas sin presupuesto. |
| BL-V2-18 | DESCARTADO | P3: no tocar por mandato. |
| §24 extras | DESCARTADO | Núcleo primero (§25.1): meseta/porqué/antes-después/consultas/plantillas quedan backlog con motivo; nada se marca hecho. |
| Fix hallado | IMPLEMENTADO | La conclusión del stress contaba rebajas como hipótesis («3 hipótesis» con 1 columna). Ahora cuenta hipótesis cubiertas (`comparable_count`) con singular/plural. E2E exacto. | `StressSection.tsx`, `stress.spec.ts` · `264712f` |
| Fix hallado | IMPLEMENTADO | `shell.test` envuelve SummaryTab con QueryClientProvider (la barra de rastro usa queries, como en la app real). | `shell.test.tsx` · `881c19c` |

Mapa de correspondencia §22.5: `SCREENSHOTS_V2/` → `docs/v2-shots/` (+ `docs/demo/` fresco);
artefactos `evaluation/` → `evidence/` existente + `/tmp` (sintéticos, no se commitean).
