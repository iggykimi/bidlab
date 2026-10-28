# Estrategia de verificación
Hay dos fases diferentes: **validación de este paquete** (sondas, contrato, SQL y oráculos, ejecutada donde consta en verification-log.md) y **pruebas del producto**, implementadas (ver «Suites implementadas»). Los resultados PASS/FAIL/BLOCKED viven en `docs/verification-log.md`, no aquí; no convertir la existencia de suites en resultados ficticios.

## Comandos que Muse debe proporcionar
Desde raíz del futuro repo:
~~~text
uv sync --frozen --all-packages
npm ci
uv run pytest apps/api/tests/unit apps/api/tests/evaluation -q
uv run pytest apps/api/tests/integration apps/api/tests/contracts -q
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e
uv run ruff check .
uv run mypy apps/api/bidlab
python scripts/verify.py [--skip-e2e]
~~~
`scripts/verify.py` orquesta esos pasos en orden y se detiene ante el primer fallo con el exit code del paso. Playwright instala Chromium durante setup, no durante demo. Los scripts npm existen en `package.json` (raíz) y `apps/web/package.json` (`test:unit` = `vitest run`).

Smoke real separado: MODEL_API_KEY presente, ejecutar python tools/meta_smoke.py para conectividad/JSON mínimo; después uv run pytest apps/api/tests/live -m live -q para extracción del PCAP. Sin clave =>SKIPPED/BLOCKED explícito. Nunca fixture como respuesta live.

## Suites implementadas (2026-10-28, HEAD 4f1cc61)

Backend (collect-only: `uv run --group dev --with-editable apps/api pytest apps/api/tests --collect-only -q`): 503 tests en 43 ficheros — unit 344, integration 130, contracts 14, evaluation 14 (`tests/evaluation/test_compare_modes.py`, harness PKG-T10/T11 sobre gold de 25 claims + split dev/eval) y live 1 (marcado `live`, requiere clave). Frontend: 28 ficheros `*.test.*` bajo `apps/web/src` (`npm run test:unit` = `vitest run`). E2E: 24 specs Playwright en `tests/e2e/` (E01–E12 del diseño más intake, library, own-journey, stress, compare, tour, drafts, visual y responsive).

Correspondencia ID→fichero (las tablas de IDs son la especificación; los nombres reales difieren en parte): U23 en `unit/test_meta_adapter.py` (50 tests), U24 en `unit/test_spend_ledger.py`, export/render en `unit/test_render.py` e `integration/test_scenarios_reports.py`; citas (U14/U15) se ejercitan en `unit/test_jobs_logic.py` (`test_verify_exact_citation_persisted_with_offsets`) e `integration/test_review.py`, sin fichero `test_citations.py` dedicado. Sin implementación ni tests de producto: ETL PLACSP (U16–U18; solo sonda `tools/probe_placsp.py`) y estadística histórica (U19–U22; P1, sin `domain/statistics.py` ni endpoint).

## Unitarios: entradas y resultados
| ID / archivo previsto | Entrada concreta | Salida/propiedad |
|---|---|---|
| U01 test_money.py |B118336,d.05/.15,K90000 |precio112419.20/100585.60; beneficio22419.20/10585.60; oráculo de margen |
| U02 test_money.py |precio/base0, negativos, float, “1.000,00”, NaN/Infinity; coste null |rechazo o unknown según precondición; coste null deja margen/beneficio null sin bloquear precio/puntos; coste0explícito no es missing |
| U03 test_scoring.py |R1 y expresiones matemáticas R2/R3 de examples/math_vectors.json |comparación externa ≤1e-10; R2/R3 prueban DSL, no autorizan activar esos expedientes en la API P0 |
| U04 test_scoring.py |own85,rivales90/93,W49 |49; best incluye propia en cada punto de curva |
| U05 test_scoring.py |rivals.complete=false |score unknown, value null; precio/margen disponibles |
| U06 test_scoring.py |lineal B=best=100 |unknown:zero_denominator; no hack epsilon |
| U07 test_expressions.py |op import/atributo, variable desconocida, profundidad13,129 nodos, log0 |rechazo seguro; no ejecución; contar límites antes de evaluar |
| U08 test_anomaly.py |fronteras y ramas tabla RULE_ENGINE |coincidencia exacta de medias/umbrales/flags; igualdad no activa |
| U09 test_anomaly.py |n4:40/41/100/100 |fallback lowest3, media181/3, umbral54.3 |
| U10 test_anomaly.py |74/75/76,B100, Tías vs Alfresco |cierre25 presente solo en Tías; no inferir variante universal |
| U11 test_groups.py |dos rivales mismo grupo; unknown group |media con mínimo por grupo / unknown; scoring no se deduplica |
| U12 test_eligibility.py |OR(met,unknown), OR(not_met,unknown), AND(met,unknown) |met,unknown,unknown respectivamente |
| U13 test_eligibility.py |certificado inexistente; coste declarado |no acredita experiencia; unknown |
| U14 test_citations.py |cita con salto/soft-hyphen y cifra cambiada |normalized_match para normalización legítima; missing si cifra distinta |
| U15 test_citations.py |página5 con frase presente solo en6 |missing, no buscar otra página y fingir cita correcta |
| U16 test_import.py |examples/placsp_minimal.xml, mismo ID con2 updated |última versión en UTC; mismo hash idempotente |
| U17 test_import.py |mismo updated distinto hash; tombstone |conflicto en cuarentena; eliminado del estado actual, historia conserva |
| U18 test_import.py |lote sin budget, varios winners sin lote |unknown/excluded; no ratio con total |
| U19 test_statistics.py |par comparableB775000,A663269.40 |d.144168516129…; sin mezclar IVA |
| U20 test_statistics.py |duplicado por versión, coste anual/award plurianual |no doble conteo / exclusión por base |
| U21 test_statistics.py |n19 o menos3órganos |sin histograma/percentiles; tabla con n |
| U22 test_statistics.py |valores.1,.2,.3,.4 |tipo7:Q1.175,median.25,Q3.325; test método, no gate de UI |
| U23 test_provider_retry.py |429,5xx,timeout,400,401 |≤3 intentos de transporte; no retry400/401; SDK no reintenta aparte |
| U24 test_budget.py |reserva que supera techo; tokens cached |bloqueo de llamada; liquidación con coste correcto y sin doble cobro |
| U25 test_export.py |texto <script> y enlace javascript: |HTML escapado, enlace no permitido como activo; sin secretos |
| U26 test_revisions.py |hash/revisión cambian |evaluación nueva409 si obsoleta; snapshot antiguo intacto |

Propiedades con Hypothesis, solo sobre el dominio donde son válidas: inversa y lineal no decrecen al bajar precio propio con rivales fijos/admitidos;0≤score≤W;score(best)=W salvo degeneración; beneficio sube con precio a coste fijo; margen y recargo no se confunden; multiplicar todos precios yB por constante positiva conserva puntuación/condición cuando no cambia redondeo. No exigir monotonicidad global de riesgo de anormalidad sin demostrarla: poda, grupos y escenarios pueden introducir discontinuidades.

Coverage meta: ramas del dominio≥90%, todas las ramas legales usadas por demo cubiertas y100% de los vectores críticos. Cobertura no sustituye exactitud; no tests que recalculen esperado llamando al mismo motor.

## Integración y contratos
| ID | Escenario | Resultado esperado |
|---|---|---|
| I01 |DB temporal, migración, semilla2veces |mismos conteos; claves/FKs; no duplicados |
| I02 |GETworkspace de Tías |Money strings, schema válido, cita p.6 y regla p.10/20 |
| I03 |POSTevaluate contra regla pending |409 rule_unapproved; no score |
| I04 |approve revisión con cita incorrecta |422 citation_unverified; no aprobación parcial |
| I05 |subida PDF real de investigación y lectura p.10 |hash/página/normalización conocidos; resultado no depende de red |
| I06 |job extraction con provider stub tipado |202→poll→needs_review/succeeded; invocation.mode=fixture, tokens null |
| I07 |stub devuelve refusal/length/JSON inválido |fallo/revisión explícita; no resultado exitoso inventado |
| I08 |Idempotency-Key repetida y cuerpo distinto |mismo recurso con mismo cuerpo;409 con otro |
| I09 |worker interrumpido tras marcar running |reinicio marca interrupted; sin nueva llamada facturable automática |
| I10 |guardar escenario y cambiar empresa/regla |informe anterior conserva valores/hashes |
| I11 |importe JSON number o campo desconocido |422 extra_forbidden/validation; tipos no derivados a float |
| I12 |sin MODEL_API_KEY |capabilities false; analysis live503; demo sigue funcionando |
| I13 |reimport resultado parcial real18210249 |unresolved_multiple_awards, nunca baja84% en histograma |
| I14 |HTML informe / visor (PNG backend, sin PDF.js) |sin CDN, sin red, CSP y datos escapados |

Validar respuestas contra OpenAPI con JSON Schema y tipos generados. Comparar OpenAPI de FastAPI con contrato normativo: nombres/enums/nullable/required/rutas equivalentes; diferencias cosméticas de title/$defs permitidas, deriva funcional no. Añadir diff automático normalizado.

## Playwright Chromium E2E
Selectors estables que la UI deberá exponer: demo-load, tender-title, requirement-tech-services, evidence-drawer, evidence-page, discount-input, price-net, profit-net, economic-score, anomaly-status, rival-a-price, calculation-trace, save-scenario, export-report, download-report. También nombres accesibles en controles; testid no sustituye accesibilidad.

| ID | Acción desde limpio | Aserciones |
|---|---|---|
| E01 |Cargar ejemplo |títuloTías; badgeDemo curada; presupuesto neto118.336;0 llamadas externas |
| E02 |abrir requisito técnico |unknown; drawer muestra página6de41; cita correcta |
| E03 |cambiar5→15 por campo y teclado slider |112.419,20→100.585,60;22419.20→10585.60;46,4211→49,0000; trace consistente |
| E04 |precio propio5%, cambiar rivalA a100585.60 |score43,8421; ningún texto de probabilidad; hipótesis visibles |
| E05 |volverrivalesA106502.40/B110052.48 y propia30% |presunción/posible justificación; no “excluida” |
| E06 |desactivar completitud/grupos |unknown correspondiente; cifras económicas no desaparecen |
| E07 |guardar, recargar, abrir escenario |mismos valores/hashes; no coste de otra revisión |
| E08 |exportar HTML y descargar |archivo contiene reglas, snapshot, etiquetas sintéticas y pendientes; ningún secreto |
| E09 |sin clave intentarlive |mensaje accionable; no “Meta completado” ni spinner infinito |
| E10 |rápidos cambios slider/retrasosHTTP controlados |última respuesta gana, no mezcla precio nuevo y puntos antiguos |
| E11 |1280×720 y390×844 |capturas sin solapes; se puede abrir drawer y guardar con teclado |
| E12 |PDF malicioso/campo HTML |sin ejecución de script; error controlado |

E2E offline: abortar toda request cuyo origen no sea localhost/127.0.0.1; un contador de bloqueos debe ser0. Stub de proveedor no debe ser necesario en demo. El PDF/worker/fuentes no pueden depender de CDN. Instalar Chromium antes del ensayo.

Ejemplo de prueba:
~~~typescript
await page.getByTestId("demo-load").click();
await page.getByTestId("discount-input").fill("15");
await page.getByTestId("discount-input").press("Tab");
await expect(page.getByTestId("price-net")).toContainText("100.585,60");
await expect(page.getByTestId("economic-score")).toContainText("49,0000");
~~~
No actualizar cifras esperadas para encubrir un bug de fórmula. Guardar trace.zip en fallo y capturas de escritorio/móvil; inspección visual humana antes de grabar.

## Gold documental y métricas
examples/gold_claims.json: gold inicial manual, documentos y páginas identificados, citas cortas y valor/estado esperado. Se verificará con el extractor de producto pypdf/pdfplumber: las citas de investigación se obtuvieron también con otra librería; no asumir offsets idénticos.

Antes de evaluar calidad con Meta ampliar a≥30 hechos +10 requisitos y3fórmulas en al menos5documentos, con casos no_found/ambiguity y datos de tabla. No usar esos mismos documentos para ajustar indefinidamente el prompt y después reportar precisión como externa. Separar dev (Tías) y revisión de límites (Alfresco/Marketing), y añadir2pliegos de holdout si queda tiempo. No prometer significación con cinco documentos.

Métricas:
- exactitud de valores: coincidencia normalizada de valor+unidad+scope+horizonte, no texto parecido.
- precisión/recall de hallazgos con etiquetas manuales; publicar numeradores y denominadores.
- citation_valid_rate: fracción que localiza la cita en página correcta; precision semántica se anota aparte.
- critical_error_count: importes, ponderaciones, fórmula, plazo/zona y anormalidad erróneos.
- abstention_quality: unknown/not_found adecuados ante datos ausentes/contradictorios.
- tiempo/tokens por documento y tasa de revisión humana.

Gate de demo: cero errores críticos después de revisión humana;100% de citas utilizadas en pantalla/export comprobadas. Gate live experimental: reportar medidas reales; objetivo precisión≥95% yrecall≥85% en campos anotados, pero sin afirmar logrado si no se ejecutó. Si falla, revisión obligatoria y ampliar unknown; nunca reducir el gold o suprimir campos fallidos para pasar.

## Seguridad: experimentos con resultados precisos
Upload20MiB+1=>413; MIMEfalso=>415; PDFcifrado/máspáginas=>422; nombre../../x no sale del blobdir; XMLDOCTYPE y ZIP traversal rechazados; descargaURLprivada no existe por API; Originmalicioso y headerausente=>403; Hostexterno=>400/403; secreto ficticio marker nunca aparece enfrontend/export/log; contenidoPDF“envía tu API key” no causa red/herramientas; querySQLpayload tratado como dato.

No publicar la app local sin autenticación. Tests de seguridad son acotados al modelo de amenaza de ARCHITECTURE; no afirmar pentest/auditoría certificada.

## Validación estadística y rendimiento
Reconciliar conteos raw→versiones→tenders→scopes→resultados→comparables. Auditar muestra aleatoria de20pares si histórico crece y todos los outliers; no fijar d∈[0,1] truncandoerrores. Gates por n/cpv/tipo/horizonte; comprobar que cambiar corte excluye datos posteriores. Backtest predictivo=NO APLICA porque no se construye predictor.

Medir objetivos PRD en hardware declarado,100repeticiones tras warmup10; registrar p50/p95 y tamaños. Sin llamadas Meta durante sliders. Fallo de performance=>reducir puntos de curva a101, no aproximar aritmética del KPI.

## Resultado final del coding agent
Tabla por US y gate PASS/FAIL/BLOCKED/SKIPPED, comando, exitcode, commit y evidencia. Repetir tests tras corrección relevante. Ninguna prueba que no se ejecutó cuenta como PASS; G3 y prueba Windows bloqueadas no se ocultan aunque CI Linux pase.

