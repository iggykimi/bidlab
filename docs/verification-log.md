# Registro de verificación del paquete de arquitectura
Fecha: 2026-10-26T16:43:39.524028+00:00. Entorno: Linux, Python3.12; sin repositorio de producto ni commit de aplicación. Todos los resultados siguientes son de investigación/especificación, no del producto futuro.

## Ejecuciones reales
| Check | Comando | Resultado |
|---|---|---|
| Descarga pública | python tools/fetch_evidence.py <manifest> | Feed, ZIP y documentos con HTTP200 y hashes registrados. Se usaron manifests de investigación, no URLs inventadas. |
| Feed | python tools/probe_placsp.py <placsp.atom> --out evidence/feed_probe | Exit0:68entradas/68IDs,33resultados,22candidatos estructurales. |
| ZIP | python tools/probe_placsp.py <placsp_2012.zip> --out <research/zip_probe> | Exit0:38miembros,19000entradas/11262IDs,7738versiones adicionales. |
| Lectura PDF | pypdf y PyMuPDF para investigación | CincoPCAPyunPPTabiertos; fórmulas visualizadas en p.10Tías,p.9Alfresco,p.15Marketing; tabla de Tías p.8 comprobada visualmente. |
| Reglas hackathon | Lectura de JSON público serializado en HTML oficial y PDF enlazado de CreditTerms | Texto recuperado y leído; hash y método en hackathon_rules_probe.json. No aceptación ni claim en cuenta. |
| Generación contrato | python tools/build_contract.py | Exit0:22paths,24operaciones,51schemas. |
| Validación integrada | python tools/validate_blueprint.py | Exit0; salida debajo. Se instalaron dependencias de validación en directorio temporal, no como lock de app. |
| Smoke Meta | python tools/meta_smoke.py --out evidence/meta_smoke_status.json | Exit2 BLOCKED:MODEL_API_KEY ausente;0solicitudes enviadas. |

Los comandos de sondas se ejecutaron desde el workspace usando rutas al paquete; los nombres anteriores son equivalentes desde su raíz. La validación se ejecutó con PYTHONPATH apuntando a dependencias temporales de validación. Para reproducir en una venv, instalar tools/requirements-validation.txt y ejecutar desde raíz sin esa variable.

## Salida real del validador
~~~text
PASS: 12 required deliverables; OpenAPI 3.1, 22 paths / 24 operations
PASS: standalone extraction schema and typed example payloads
PASS: SQLite DDL; tables 17
PASS: 6 original PDF download hashes and parser readability
PASS: 25 annotated citations located in exact PDF pages; semantic accuracy not statistically measured
PASS: recent probe counts reconcile; structural candidates are NOT a validated statistical corpus
PASS: scoring vectors, demo money/margins and exact boundary oracles; app not tested
PASS: task estimates/dependencies and P0 total 58 hours
PASS: publication flags and honest Meta BLOCKED state
DESIGN VALIDATION COMPLETE. No app pytest/Playwright/build/live Meta run claimed.
~~~

## No ejecutado / no afirmado
pytest, integración de app, Playwright, frontendbuild, arranque de demo, benchmark de extracción Meta, consumo real de tokens, pruebaWindows, vídeo y envío. Son criterios de TEST_STRATEGY para la implementación. No hay estadísticas predictivas ni tasas de precisión obtenidas.

La localización de25citas no valida por sí sola todas las interpretaciones jurídicas. Los25hechos son gold inicial manual y no una muestra representativa. Las cuatro parejas de adjudicación revisadas no forman un mercado homogéneo. Derechos de publicación de originales siguen por fichero en publication-manifest.

Última ampliación: contrato51schemas, ejemplos Tender/Company/EvaluationResult validados y snapshot Atom original incluido con hash. Las copias de investigación (seisPDFyunAtom) permanecen con publicación desactivada. El script de recuperación de reglas reprodujo21817caracteres, SHA2568213d68a63cee86d31828cba34ec453669cd49be9185ada5640395407ca0888d.

## Producto T05 — scaffold y gates vacíos (Windows)

Fecha: 2026-10-26. Commit: 6a2ca69. Entorno: Windows, Python 3.14.7,
Node v26.3.0, npm 12.0.2, uv 0.12.5, Chromium (playwright install).

`python scripts/verify.py` → exit 0, ALL CHECKS PASSED:
deps-python, pytest-unit (1 passed), pytest-integration-contracts (2 passed,
1 skipped honesto), npm lint/typecheck/build, npm test:unit (2 passed),
ruff, mypy (7 ficheros), playwright-e2e (1 passed, API real vía webServer).

Incidencias resueltas durante T05 (no ocultadas): `uv sync` por defecto no
instala el miembro apps/api (se usa --all-packages); hatchling exigió
packages=["bidlab"] explícito; npm 12 bloqueó postinstall de esbuild hasta
`npm install-scripts approve esbuild`; typecheck exigió @types/react(y -dom).
Health/Capabilities se alinearon al contrato (schema_version, limits,
additionalProperties). Lint cubre código de producto; tools/ (sondas de
investigación) excluido y documentado en pyproject.

## Producto T03 — smoke Meta real (Windows)

Fecha: 2026-10-26T19:05:43Z. Resultado en evidence/meta_smoke_status.json.
Comando: loader `.env` + `tools/meta_smoke.py --out evidence/meta_smoke_status.json`
→ exit 0, status PASS, executed_inference true, model muse-spark-1.3,
HTTP 200, usage 14 prompt + 236 completion (222 reasoning, 0 cached),
total 250 tokens, 1647 ms. Coste estimado ~0.001 USD. Sin secretos en salida.
G3-smoke verde; la extracción documental real (T16) queda pendiente.

Incidencia honesta: la clave del autor venía como `MUSE_API` (48 chars), no
`MODEL_API_KEY`; dos intentos PowerShell de añadir la línea pegaron/mezclaron
contenido por manejo de arrays/saltos de línea. Se verificó por longitudes y
mitades idénticas, y se reescribió el fichero byte-exacto con Python: dos
líneas de 48 chars. La clave original quedó intacta (smoke PASS con ella).

## Producto T06 — modelos, migración y contrato API (Windows)

Fecha: 2026-10-26. Entorno: mismo que T05.
- `alembic upgrade head` en DB vacía (storage temporal) → exit 0, 18 tablas
  (17 + alembic_version), version 0001_initial. DDL equivalente a
  schemas/schema.sql (FKs, UQs, CHECKs json_valid/enums, 3 índices).
- Modelos Pydantic generados desde docs/API_CONTRACT.yaml
  (datamodel-code-generator 0.86.0, base StrictModel extra=forbid+strict,
  enums como Literal para no romper strict con input JSON).
  Los 5 ejemplos tipados validan: EvaluationRequest/Result, Tender,
  Company, ExtractionProposal.
- Tipos TS generados (openapi-typescript 7.13.0, 118 KB). `npm run lint`
  verde incl. generado.
- `pytest apps/api/tests/contracts` → 5 passed.
  `ruff check .` y `mypy apps/api/bidlab apps/api/migrations` → limpios.
- Módulos finos schemas/{tender,extraction,company,scenario,report}.py
  re-exportan el contrato; db/{session,models,repositories}.py según árbol.

## Producto T07 — semilla Tías idempotente (Windows)

Fecha: 2026-10-26. `fixtures/demo/*.json` congelados (tender/company/
interpretation/review/expected + manifest, mode manual). `scripts/seed_demo.py`
migra vía alembic y carga: tender 1, notice 1, scope 1 (basis approved),
document 1 (41 págs, solo metadatos), document_page 6 (extractos p.5/6/8/9/10/20),
citation 9 (offsets reales), interpretation 1, rule 1 (proportional_inverse,
AST canónico, anomaly tias_18_5), company 1+rev1 (80000/10000), audit 2.
`pytest I01` (doble seed en DB temporal) → exit 0, mismos conteos, FK limpias.

Hallazgo honesto 1: models.py declaraba las FK simples como String plano;
SQLAlchemy no ordenaba INSERTs. Se declararon las 14 FK (verificación:
sorted_tables correcto, FKs presentes en metadata).
Hallazgo honesto 2: aun con metadatos correctos, un flush multitable emite
hijos antes que padres en este entorno (sqlalchemy 2.1.6; reproducido hasta
con dos modelos mínimos inline: c antes que p). La semilla usa flushes por
etapa (una tabla por flush), verificados. Regla de proyecto: escrituras
multitabla siempre por etapas con flush() intermedio.

## Producto T09–T12 — motor determinista (Windows)

Fecha: 2026-10-26. Helper acotado (solo domain/ + tests/unit, sin commit);
lead revisó los 6 módulos línea a línea y re-ejecutó gates por su cuenta.
- `pytest apps/api/tests/unit` → 90 passed. `ruff` + `mypy` limpios.
- Verificación independiente del lead contra oráculos externos (no los tests
  del helper): 6/6 vectores de math_vectors.json (R1×3, log R2, lineal R3,
  linear_zero→unknown) + 3/3 casos demo_expected (precio/beneficio/margen) +
  anomalía@30 possible_justification_required. Matriz RULE_ENGINE (n1/n2/n3/n4,
  poda, cierre25 Tías-vs-Alfresco, fallback lowest3, igualdad-no-activa)
  comprobada a mano contra el código.
- Corrección documental: RULE_ENGINE §R2 imprimía 58.7003491543; el oráculo
  independiente dice 58.700849154476 y el motor lo reproduce. Prevalece el
  oráculo; documento corregido.
- Pendiente menor: los tests del helper traían esperados hardcodeados; un
  follow-up los está reconectando a math_vectors/demo_expected (mismo owner).
  T13 sigue en progreso: el fold AND/OR/NOT está, el cómputo de veredictos de
  hoja desde evidencias llega con servicios (T21).

## Producto T08 — biblioteca, workspace, documentos, demo (Windows)

Fecha: 2026-10-26. Rutas: GET /tenders (q/cpv/paginación), GET tender,
GET workspace, POST /demo/sessions (auto-seed en DB vacía), GET page/content.
Infra reutilizable: envelope Error + request_id (middleware+header),
guard X-BidLab-Client/Origin, idempotencia 24h con 409, response_model
generados (validación runtime contra contrato).
- `pytest integration` → 9 passed (I02 workspace: Money strings, p.6 cita
  207.088, regla 49/inversa/tias_18_5, árbol AND; demo: 201 auto-seed,
  replay 200, body-distinto 409, sin header 403; I01 intacto).
- `ruff`, `mypy` limpios (34 ficheros).
- Semilla movida a bidlab/services/seed.py (git mv); scripts/ queda fino.
- Incidencias: replay devolvía 201 porque el override de test no hacía
  commit (se replica semántica get_session); DB vacía exigió migrar antes
  de leer idempotencia; asertos sobre RootModel generados vía model_dump.

## Producto T22-backend — POST /scenarios/evaluate + curva (Windows)

Fecha: 2026-10-26. Servicio puro (sin persistencia): checks approved 422,
descuento 0–0.40, AST==template revalidado, grupos→mínimos para anormalidad,
Tías/Alfresco/RGLCAP85 (sin cierre25)/unsupported→not_applicable,
percentage_reduction→unknown en banda, complete=false→score+anomaly unknown,
traza 4–5 pasos, assumptions, source_hashes, warnings de documentos, curva
≤201 puntos (rivales fijos, score+anomalía por punto).
- `pytest integration+unit` → 103 passed (I03 Tías 5% = oráculos precio/
  beneficio/margen/puntos/rama n3_no_trim; I04 sin rivales rama n1 y 49 pts;
  curva 11 puntos monótona; I11 0.50/number/unknown-field → 422 incl.
  extra_forbidden).
- Ramas del dominio tal cual ('n1', no 'n1_single'): el contrato admite
  string ≤80; no se toca código verificado del helper por estética.
- T22 sigue in_progress: falta el UI del Pricing Lab.

## Producto T26+T25 — escenarios persistidos + informes (Windows)

Fecha: 2026-10-26. Commits 96be9fe (feature) + e930c6f (limpieza).
POST /scenarios: replay determinista del input contra el servicio puro,
stale_revision 409 (regla/compañía no vigentes), contexto congelado
(evidencias + resto de citas ordenadas, cap 100), idempotencia 24h con
409 ante body distinto. GET scenario devuelve input+result+contexto.
POST /reports + GET /reports/{id}[/html]: Jinja con autoescape, Money
como string, fuentes = citas ordenadas (se verifica la cita 207.088).
- `pytest integration+unit` → 106 passed. `ruff` limpio, `mypy` limpio
  (39 ficheros).
- Incidencias: colisión de nombre `_env` (var/función) rompía el HTML;
  `set.add` en comprensión rechazado por mypy (bucle explícito);
  el contexto solo traía evidencias y el test exigía la cita técnica →
  se incluyen todas las citas del tender (cap 100), documentado.
- Limpieza honesta: el commit 96be9fe arrastró por `git add -A` la
  carpeta local bidlab_blueprint/ (10 MB), el ZIP (7 MB) y la auditoría
  suelta; ninguno pertenece al repo (el blueprint ya estaba importado
  en docs/). Se des-rastrearon en e930c6f (ficheros intactos en local,
  .gitignore ampliado). Verificado: `.env` nunca rastreado, sin venv/
  node_modules/cachés en el índice.

## Producto T13/T21 — companies + elegibilidad (Windows)

Fecha: 2026-10-26. Helper acotado (sin commit); lead releyó servicios y
re-ejecutó gates. POST/GET/PUT /companies (revisiones versionadas,
expected_revision 409, Money string↔céntimos), POST /eligibility/check
(puro, sin persistencia): árbol AND/OR con veredictos met/not_met/
unknown por hoja, reason codes, evidence_refs (citas + refs empresa),
unknown preservado (regla no aprobada, falta evidencia, sin revisar,
unidades, periodo 3y, umbral ausente/ilegible). Rutas en contrato
(/api/v1/companies, /companies/{id}, /eligibility/check).
- `pytest unit+integration+contracts` → 141 passed. `mypy` limpio
  (44 ficheros). `ruff` limpio en ficheros T13 (2 avisos pendientes
  son del T14 aún en curso, no se tocan).
- Nota: `pytest apps/api/tests` entero colisiona por dos
  test_placeholder.py (unit + live, mismo basename sin __init__);
  los live se excluyen como en verify.py. No es fallo de producto.

## Producto T14–T18 — PDF, Meta, jobs, revisión (Windows)

Fecha: 2026-10-26. Helper acotado (sin commit); lead releyó servicios,
rutas y gates. PDF determinista (pypdf, límites 120p/100kch/64MB,
normalización nfkc-noshyphen-collapse-1 como la semilla, localización
exact/normalized_match/missing con offsets). Adaptador Meta honesto:
stub offline etiquetado fixture_stub (escenarios ok/refusal/truncated/
invalid_json), live solo con MODEL_API_KEY + META_API_URL explícita,
si no 503 provider_not_configured (nunca fixture-como-live), una sola
tentativa, validación ExtractionProposal, presupuesto que falla
cerrado. Jobs: POST analysis 202 + Location, idempotencia, ejecución
inline restart-safe (lease 10min, 409 si running), citas verificadas y
persistidas con match_status real, needs_review ante warnings/páginas
sin leer/claims débiles. Review: aprueba claim keys, corrected_proposal
opcional con citas relocalizadas (missing incluido), nueva revisión
manual + audit event, devuelve Workspace. Live test opt-in
(BIDLAB_RUN_LIVE=1) sustituye al placeholder live (fin de la colisión).
Rutas en contrato (analysis, jobs/{id}, reviews).
- `pytest unit+integration+contracts` → 187 passed. `ruff` limpio,
  `mypy` limpio (48 ficheros).
- Nota: los routers jobs/review quedaron registrados en main.py por el
  helper T14 antes del commit T13; verificado presente, sin duplicar.

## Producto T19/T20/T22-UI/T29 — Pricing Lab, informe, E2E (Windows)

Fecha: 2026-10-26. Helper acotado (apps/web + tests/e2e, sin commit);
lead re-ejecutó todos los gates. Pricing Lab contra API real: hipótesis
explícitas (rivales A/B con grupo), KPIs (precio/beneficio/puntos/
anomalía), curva, supuestos visibles; sin cómputo en frontend (los
números son strings del backend). Vista informe: guardar escenario,
crear informe, HTML con fuentes. Badge honesto (Demo curada / Análisis
en vivo / nada). Sesiones demo persistidas en localStorage (solo ids).
E2E E01–E12 + offline guard (solo loopback) + concurrencia +
responsive + seguridad.
- `npm run lint/typecheck/build` verdes, `test:unit` 8 passed,
  `test:e2e` 14 passed (29s, Chromium, API+web reales).
- `npm audit` → 0 vulnerabilidades (zod ^4.6.7, vitest ^5.0.5).
- Hallazgo del lead: primera petición sobre storage fresco devolvía
  500 `no such table: tender`. Fix: lifespan en main.py que ejecuta
  `seed.migrate()` al arrancar (tablas sí, semilla no: la demo sigue
  explícita). Re-ejecución E2E con storage borrado: 14 passed, cero
  OperationalError en el log.

## Producto T31/T32 — ensayo limpio + README reproducible (Windows)

Fecha: 2026-10-26. Commit: 8c70751 + trabajo sin commitear ajeno (ver
fallos). Entorno: Windows, Python 3.14.7, Node v26.3.0, npm 12.0.2,
uv 0.12.5, Playwright 1.64.1. Alcance: solo README.md + este apéndice;
`apps/`, `tests/` y `scripts/verify.py` intactos (verify.py funciona
bien: detecta fallos reales). Sin commit.

Ensayo limpio con storage fresco (`test-results/bidlab-t31-fresh`,
vacío al inicio; servidores propios detenidos tras el ensayo):
- `uv sync --all-packages` → exit 0 (62 resueltos, 60 verificados).
- `npm install` → exit 0, 279 paquetes, 0 vulnerabilidades; sin
  approve de esbuild (allowScripts ya fijado en package.json).
- API sobre storage vacío: primera petición `GET /api/v1/health` →
  200 `{"status":"ok","engine_version":"1.0.0","schema_version":"1.0.0"}`;
  18 tablas, alembic `0001_initial`, `GET /tenders` → `total: 0`
  (migra al arrancar, no auto-siembra). Cero 500.
- `uv run python scripts/seed_demo.py` → exit 0: tender 1, notice 1,
  scope 1, document 1, pages 6, citations 9, interpretation 1,
  rule 1, company 1+rev1, audit 2.
- `GET /tenders` → total 1 (id `tias`, ext. 2026/00006554N);
  `GET /tenders/tias/workspace` → 200; `POST /demo/sessions`
  (X-BidLab-Client + Idempotency-Key) → 201
  `{"tender_id":"tias","scope_id":"tias-whole",
  "company_id":"company-demo","mode":"demo"}`.
- Web dev: `GET /` → 200 (Vite 6.4.5); proxy `/api/v1/health` → ok;
  `/api/v1/capabilities` → mode demo, meta_configured false,
  history disabled, límites pdf 20MB/120p, curva 201.
- Tropiezos propios del ensayo (relevantes para README, no bugs): el
  id del tender es `tias`, no `1` (`/tenders/1` → 404 honesto);
  `POST /demo/sessions` exige `Idempotency-Key` además de
  `X-BidLab-Client` (sin ella → 422 honesto).

`python scripts/verify.py` → exit 1, para en `npm-lint` (diseño:
para en el primer fallo). Puertas re-ejecutadas una a una:
- PASS: deps-python, pytest-unit (144), pytest-integration-contracts
  (43; warnings deprecation alembic path_separator preexistentes),
  npm test:unit (14, incl. 6 nuevos de sources.test.ts), mypy
  (48 ficheros limpios).
- FAIL fuera de alcance (owner T23/T24, ficheros sin commitear):
  npm-lint (3 unused en PricingLab.tsx:34/38/115), npm-typecheck
  (+`sources.ts:5` importa `MetadataEvidence` inexistente en
  api/client), npm-build (falla en su paso tsc, vite no corre).
- FAIL fuera de alcance (commiteado, preexistente): ruff UP035
  `apps/api/bidlab/main.py:4` (`typing.AsyncIterator` → collections.abc).
- BLOCKED con causa: playwright-e2e (su webServer ejecuta
  `npm run build`; último verde 14 passed en T29). No re-ejecutado a
  ciegas: fallaría en el arranque por la causa ya establecida.
- README.md reescrito como guía reproducible (prereqs con versiones,
  install, run, verify, config, límites, notas honestas, licencias);
  estado de puertas fechado incluido con remisión a este log.

## Secrets scan (26-oct)

Helper read-only + corroborado por lead: 0 secretos en historial (git log -p, 29+ commits), .env sin rastrear, .gitignore cubre .env/storage/caches. PASS 4/4.

## Cierre P0 + super-review (26-oct)

verify.py final: ALL CHECKS PASSED (exit 0), 10/10 pasos verdes: deps-python, pytest-unit, pytest-integration-contracts (229 passed backend total), npm-lint, npm-typecheck, npm-build, npm-test-unit (25), ruff, mypy, playwright-e2e (23 passed, incl. 2 axe). Extras fuera de verify.py: ruff format --check limpio, npm audit 0 vulns. Nota honesta: una ejecucion previa de verify.py dio exit 1 por flake E2E en arranque en frio; dos runs completos posteriores en verde (23+23). Tablero T01-T34 all done. Candidatura NO enviada (pendiente autor).

## Oleada UX + 4 jueces (27-oct)

Reescritura UX tras revision externa (voz senior, redondeo canonico, lenguaje claro, a11y): 3 escritores (carcasa+Resumen, Precio+curva, Evidencia/Informe/Requisitos) + 7 rondas de jueces hasta PASS >=9.5 en las 4 dimensiones: J1 9.6 senior (live, 5 tareas respondidas desde titulares), J2 9.6 voz/copy, J3 10.0 a11y (live: axe + ratios medidos + teclado + zoom), J4 10.0 factual (trazado a fixtures/citas/RULE_ENGINE). ~125 issues cerradas en total (listas completas en sesiones hijas 54/55/58-71).

Bugs reales corregidos: etiqueta backend "Margen sobre coste" -> "Margen sobre ventas" en origen (services/evaluation.py:275); requisitos Volumen/Seguro enlazaban p.8 erronea por coincidencia numerica (295840.00 compartido) -> vinculo por claim key + leafCitations.test.ts; "mas barata" acotado con conjunto incompleto (Conclusion + trace); "Pendiente de calculo" residuales -> "Calculando tu resultado..."; max_points Decimal crudo -> formatMaxPoints; assumptions/pendings backend traducidos (lib/assumptions.ts, ASSUMPTION_ES completa, pendienteEs cabezas+colas); warnings ingleses (bytes/debug) a Detalles tecnicos; axe serious label-mismatch en Citas/Requisitos (aria empieza por texto visible) + cobertura axe ampliada a 5 pestanas x2 viewports; contraste primary 5.90 -> 7.76 (#2748B8, hover #1e3fa0); foco 3px; summaries 44px; etiquetas de curva solapadas escalonadas; ownGroup "own" -> "c"; tab Evidencia -> Citas (glosario); print honesto ("Imprimir / guardar en PDF" + pasos 1/2/3).

E2E: base 10 fallos por renombrado -> reparados spec a spec sin debilitar (18/18 por archivo); full final 27/27 verde (55.8s, servidores propios hermeticos). Hallazgo infra: `test-results/` bloqueado por sqlite-wal retenido por servidores huerfanos de la sesion (uvicorn 26-oct + preview 8:18) colgaba `playwright test` en arranque sin output; limpiados tras verificar orfandad (supervisor primero, puertos 8000/5173 libres verificados). Nota honesta: runs intermedios reutilizaron preview sirviendo dist vigente (rebuild en cada puerta) + API equivalente (backend identico salvo 1 literal no afirmado en E2E); veredictos validos; el full final es hermetico.

verify.py final: ALL CHECKS PASSED (exit 0), 10/10: deps, pytest-unit (164), pytest-integration-contracts (65), lint, typecheck, build, unit web (109), ruff, mypy (42 ficheros), E2E (27). Backend total 229. Sin dead code nuevo (barrido de helpers UX: todos en uso). Candidatura NO enviada (pendiente autor).

## Auditoria P0 diferencial post-UX (27-oct)

Alcance: la oleada UX solo toca presentacion + 1 literal backend. Verificacion requisito por requisito sobre el arbol final, todo verde hoy:

- Licitacion real Tias: E01 + seed idempotente (I01) en verde.
- Extraccion Meta estructurada con citas revisables: jobs/review/tests backend (65 integ+contracts) + E02/E12/drawer en verde.
- Requisitos con unknown: eligibility + E02/T23 + motivo/leafCitations (109 unit) en verde.
- Motor determinista precio + presuncion 18.5: oraculos math + 229 backend + E03-E06/E10/T23 en verde; el unico cambio backend es el literal del label (formula intacta).
- Pricing Lab hipotesis explicitas: E04/E06 + assumptions visibles (E04 afirma texto nuevo) en verde.
- Escenarios persistidos + reload: E07 + idempotencia en verde.
- Informe con fuentes + pendientes: E08 (sin secretos) + pendienteEs testeado en verde.
- Demo offline honesta: guard offline 0 llamadas (todos los specs) + badge + E09 (0 analysis) en verde.
- Sin prediccion ni historico: sin cambios de alcance en motor (H02 sigue aparcado); graficas solo describen la simulacion actual.
- README reproducible + guion 180s + candidatura draft: T32/T33/T34 done; envio pendiente del autor.
- T02/T04 siguen pending (externos del autor: admission check, rights review). T13 -> done (arbol AND/OR + evidencia verificado).

## Fix CI typecheck TS2591 (27-oct)

CI rojo en 5 pushes seguidos (runs 40460541795..40486470916): `tsc --noEmit -p apps/web` -> TS2591 `process` en vite.config.ts:6. Causa raiz: `vite/dist/node/index.d.ts:1` trae un triple-slash reference a types node y el repo no declaraba `@types/node`; en local resolvia por accidente via `C:/Users/zrano/node_modules/@types/node` (fuera del repo) -> el verde local de typecheck en verify.py era falso. Fix determinista: `@types/node` en devDependencies de apps/web (lock +18) + `"types": ["vite/client", "node"]` en tsconfig. Verificado: typecheck hermetico (`--typeRoots ./node_modules/@types`, simula runner limpio) exit 0, lint 0, build 0, unit web 109/109. CI hara el resto de gates por primera vez (nunca paso de typecheck). Confirmado: run 40487447554 success, 18/18 pasos en verde incluyendo test:e2e (2m21s).

## Ronda judge-fix UX (27-oct, en curso — docs-refresher)

Fecha: 2026-10-27 ~16:30–16:50 UTC. Árbol SUCIO (trabajo de agentes hermanos
sin commitear); esta entrada registra solo lo observado por docs-refresher.
Sin servidores arrancados (puertos ocupados por otros agentes): E2E y
verify.py completo quedan TBD.

Qué cambió (observado vía `git status`, sin commit):
- Backend nuevo: services/compare.py, services/intake.py; tests nuevos
  test_compare.py (10), test_intake_api.py (15), test_compare_logic.py (17),
  test_intake.py (11). Tocados: APIs scenarios/reports/tenders/documents,
  services jobs/meta_adapter/scenarios/reports, schemas generados, contrato.
- Web nuevo: features/company/ (CostEditor), features/intake/,
  report/CompareSection, report/openAsCopy, lib/draftStore,
  lib/evidenceFields, workspace/WorkspaceDrafts, pricing/hypotheses.
  PricingLab y tabs re-escritos (voz es-ES/tú, borradores persistentes).
- E2E nuevos (no ejecutados): compare, cost-editor, intake, ux-drafts
  specs + global-setup; helpers/config/qa-visual/e07-e08 tocados.

Gates observados por docs-refresher (mismo árbol sucio):
- `pytest apps/api/tests/unit` → exit 0, 220 dots, 0 F/E → 220 passed.
- `pytest apps/api/tests/integration apps/api/tests/contracts` → exit 0,
  90 dots, 0 F/E → 90 passed. Backend total 310.
- `pytest apps/api/tests --collect-only -q` → 311 (220 unit + 76
  integration + 14 contracts + 1 live opt-in, excluido como en verify.py).
- `npm run test:unit` (vitest, apps/web) → exit 0, 18 ficheros,
  145 tests passed.
- `ruff check .` → exit 0, limpio. `mypy apps/api/bidlab` → exit 0,
  44 ficheros limpios. `npm run typecheck` → exit 0. `npm run build` →
  exit 0, built in 3.28s.
- `npm run lint` → exit 1, ROJO (WIP ajeno, fuera de alcance docs):
  apps/web/src/features/company/CostEditor.tsx:171 error
  react-hooks/set-state-in-effect + 1 warning de disable-directive
  sin usar (misma zona). No tocado.
- E2E / verify.py completo: NO EJECUTADOS (arrancan servidores) → TBD.
  Ningún resultado E2E de esta ronda es afirmado por docs-refresher.

Nota honesta: en este entorno pytest no imprimió la línea resumen
"N passed" (solo dots + exit 0); los conteos son conteo exacto de dots
con cero F/E y exit 0. Candidatura NO enviada (pendiente autor).

## Cierre ronda 2, 27-oct (observado, orquestador)

- E2E hermético: storage por run (BIDLAB_E2E_RUN_DIR), probe
  check-ports.mjs fail-fast, reuseExistingServer:false, prune en
  global-setup. Causa raíz del acumulado: webServer arranca antes
  que globalSetup, el wipe veía el servidor propio y se saltaba.
- Suite E2E: 39/39 verde DOS veces seguidas (1.3m/run) + 39/39
  dentro de verify.py. T30 móvil verde (culpable: spans sr-only
  en links «Aportar dato»).
- verify.py: 10/10 exit 0 (deps, pytest-unit,
  pytest-integration-contracts, lint, typecheck, build,
  test-unit, ruff, mypy, playwright-e2e). Log: verify-final.log
  (no commiteado).
- Backend: 310 passed (220 unit + 90 integ/contracts), exit 0.
  Web: 146 passed (18 ficheros), exit 0. tsc/lint/ruff/format/
  mypy/build limpios.
- Jueces internos ronda 2: J1 7.5 (D1 vocabulario, D2=D4-F1,
  D3 URLs, D4 fixtures, D5 poda), J2 7.5 (F1/F2 live-regions,
  F3 44px, F4 drawer), J4 9.0 (F1 dominancia con empate);
  J3 cancelado por el autor (juzga un modelo externo).
  Aplicados: D1, D2/F1, D3 (+?prueba=), D4, D5, O3-NBSP,
  O3-doble-signo, F3-48px, F4, live vacías fuera.
- Residuales honestos: F1/F2 profundo (anunciador único +
  debounce slider), menos tipográfico U+2212, glosario en app,
  O2 precisión cabecera/exacta (diseño), O4 inglés en
  secciones técnicas colapsadas.
- Demo: docs/demo/*.png de entonces; refrescados de nuevo tras
  R01–R06 (ver entrada revision_50e07cf).
- Push/CI cancelados por el autor (puertas locales desde entonces).

## Revisión R01–R06, revision_50e07cf (27-oct, docs R07)

Fecha: 2026-10-27. Commit base: 50e07cf (árbol SUCIO con R01–R06 sin
commitear; esta entrada registra solo lo contado por docs R07, sin
ejecutar puertas con servidores). Sin push, sin CI remota (prohibidos
por el autor), sin vídeo grabado, sin jueces internos (prohibidos).

Conteos verificados hoy en este árbol (baratos, sin servidores):

- Backend: 321 tests en las rutas de `verify.py`
  (`unit + integration + contracts`), todos en verde.
  (`test_review_materialize.py`, 11 tests, se movió a
  `integration/` para entrar en puertas; 1 live opt-in excluido.)
- `npm run test:unit -w apps/web` → exit 0, 21 ficheros, 175 passed.
- `npx playwright test --list -c tests/e2e/playwright.config.ts` →
  Total: 50 tests in 16 files (specs: compare, cost-editor,
  e01-e02-e09, e03-e06, e07-e08, e10, e11, e12, intake, own-journey,
  qa-visual, r01-r04-state, r06-layout, smoke, t23-t24, ux-drafts).
- Caso oro verificado cifra a cifra: base 118336.00 + coste 90000.00
  (80000 + 10000, «Pyme de ejemplo») → 10 %: 106502.40 / 16502.40 /
  49 pts; 15 %: 100585.60 / 10585.60 / 49 pts; delta 5916.80.
  Fuentes: `fixtures/demo/expected.json` (5/15/30 %),
  `fixtures/demo/company.json`, CMP-02 (49,0 de 49 a 10 %,
  «-5916,80 €», «con los mismos puntos»), R06 («106.502,40» a 10 %),
  backend `test_golden_compare_10_vs_15` (49.000000000000 en ambas,
  deltas 5916.80, `higher_profit_same_score`) y
  `test_compare_logic.py` (16502.40).
- Literales UI entre «» de guion/runbook verificados uno a uno contra
  `apps/web/src` (+ `_indicator`/`_dominance` de
  `apps/api/bidlab/services/compare.py` para las frases de
  comparación). Formatos `es-ES` corroborados con `node -e`
  (Intl): «-5916,80 €» sin punto de miles, «+16.502,40 €»,
  «106.502,40 €», «49,0 de 49».

Puertas ejecutadas en este árbol (27-oct, `verify-final.log`):

- `python scripts/verify.py` → ALL CHECKS PASSED, exit 0 (10/10
  pasos: deps, pytest unit, pytest integración+contratos, eslint,
  tsc, build, vitest, ruff, mypy, Playwright).
- Backend: 321 passed. Frontend: 175 passed (21 ficheros).
- Playwright: 50 passed, incl. own-journey 3/3, r06-layout 4/4,
  r01-r04-state 4/4, CMP-02 (oro 10/15), axe serious+ limpio.
- Capturas docs/demo/01–08 regeneradas con
  scripts/demo-shots (base separada de E2E) e inspeccionadas:
  sin nombres de tests ni payloads, sin transiciones a medias,
  etiquetas de curva sin colisiones, 06 con prueba legible
  («Rebaja 10 %») e informe abierto.
- Ajustes del run final: specs intake al flujo de 3 pasos,
  R02 restaura la empresa demo (suite independiente del orden),
  revisión manual sin análisis abre revisión 1 (backend).

Candidatura NO enviada (pendiente autor).

## Sesión 28-oct — tour + malla + contrato stress (Windows)

Fecha: 2026-10-28. Commit base: e701fd5; árbol con 54 entradas sin
commit ni push (pendiente autor). Entorno: Windows, Python 3.14.7
(venv), datamodel-code-generator 0.86.0, openapi-typescript 7.13.0,
Chromium Playwright.

`uv run python scripts/verify.py` → ALL CHECKS PASSED, exit 0 (10/10):
deps, pytest unit (220), pytest integración+contratos (113), eslint,
tsc, build, vitest (202 en 25 ficheros), ruff, mypy, Playwright (62
en 20 specs: tour 2/2, malla 2/2, own-journey 3/3, CMP-02 oro 10/15,
E12, report-archive 4/4).
Nota harness: el run completo imprimió ALL CHECKS PASSED pero el
wrapper reportó exit 1 por artefacto PowerShell 5.1 (stderr→ErrorRecord
contamina $?); re-run `--skip-e2e` dio exit 0 explícito y el E2E dio
`62 passed` + `playwright-e2e: exit 0` en el mismo árbol.

Correcciones con causa raíz (fallos heredados, no ocultados):
- Plantilla informe: línea «Archivado» exigía scenario.input (2 tests)
  → render condicional; «Empresa {id} rev.» unificado con pantalla.
- Contrato: rutas stress fuera del contrato (1 test) → 11 esquemas +
  2 ops + 4 códigos en tools/build_contract.py (27 paths/29 ops/79
  schemas/104 códigos); regen YAML (+518), generated.py (+168),
  generated.ts; rutas al patrón; servicio a modelos g; cliente TS
  a alias generados. Solo adiciones en los tres regenerados.
- E12: spec anterior al requisito de decisión → marca decisión
  antes de exportar (mismas aserciones de seguridad).
- report-archive: «Empresa rev. 1» absoluto frágil en almacenamiento
  compartido → consistencia pantalla/HTML con rev extraída.
- Lint: import sin usar en p0-context.spec.ts.

Tour verificado + TourBar (?tour=1, 4 pasos DOM reales, E2E 2/2) y
malla E2E 2/2. Fallos propios hallados por E2E y corregidos: assert
de precio exacto, espera de estado en perform, setter nativo para
inputs React, NBSP en regex.

Capturas docs/demo/01–08 regeneradas (scripts/demo-shots, exit 0) e
inspeccionadas 01/02/06/08: sin barra, sin restos de test, móvil
sin roturas, oro 10 % legible.
Footage real sin narración: docs/demo/footage-oro-20261028.webm
(1.356.313 bytes, EBML ok, scripts/demo-video exit 0). Vídeo
narrado de 180 s pendiente (autor). Guion actualizado.

US01–US13 re-verificadas 28-oct (mapeo original en entradas T):

| US | Evidencia 28-oct | Estado |
|---|---|---|
| US01 | E01/E09 + 01-resumen | PASS |
| US02 | E02 p.6 + citas | PASS |
| US03 | OR requisitos + E2E | PASS |
| US04 | E03–E06 + CMP-02 | PASS |
| US05 | E04 + T23 unknown | PASS |
| US06 | Oráculos 30 % + avisos | PASS |
| US07 | T24 trazas backend | PASS |
| US08 | e07-e08 + drafts + R01–R04 | PASS |
| US09 | report-archive 4/4 + plantilla | PASS |
| US10 | smoke real + jobs; live frontal ausente (*) | PARTIAL |
| US11 | límites PDF + E12 bytes | PASS |
| US12 | history off + sin predictor | PASS |
| US13 | E12 + offline guards + intake | PASS |

(*) US10: adapter + jobs + smoke Meta real probados; sin extracción
en vivo en el frontal, declarado en guion/runbook. Bloqueo visible,
no éxito simulado.

DoD P0 (PRD): 12 PASS + US10 parcial-visible; G3 smoke real;
UI/API/export sin discrepancia (conformance + report-archive);
oráculos verdes incl. stress A/B; build + Chromium verdes;
instalación vía README + deps-python; ensayo 180 s con footage
real, narración pendiente autor.

Segundo run completo 28-oct: `uv run python scripts/verify.py`
exit 0 explícito, 62/62 E2E (dos ensayos verdes en el mismo árbol).
Footage probado con ffprobe: VP9 800×450, 15,12 s, 1.356.313 bytes;
fotogramas t=3 s (Resumen Tías) y t=11 s (Precio «Demo 15»,
100.585,60 €, 49 puntos) inspeccionados: app real, sin defectos.

Candidatura NO enviada (pendiente autor). Sin commit/push.

## Plan Integral PKG-T01 + PKG-T02 — recibos live y reserva (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 31c0e8d. Entorno: Windows,
Python 3.14 (venv), SQLite WAL. Sin red (mocks de transporte;
0 llamadas reales).

Reproducción B01–B05 contra checkout real con la sonda del
paquete (`evidencia/probe_backend.py`, exit 0): B01
mode=fixture + tokens null; B02 6/6 procesadas sin avisos;
B03 sin tope de salida; B04 solo inspección; B05 callback
152,3 ms. Idénticos a `evidencia/backend-probes.json`.

PKG-T01 (recibo antes de validar): `Receipt` en
`services/meta_adapter.py` (mode/model/id/usage/coste/
latencia/sent/failed|uncertain); `AdapterError` lo porta;
`LiveExtractor` lo extrae del body crudo antes de validar
propuesta; timeout → uncertain + sent; error de conexión →
failed + not-sent; `_fail_job` persiste el recibo.
PKG-T02 (reserva atómica): `services/budget.py` nuevo
(micro-USD enteros), tablas `model_spend_account` (fila
única) + `model_spend_reservation` (migración 0005,
upgrade/downgrade probados, head único); admisión en un
`UPDATE` condicional en sentencia única (sin `IMMEDIATE`,
no portable en pysqlite/SQLAlchemy); `run_job` reserva
antes de red y liquida tras ella (coste informado, o
estimación si falta uso; solo lo no-enviado libera);
`check_live_budget` sobre el ledger; commit del claim
running antes de reservar (anti-interbloqueo SQLite,
crash-safe por lease).

Desviaciones documentadas del paquete: `uncertain` se
liquida de inmediato por la estimación (fail-closed, sin
endpoint de reconciliación en P0); `mark_uncertain` queda
para reconciliación futura + tests.

Evidencia:
- Backend: unit 237 + integración/contratos 118 = 355
  passed (22 nuevos: ledger 12 incl. concurrencia a 2
  hilos, adapter 5, jobs integración 5), exit 0.
- `ruff check apps/api/bidlab/ apps/api/migrations/`,
  `ruff format --check apps/api/`, `mypy
  apps/api/bidlab` (47 ficheros): verdes.
- Migración: tablas + seed (1,0,0) + version 0005
  verificados tras downgrade -1 → upgrade head.
- Re-sondeo post-fix (sonda sin asserts del viejo
  comportamiento): B01 recorded_mode=live,
  tokens 12000/3000, coste 0.027750 (FIXED); B02/B03/B05
  sin cambios (pendientes PKG-T04/T06/T03); B04 de la
  sonda es texto estático del paquete, no medición.
- Tests heredados intactos: 429 budget_exhausted con job
  failed + invocation live, fixture modes, live_spend
  3.75, envelope {model,messages,response_format}.

## Plan Integral PKG-T03 — admisión async + worker (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 323bc7c. Entorno: Windows,
Python 3.14 (venv), Chromium Playwright. Sin red.

POST /analysis admite (validaciones + 429 rápido con
auditoría) y devuelve 202 queued; `services/worker.py`
nuevo (hilo daemon + cola FIFO, arranque/parada en
lifespan, re-encola huérfanos queued/failed/expirados al
arrancar) ejecuta claim CAS (status/lease/generation,
migración 0006) → extract sin transacción abierta →
publicación con fence de generación (rollback si el claim
  caducó). `run_job` inline eliminado; fases
claim/execute/publish + `run_claimed_attempt` +
`cancel_queued_job` (perdedor de carrera de
idempotencia). Sin cambio de contrato (Job ya incluía
queued/running; front ya hacía polling).

Evidencia:
- Backend: unit 243 + integración/contratos 120 = 363
  passed, exit 0 (11 tests de fases incl. CAS, fence
  sin efectos, execute sin clave, bloqueo worker;
  integración con polling real + proveedor lento que
  no bloquea health/polling + re-encola).
- `ruff check apps/api/`, `ruff format --check
  apps/api/`, `mypy apps/api/bidlab` (48 ficheros):
  verdes. Migración 0006: head único, downgrade -1 →
  upgrade head exit 0.
- E2E servidor real: own-journey 3/3, tour 2/2,
  stress 2/2 (polling frontal lleva a terminal).
- Front: eslint + tsc exit 0 (solo comentario
  honesto en AnalysisTracker; lógica intacta).
- 409 job_running retirado (claim devuelve None);
  código sigue permitido en contrato.

## Plan Integral PKG-T04 — cobertura de páginas (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 4cf5c8b. Entorno: Windows,
Python 3.14 (venv), Chromium Playwright. Sin red.

`pdf.coverage()` nuevo (puro, adaptado de la referencia):
físico/usable/entregado por página, sin confundirlos;
vacía → no cuenta + `empty_text_not_coverage`;
duplicadas/fuera de manifiesto/totales inválidos →
ValueError; imágenes pendientes de PKG-T05. `jobs`:
processed = usable (B02), warnings de cobertura en job,
bloque `coverage` en manifest, requires_attention fuerza
needs_review. `workspace`: warnings de cobertura en
get_workspace (llegan a la revisión). Render: filas
accionables primero + resumen de faltantes por
documento. Sin cambio de contrato (warnings/manifest
son libres).

Evidencia:
- Backend: unit 251 + integración/contratos 122 = 373
  passed, exit 0 (8 tests coverage incl. truncado,
  missing, duplicados, overflow; B02 corregido:
  6 vacías → processed 0/41 + needs_review +
  warnings en job, manifest y workspace).
- `ruff check/mypy` verdes en pdf/jobs/workspace.
- E2E completa 62/62 (tracker muestra warnings;
  ninguna aserción exacta de warnings rota).

## Plan Integral PKG-T05 — render versionado (28-oct, Windows)

Fecha: 2026-10-28. Commit base: cb6f6c3. Entorno: Windows,
Python 3.14 (venv), pymupdf 1.28.2, Chromium. Sin red
salvo PyPI para la rueda autocontenida.

`services/render.py` nuevo: raster PyMuPDF (ruedas
autocontenidas, sin deps SO), cada página declara
versión/DPI/página/dimensiones/sha; `cache_key`
fingerprint estable (versión+backend+DPI+página+sha
PDF); errores tipados; PNG deterministas; almacén
`uploads/<tender>/<doc>.render-<versión>/` + manifest
o manifest `failed` con código. `intake` renderiza tras
ganar idempotencia; un fallo de render nunca tumba el
upload (manifiesto failed). Sin migración (ficheros +
manifiesto; T06 leerá imágenes de disco).

Hallazgo paquete: TAREAS cita ayudas inexistentes
(`render.py`, `cache_matrix.json`, `render-matrix.json`,
`jobs.py`, `attest.py`, `observations.py`,
`hybrid-meta.py`, `meta-payload.py` con guion); la
referencia real es `meta_payload.py` + `identity.py` +
`test_reference.py`. T05 se implementó desde la
aceptación + `identity.fingerprint` como convención.

Evidencia:
- Backend: unit 260 + integración/contratos 123 = 383
  passed, exit 0 (9 render incl. matriz A/B/A/B,
  determinismo, límites, roundtrip + traversal;
  upload→PNG+manifest).
- `ruff check`, `ruff format --check`, `mypy`
  (49 ficheros): verdes (4 `type: ignore`
  localizados por stubs parciales pymupdf).
- E2E completa 62/62 (uploads renderizan en ruta).
- Deps: `pymupdf>=1.24,<2` (línea v1, sin extras
  2.0); uv.lock +20 líneas solo.

## Plan Integral PKG-T06 — payload híbrido acotado (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 32e2d07. Entorno: Windows,
Python 3.14 (venv), Chromium. Sin red (mocks).

`build_hybrid_request` único camino live (B03): 1–6
páginas, texto ≤100k, imágenes ≤5MB png/jpeg con id
de servidor y dimensiones exactas, `max_completion_tokens`
128–16384 (defecto 4096), `reasoning_effort` solo
opt-in validado (no verificado en Spark: no se envía),
`response_format` strict + nombre v1, paquete manifiesta
SHAs/identidad. `validate_claim_sources` rechaza citas
fuera del paquete con recibo conservado (aceptación 3).
`PageInput` lleva imagen opcional; `execute_attempt`
carga PNGs del render (solo live, best-effort) y guarda
el packet en el manifest; `coverage` cuenta
image_submitted; `budget` reserva con el tope real
4096. Prompt bump `bidlab-extract-2`. Sin cambio de
contrato API (schema v1; v2 en PKG-T07).

Aceptación 2 (SME confirma precios/parámetros Spark
1.3 Standard): PENDIENTE del autor — no puedo
confirmarlo yo; tarifas ya en código desde precios
publicados; `reasoning_effort` omitido por no
verificado.

Evidencia:
- Backend: unit 267 + integración/contratos 124 = 391
  passed, exit 0 (matriz de topes híbridos, identidad
  estable, bindings, rechazo fuera de paquete con
  recibo, upload→imagen en payload capturado +
  packet persistido, coverage con imagen).
- `ruff check`, `ruff format --check` (90 ficheros),
  `mypy` (49): verdes. E2E completa 62/62.

## Plan Integral PKG-T07 — observations v2 con fuentes (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 01c2d9e. Entorno: Windows,
Python 3.14 (venv), Chromium. Sin red (mocks).

Contrato live pasa a observations v2 (fuentes exactas:
doc sha + página física + image id/sha + bbox 0–1000;
`schema_version: 2.0-proposal`, strict, nombre
`bidlab_observations_v2`): `schemas/observations.py`
hecho a mano desde `contratos/observations.schema.json`
del paquete (régimen strict, bbox como array JSON,
caja propia validada). `validate_observation_sources`
liga cada eco al paquete enviado (triple documento,
imagen exacta, bbox sin imagen rechazado, ids
duplicados rechazados). `observations_to_proposal`
adapta a v1 interno: valores a `raw_value` (normalized
null hasta revisión humana), qualifiers/bbox en notas,
template `unsupported` sin adivinar, v2 crudo en
`packet["observations"]` del manifest para auditoría.
API pública sigue v1 (opción compat del paquete).

Truncados con marca `…` (slots v1 acotados; crudo
intacto en manifest): excerpt 600, literales 2000/4000,
notas/warnings 2000, unit/key 80. Presupuestos por
construcción: ≤1 claim/obs (40/80), warnings ≤27/30,
notas ≤8/10. `ruff exclude` añade `BidLab_*`
(inputs del autor, no código producto; el gate CI
`ruff check .` fallaba por estilo de terceros).

Aceptación: ejemplo del paquete valida (2 obs + bbox);
bindings rechazan 7 mutaciones; round-trip live con
imagen+bbox mapea a v1 y persiste el v2; terminales
`needs_review` intactos. SME Spark sigue pendiente.

Evidencia:
- Backend: unit 295 + integración/contratos 124 = 419
  passed, exit 0 (+28: contrato, bindings, adapt,
  round-trip live imagen+bbox, eco de bindings en
  integración con v2 persistido).
- `ruff check`, `ruff format --check` (92 ficheros),
  `mypy` (50): verdes. E2E completa 62/62.

## Plan Integral PKG-T08 — prompts con unidades/ámbito (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 1d40a82. Entorno: Windows,
Python 3.14 (venv), Chromium. Sin red (mocks).

`HYBRID_SYSTEM_PROMPT` ampliado (bump `bidlab-extract-3`,
registrado en manifest): PBL/estimado y neto/bruto como
observaciones distintas que nunca se fusionan (currency,
tax basis y reference kind literales, sin convertir);
plazo inicial y cada prórroga separados con su segmento
(sin sumar); lotes con su scope id; unidades literales
en tokens cortos; dos candidatos → una observación cada
uno + conflicto en `ambiguities`. Evidencia no
instruccional intacta. Nuevo
`examples/observations_prompt_gold.json` (sintético
rotulado, 4 snippets + 6 obs esperadas con sha256 real
de los snippets) demuestra las separaciones y adapta a
v1 con notas distintivas.

Aceptación 1–3: sentencias normativas presentes,
acotadas (prompt ≤2000 chars) y ejemplo que valida.

Evidencia:
- Backend: unit 300 + integración/contratos 124 = 424
  passed, exit 0 (+5: 3 prompt, 2 ejemplo v2→v1).
- `ruff check`, `ruff format --check` (92 ficheros),
  `mypy` (50): verdes. E2E completa 62/62.

## Plan Integral PKG-T09 — recorrido real en UI (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 3112aa1. Entorno: Windows,
Python 3.14 (venv), Chromium. Sin red (mocks/proveedor
simulado en tests).

Aceptación 1 (invocación verificable): `Job` gana 7
campos aditivos de la última invocación
(`invocation_id`, `mode` fixture/live, `model`,
tokens, `estimated_cost_usd`, `provider_request_id`,
`latency_ms`; nulos sin intento). Regen exact-repro
pinneado: builder → YAML (+65, 0 restas, 27/29/79
intactos) → generated.py (+34/−1 timestamp) →
generated.ts (+8). `job_to_dict` lee la invocación
más nueva (modo foráneo → null, strings acotados).
El tracker muestra la clase de ejecución y los hechos
en Detalles técnicos.

Aceptación 2 (puntos bloqueados pre-revisión, motor
tras aprobar): ya cubierta (Precio bloqueado +
simulación post-revisión); sigue verde sin cambios.

Aceptación 3 (recarga sin duplicar): `analysisJobStore`
(versionado, `bidlab.analysis.v1`) persiste el trabajo
seguido; el tracker rehidrata con un GET y retoma el
polling; `key` por licitación evita fugas entre
licitaciones; fallo de persistencia avisa en UI.

Nota: respuestas `Job` idempotentes guardadas <24h
antes del cambio carecen de las claves nuevas (solo
afecta a storage local de desarrollo; E2E/CI parten
de storage fresco).

## PKG-T15 — evidencia exacta (Windows)

Fecha: 2026-10-28. Merge: aadab7c (rama helper
6f9ba9ef34f984e179e68e806654b0f5419e347e sobre
9ca02de; el helper informó un SHA largo distinto
con el mismo prefijo — merge con SHA verificado
por el lead). Entorno: Windows, Python 3.14
(venv), Chromium. Sin red.

Aceptación 1 (imagen exacta, nunca falsa):
`GET /documents/{id}/pages/{n}/image` sirve el
PNG del render versionado con SHA verificado
contra el manifiesto (ETag=SHA, Cache-Control
inmutable); 404 `document_bytes_unavailable`
cuando no hay render, 404 `page_not_found`
cuando la página no existe, 500 `internal`
solo si el PNG almacenado no coincide con su
hash. Códigos ya declarados en el contrato.
El drawer muestra la imagen con estado
carga/lista/ausente; en falta, texto explícito
«Esta página no tiene imagen. Coteja con el
texto de abajo» — ninguna vista previa falsa.

Aceptación 2 (foco al cerrar): el drawer
devuelve el foco al elemento que lo abrió.

Aceptación 3 (cita vs revisión): la línea de
cita usa vocabulario de localización máquina
(«Copiado tal cual», «Localizado a mano»…)
y el checkbox usa revisión humana («Lo
confirmas» / «Por verificar»); sin mezcla.

Gates en main (lead, post-merge): backend
458/458 exit 0, ruff check + format OK (fix
lead: línea larga en test_page_image.py),
mypy 51 ficheros OK, vitest 212 (+2
citaEstadoEs verificados contra baseline 4→6),
eslint + tsc exit 0, build OK, E2E 70/70
(67 + 3 t15-evidence). YAML +51/−0,
generados regen.

Evidencia:
- Backend: unit 303 + integración/contratos 124 = 427
  passed, exit 0 (+3 job_to_dict; detalle live/fixture
  en integración).
- Front: vitest 208 (26 ficheros, +6 store), eslint,
  tsc, build: verdes.
- `ruff check`, `ruff format --check` (92 ficheros),
  `mypy` (50): verdes. E2E completa 63/63 (+1 recarga).

## Plan Integral PKG-T12 — búsqueda/paginación servidor (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 27d3023. Entorno: Windows,
Python 3.14 (venv), Chromium. Sin red (API local real).

Aceptación 1 (expediente 102 desde búsqueda): `q` del
servidor cubre título + expediente + CPV (antes solo
título/expediente; el front filtraba en cliente sobre
100). Con 21 licitaciones, `q=102` devuelve total 1
(`2026/00102`) y el ítem de la página 2 se recupera
por `q` (el orden por id aleatorio impide asumir
posición; el test lo resuelve sin orden). Sin cambio
de contrato (q/cpv/page ya declarados).

Aceptación 2 (consulta/página al volver): `q`/`page`
(`page_size` honrado) viven en la URL; debounce
300 ms; volver de detalle conserva ambos.

Aceptación 3 (sin filtros sin soporte): desaparece el
filtro cliente; la etiqueta (título/expediente/CPV)
es ahora literalmente cierta en servidor; sin otros
filtros anunciados. Pushdown SQL a P1/T27.

Evidencia:
- Backend: unit 303 + integración/contratos 127 = 430
  passed, exit 0 (+3 test_tenders.py).
- Front: vitest 208, eslint, tsc, build: verdes.
- `ruff check`, `ruff format --check` (93 ficheros),
  `mypy` (50): verdes. E2E completa 65/65 (+2
  library-search: búsqueda+retorno, paginación).

## Plan Integral PKG-T13 — malla: topes, errores, vigencia (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 8a0beb7. Entorno: Windows,
Python 3.14 (venv), Chromium. Sin red (API local real).

Aceptación 1 (10×6 computable): 10 rebajas × 6
hipótesis = 60 celdas verificadas en integración.
Topes únicos en contrato (81/9); se eliminan las
constantes muertas del servicio (duplicaban sin
aplicar).

Aceptación 2 (422 con lista de campos): exceso →
`validation_error` con rutas; coste 0 →
`stress_cost_invalid` + `hypotheses[i].cost_net`;
límites 0 → `stress_constraints_invalid` + ambos
campos; rebaja fuera de rango → `discount_out_of_scope`
+ `candidate_discounts[i]` (antes el dominio lanzaba
sin posición; patrón de evaluation). Sin códigos
nuevos (enum 104 intacto, sin regen). Front traduce
rutas a español (`stressDetailsEs` + 2 mapeos).

Aceptación 3 (vigencia): el resultado congela
regla/empresa; si cambian, banner «Vuelve a probarla»
+ «Calculada el {fecha-hora es-ES}» siempre visible.

Evidencia:
- Backend: unit 303 + integración/contratos 133 = 436
  passed, exit 0 (+6 malla).
- Front: vitest 210 (+2), eslint, tsc, build: verdes.
- `ruff check`, `ruff format --check` (93 ficheros),
  `mypy` (50): verdes. E2E completa 66/66 (+1
  vigencia malla).

## Plan Integral PKG-T14 — ruta visual diseno_anterior (28-oct, Windows)

Fecha: 2026-10-28. Commit base: 9ca02de. Entorno: Windows,
Python 3.14 (venv), Chromium. Sin red.

Aceptación 1 (tokens, sin piezas nuevas): solo
`styles.css` (@theme + body + foco): surface/ink/
muted/soft/line/border/alert/warn/error/chart del
`:root` del prototipo; primary idéntico; hover/ink
oscuros conservados (sin equivalente, contraste);
foco offset 4px; interlineado 1.55. Sin página
nueva (sería una pieza; el listado del paquete era
aspiracional). Decisión D28-3: base 18px del
prototipo NO aplicada (reescala rem global;
follow-up con QA visual si el autor la quiere).

Aceptación 2 (demo y tour intactos): E2E 67/67
(incluye tour + axe contraste), capturas 01–08
regeneradas e inspeccionadas (escritorio+móvil
legibles, sin desbordes).

Evidencia:
- Backend: 436 passed sin tocar (exit 0).
- Front: vitest 210, eslint, tsc, build: verdes.
- `ruff check`, `ruff format --check` (93 ficheros):
  verdes (mypy no aplica: sin cambios py).
- E2E completa 67/67 (+1 prototipo.spec: estilos
  computados body/muted/foco).

## Plan Integral PKG-T10 — gold humano + partición (28-oct, Windows)

Fecha: 2026-10-28. Base: 9ca02de en worktree
`.worktrees/t10`, merge --no-ff a main (456c5a1).
Helper implementó, lead verificó e integró. Sin red.

Aceptación 1 (gold humano): `examples/gold_claims.json`
intacto (25 claims g01–g25, kind manual_initial_gold,
con fichero+sha+página+cita). `load_gold` rechaza
kind distinto; test cruza los 5 sha contra
`evidence/download_manifest.json` (verificado por el
lead: 5/5 presentes). Cubre importes, periodos y
fórmulas/anormalidad. Límite honesto: `evidence/
originals/*.pdf` no está en el repo → citas no
re-verificables in-repo; shas fijados al manifest.
Valida como v1 (jsonschema + pydantic) y v2.

Aceptación 2 (partición): `evidence/
evaluation_split.json`: dev = Tías 20777838 (14
claims, caso semilla), eval = 4 expedientes
retenidos (11 claims), unidad (expediente, sha).
`check_split` impone cobertura, integridad por
expediente y regla no-hermanas (verificado por el
lead en lectura + tests).

Aceptación 3 (denominador): `score` cuenta todo
eval (ausente → unsupported, 0 puntos pero cuenta).
CLI `scripts/score_extraction.py` verificado por el
lead: exit 0 (11 claims, accuracy 1/11 en sonda) y
exit 2 con fichero inexistente.

Evidencia (verificada por el lead en main):
- Backend: unit 319 + integración/contratos 133 =
  452 passed, exit 0 (+16 test_extraction_eval).
- `ruff check`, `ruff format --check`, `mypy`:
  verdes (re-ejecutados por el lead).
- E2E no re-ejecutada: sin diff en API/front
  (67/67 vigente del commit anterior).

## PKG-T11 — comparativa texto vs híbrido medida (Windows, helper t11)

Fecha: 2026-10-28. Worktree .worktrees/t11 (detached sobre
a870598; commit local al final de esta sección, pendiente de
merge por el lead). Entorno: Windows, Python 3.14 (venv
del worktree). Cero llamadas de red en todo el paquete
(tests con sockets bloqueados + credencial fregada).

DECISIÓN D-T11-1 (ubicación): el comparador vive en
`apps/api/bidlab/services/extraction_compare.py` (junto a
`extraction_eval.py`, importable por el CLI) y sus tests en
`apps/api/tests/evaluation/test_compare_modes.py`; el CLI es
`scripts/compare_extraction.py` y el artefacto
`evidence/extraction_comparison.json`. `scripts/verify.py`
incluye el nuevo directorio en el paso pytest-unit.

Aceptación 1 (texto medido offline): `run_text_mode`
ejecuta el StubExtractor real una vez por página eval
(6 llamadas, texto de entrada vacío documentado: el
fixture lo ignora y los originales están fuera del
repo por B04), mapea la propuesta v1 a predicciones
con el MISMO mapper que usará el híbrido y puntúa
con `ev.score`. Medido: n_eval=11, hits=0, miss=0,
unsupported=11, accuracy=0, críticos=[], latencia
p50=0.004ms/max=0.009ms (reales por llamada),
coste 0 micro-USD + motivo fixture, tokens null.

Aceptación 2 (híbrido blocked honesto): sin
MODEL_API_KEY ni META_API_URL en el worktree
(verificado: sin .env, sin originales), el gate
`select_adapter("live")` devuelve 503 y el modo
híbrido queda `blocked` con motivo G3: TODAS sus
métricas en null (nunca cero), cero llamadas live.
Escalera de rechazo verificada en tests: sin
credencial → G3 aunque haya --allow-live; con
credencial pero sin flag → no habilitado; con
flag pero sin textos → sin textos. La rama de
ejecución live existe (misma interfaz) pero NO se
ejecutó ni se cubre con tests de red: queda
explícitamente no-verificada-live.

Aceptación 3 (artefacto): CLI exit 0 escribe el
JSON con n total/dev/eval, tabla por caso (11
filas: predicción, veredicto, latencia, crítico,
estado de revisión esperado), agregados texto,
bloque híbrido blocked y limitations (n=11
pequeño, 4 expedientes, sin live). Re-ejecución
verificada: mismas métricas. CLI exit 2 con gold
inexistente o --page-texts malformado. Regla de
criticidad documentada en el artefacto: miss en
EUR/months/years/fórmula; unsupported nunca
crítico (pero en denominador).

Evidencia (helper, en el worktree):
- Backend: 472 passed, exit 0 (458 base + 14
  test_compare_modes; 0 fallos, 0 skips).
- `ruff check .`: exit 0. `ruff format --check`
  en los 4 ficheros propios: exit 0 (3 ficheros
  preexistentes ajenos siguen sin formato:
  docs/ARCHITECTURE.md, docs/DATA_MODELS.md,
  scripts/dev.py; no tocados).
- `mypy apps/api/bidlab`: 52 ficheros, exit 0.
- `scripts/compare_extraction.py`: exit 0
  (artefacto) y exit 2 (gold ausente).
- E2E/front no tocados ni re-ejecutados.

Evidencia (lead, en main tras merge e772954):
- SHA del helper verificado (e8bfa52...acef48
  coincide); merge limpio sobre e6d21b0.
- Backend: 472/472 exit 0 (unit + evaluation +
  integración + contratos). `ruff check .` en
  raíz: exit 0. `ruff format --check` en
  apps/api: 98 ficheros OK. `mypy`: 52 OK.
  (Nota: verify.py no tiene paso format; la
  mención del helper a .md sin formato no
  afecta a ningún gate.)
- CLI re-ejecutado por el lead: exit 0 con
  números idénticos (0/0/11, p50 0.004, max
  0.009); exit 2 con gold ausente. Solo
  difieren 3 latencias por caso en ±0.001 ms
  (jitter de medición real) + timestamp:
  prueba de que son medidas, no fijas.
- E2E completa 70/70 en main post-merge.
- Crítico PKG-T01–T11 cerrado.

## PKG-T21 · Qué coste rompe este beneficio mínimo (helper, worktree t21, 28-oct)

Decisión de exposición: extender la respuesta de stress existente con el
techo por rebaja (`StressByDiscount.price_net` + `max_cost_net`, ambos
`Money|null`), en vez de un endpoint nuevo. Motivos: (1) el techo solo
tiene sentido bajo la misma base que la malla (precio/periodo/moneda ya
fijados por el run); (2) la UI ya consume `by_discount` y la selección,
así que la línea «Con este precio y este mínimo, tu coste máximo es X»
es una búsqueda directa sin cálculo en el front; (3) el cambio de
contrato es solo aditivo (builder → YAML → regenerados, 0 restas).
Disclaimers como copia estática (misma base; no incluye cambios futuros
de precio, otros criterios ni elegibilidad legal; no es probabilidad ni
predicción de rivales).

Implementación (offline, Decimal, API strings, unknown=null):
- `apps/api/bidlab/domain/money.py`: `cost_ceiling(price, min_profit)`
  pura (parse_decimal, None si negativa, rechaza negativos/float).
- `apps/api/bidlab/services/stress.py`: techo por fila desde el precio
  de la rebaja menos `min_profit_net`; null sin celda con precio.
- `tools/build_contract.py` → `docs/API_CONTRACT.yaml` (+22/−0) →
  `generated.py` / `generated.ts` regenerados con las versiones
  fijadas del builder.
- `StressSection.tsx`: columna «Tu coste máximo» + bloque de techo
  para la rebaja seleccionada (`stress-cost-ceiling`) con disclaimers.

Evidencia (comandos reales en .worktrees/t21, commit del helper):
- `uv run pytest apps/api/tests/unit apps/api/tests/evaluation
  apps/api/tests/integration apps/api/tests/contracts` → 479 passed,
  exit 0 (472 base + 4 unit + 3 integración).
- Paridad motor real (`test_breakpoint.py`, ejemplo sintético
  rotulado): 96135.68 → beneficio 8000.00, 96135.69 → 7999.99, precio
  104135.68 y score 47.053997246669 idéntico (mismos números que la
  referencia breakpoint-engine.json).
- `uv run ruff check .` → exit 0; `ruff format --check apps/api` →
  100 ficheros OK, exit 0; `mypy apps/api/bidlab` → 52 ficheros OK,
  exit 0.
- `npm run lint` / `typecheck` / `build` / `test:unit` → exit 0
  (vitest 212/212).
- `npx playwright test -c tests/e2e/playwright.config.ts
  tests/e2e/stress.spec.ts` → 4/4, exit 0 (incluye el test nuevo del
  texto del techo y sus disclaimers).
- `python scripts/verify.py --skip-e2e` → ALL CHECKS PASSED, exit 0.

Evidencia (lead, en main tras merge 2173d4d):
- SHA del helper verificado; merge limpio sobre
  080a940. Aritmética del ejemplo del contrato
  comprobada (104135.68−8000=96135.68 ✓).
- Backend 479/479 exit 0, ruff check (raíz) +
  format (apps/api, 100) + mypy (52) verdes.
- Front: vitest 212, eslint, tsc, build verdes.
- E2E completa 71/71 (70 + techo de coste).
## PKG-T20 · Radar de incoherencias con dos evidencias (helper-dominio-t20)

Fecha: 28-oct-2026. Jaula: .worktrees/t20 (HEAD base 080a940,
detached). Commit: PKG-T20 (ver `git log` en el worktree).

Decisión dimensión/versión (documentada en
`apps/api/bidlab/services/consistency.py`):
- Dimensión = los 6 ejes del qualifier (scope_id, unit, currency,
  tax_basis, period_segment, reference_kind). Solo compara si los 6
  son iguales; null vs valor = incompatible, null vs null =
  compatible (sin evidencia de diferencia; la pregunta sigue neutra).
- Versión = document_sha256. Compatible = ambas fuentes identifican
  su versión (el esquema siempre la trae). Parejas del mismo
  documento (PCAP p.10 vs p.20) y cruzadas (PCAP vs PPT) comparan;
  la versión nunca bloquea pero queda registrada (same_document).
- Cableado honesto: las observaciones v2 no se persisten por
  licitación (solo propuesta + hashes de manifiesto), luego no hay
  pares reales en el flujo actual. El informe sirve items reales
  (hoy []) + ejemplo sintético rotulado `synthetic: true`,
  producido por el comparador real, nunca escrito a mano. La UI
  muestra «Sin pares comparables» + el ejemplo rotulado.
- Superficie API: extensión aditiva de la respuesta existente
  Workspace (`consistency: ConsistencyReport`) en vez de endpoint
  nuevo: Revisar ya consume workspace, cero rutas/fetch nuevos,
  contrato aditivo (0 restas: solo timestamp + línea extendida).

Gates (todos dentro del worktree, exit codes observados):
- `uv run --package bidlab-api pytest apps/api/tests -m "not live"`.
  Exit 0: 495 passed, 1 deselected (live). Incluye 21 tests nuevos
  `unit/test_consistency.py` (negativos neto/bruto, PBL/estimado,
  lotes, prórrogas; positivos mismatch con dos fuentes) + 2 nuevos
  `integration/test_consistency_api.py` (shape Workspace).
- `uv run ruff check .`. Exit 0.
- `uv run ruff format --check apps/api`. Exit 0 (101 ficheros).
- `uv run mypy apps/api/bidlab`. Exit 0 (53 ficheros).
- `npm run test:unit -w apps/web`. Exit 0: 216 passed (28 ficheros;
  nuevos radarCopy + RadarSection render + schemas negativa).
- `npm run typecheck`. Exit 0. `npm run lint`. Exit 0.
- `npm run build`. Exit 0.
- E2E `npx playwright test -c tests/e2e/playwright.config.ts
  t20-radar`: exit 0, 1 passed (vacío honesto + ejemplo sintético
  con ambas páginas y pregunta, offline guard 0 bloqueos).
- E2E completa `npm run test:e2e` (puertos estándar): exit 0,
  71 passed (70 base + t20-radar). Nota: con BIDLAB_PORT/
  BIDLAB_WEB_PORT alternos la suite falla global con 403 porque
  ALLOWED_ORIGINS fija 8000/5173 (limitación preexistente, sin
  relación con este paquete; no se tocó).
- Regen exact-repro: base byte-idéntica antes del cambio (YAML +
  generated.ts; generated.py solo timestamp); tras el cambio
  `python tools/build_contract.py` (79 → 82 schemas) +
  datamodel-codegen 0.86.0 + openapi-typescript 7.13.0, diff
  aditivo verificado línea a línea.
- Offline: cero llamadas Meta (comparador puro + fixtures).

Evidencia (lead, en main tras merge 0f939a5):
- SHA del helper verificado; decisión
  dimensión/versión aceptada y documentada
  (versión identificada, no bloqueante; el
  radar cruzado PCAP/PPT es el caso de uso).
- Fusión con T21 (base común 080a940): 3
  conflictos. build_contract.py auto-fusionó
  ambos hunks; YAML + generated.py/.ts
  REGENERADOS desde el builder fusionado
  (build_contract.py → 82 schemas, datamodel
  0.86.0, openapi-typescript 7.13.0):
  YAML +81/−0, unión verificada (T20 +
  max_cost_net T21). Docs: ambas secciones.
- Nota «1 deselected» del helper: aclarada. El
  helper corrió `pytest apps/api/tests -m "not
  live"`: el deseleccionado es
  `tests/live/test_meta_live.py` (marca live,
  opt-in con clave, convención del repo). Los
  gates del lead usan los 4 dirs offline
  (502/502 exit 0); el test live no se ejecuta
  sin credencial. Ningún fallo enmascarado.
- Backend 502/502 exit 0, ruff check (raíz) +
  format (103) + mypy (53) verdes. Front:
  vitest 216, eslint, tsc, build verdes.
- E2E completa 72/72 (71 + t20-radar).

## PKG-T19 — puertas, ensayos limpios y tabla final (Windows, lead)

Fecha: 2026-10-28. Commit: a8fef2c. Entorno:
Windows, Python 3.14 (venv), Node 26, Chromium.
Sin red salvo loopback; `.env` local existe pero
`capabilities` confirma meta_configured=false.

Puertas completas (`python scripts/verify.py`,
exit 0, ALL CHECKS PASSED): deps-python,
pytest-unit (unit + evaluation), pytest
integration+contracts, npm lint/typecheck/
build/test:unit (vitest 216/216), ruff check
(raíz), mypy (53), playwright-e2e 72/72.
Backend total 502/502. `tests/live` opt-in no
ejecutado (sin credencial, por convención).

Dos ensayos limpios (R1 + R2, storage fresco
vacío cada vez, servidores reales en loopback,
script throwaway en /tmp): 10/10 pasos PASS
en ambos, exit 0: storage vacío, API health
200 (engine 1.0.0 / schema 1.0.0), tenders 0,
seed exit 0, tenders 1 (tias), workspace 200,
demo-sessions 201, capabilities demo/meta
false, web / 200 (1845 bytes). DB sembrada:
20 tablas, alembic 0006_job_generation.
Tropiezos del arnés (no de la app): PID de
npm.cmd no rastreable (se mató por error un
Notepad del autor — declarado) → lanzar vite
con node directo; ruta con espacio sin
comillar → Cannot find module. La app sirve
bien en los tres arranques.

Tabla PASS/FAIL/BLOCKED por aceptación:
- PKG-T01 recibos live: PASS (usage/latencia
  antes de parsear; timeout=incierto).
- PKG-T02 reserva atómica: PASS (micro-USD,
  UPDATE condicional).
- PKG-T03 jobs async: PASS (202 + worker FIFO
  + claim CAS + fence).
- PKG-T04 cobertura páginas: PASS (usable/
  entregado + warnings).
- PKG-T05 render versionado: PASS (PyMuPDF<2,
  hash, nunca rompe upload).
- PKG-T06 payload híbrido: PASS (acotado,
  tope real en budget).
- PKG-T07 observations: PASS (v2 live +
  adapt v1, crudo en manifest).
- PKG-T08 prompts: PASS (extract-3 +
  ejemplo sintético).
- PKG-T09 recorrido UI: PASS (tracker
  rehidratable, motor tras aprobar).
- PKG-T10 gold/harness: PASS (25 gold,
  split dev/eval, CLI 0/2).
- PKG-T11 comparativa: PASS (texto 0/0/11
  medido, híbrido blocked, n=11 + límites).
- PKG-T12 búsqueda: PASS (q servidor +
  URL + paginación).
- PKG-T13 malla: PASS (10×6, 422 con
  campos, banner vigencia).
- PKG-T14 ruta visual: PASS (tokens
  prototipo; 18px diferido D28-3).
- PKG-T15 dato-fuente: PASS (imagen exacta
  + cita vs revisión).
- PKG-T16 usabilidad: BLOCKED externo
  (protocolo listo, 0 sesiones; el autor
  recluta).
- PKG-T17 matriz: PASS (C01–C14 con
  run/test/fuente; smoke separado).
- PKG-T18 vídeo 180s: BLOCKED externo
  (guion v2 verificado; graba el autor).
- PKG-T19 puertas: PASS (este registro).
- PKG-T20 radar: PASS (6 ejes, 2 fuentes
  + pregunta, sintético rotulado).
- PKG-T21 techo coste: PASS (96135.68/
  96135.69, paridad motor, disclaimers).
- FAIL: ninguno. BLOCKED externos: T16
  (participantes), T18 (grabación), G3
  live (credencial), envío (decisión
  autor). P1 diferido; PKG-T28–T30
  descartados. Sin publicación ni envío.

## Docs-A+B — documentación alineada (Windows, helpers + lead)

Fecha: 2026-10-28. Merges: 6de8731 (B) +
6b7a30c (A) sobre 4f1cc61. Docs-B: 8
ficheros técnicos (mapa real de módulos,
19 tablas/0001→0006, suites 503/43 con
desglose, literales de motor); el lead
re-verificó cada afirmación comprobable
(conteos collect-only idénticos, símbolos,
versiones, ausencias pdfplumber/PDF.js).
Docs-A: README + demo/runbook/submission/
launch/social + guion (conteos 502/216/72,
npm 313 auditado, Idempotency opcional en
revisión, badge «Datos de ejemplo»);
capturas 09-radar + 10-techo nuevas,
inspeccionadas por lead y helper.
Gates en main: shots 4/4 + E2E 72/72.
Limpieza: uvicorn huérfano del helper B
(PID 30976, ocupaba el 8000) detenido.

## Visual-port - sistema Oficina en React (Windows, lead)

Fecha: 2026-10-28. Commits: 3cd36a9 (base)
+ 29d1f74 (shell + lamina 01) + 4d328d0
(marco 02-07) + 204f8b0 (precio) + 5262fa6
(paneles + intake). Alcance: tokens/tipo
exactos (root 16px, body 18px/1.55,
D28-3), shell mock (skip/top/disclosure),
biblioteca lamina 01, workhead + steps +
base, precio twocol, h2/surfaces resto.
Verificado vista por vista con captura
propia vs mock (desktop + movil 390).
Gates: E2E 72/72, backend 502+1skip,
vitest 216, lint/build OK, detector diseno
limpio, demo-shots 4/4 regen (docs/demo
01-10). Testids/roles estables; tour y
offline intactos. Desviaciones honestas:
h2 Discount conserva text-lg (R06),
tabs movil en fila scroll (no select),
sin filtros/sort inventados.

## Update-all + UX research (goal-01a18497, 29-oct-2026, Windows)

Commits: da4da97 (deps) + a17bb36 (gitignore) + 19bd55c
(forms) + 30940aa (progreso) + 5f33605 (feedback). Push OK.

Updates: skill Impeccable 4.5.0→4.8.0; npm majors;
TS 5.9.3 (TS7 sin soporte typescript-eslint 8.72.1);
uv lock --upgrade; recharts v3 Tooltip unknown;
mypy 2.x: 49 errores → 0 (tests + re-export
MAX_TREE_DEPTH); ruff check/format verdes.

UX (investigación online: NN/g, Laws of UX, Baymard,
clásicos formularios, material académico/pro; 46
evidencias + crítica + síntesis; backlog 12 ítems):
- Formularios: blur valida si engaged, submit enfoca
  primer error, iconos ⚠︎ + aria-describedby (intake,
  company, hypotheses, review). 2 E2E nuevos.
- Progreso: badges reales Precio (N)/Informe (N),
  requisitos agrupados por criterio (cae Apartado).
- Feedback: tarjeta anomalía warn cuando flagged
  (texto intacto), live-region anuncia, puntos
  aislados con dot (splitFlaggedRuns + 5 vitest),
  aria cuenta zona sospechosa.
- Micro-CSS: selection, scrollbar-gutter,
  touch-action, underline-offset, overscroll,
  thumb slider 28px. Copy intacto (pins E2E).

Gates finales (exit 0 observado):
- pytest apps/api: 502 passed + 1 skipped (live
  opt-in BIDLAB_RUN_LIVE=1). Colectados 503.
- vitest: 221 passed (216 + 5 curveFlags).
- ruff check + format --check + mypy 104: OK.
- tsc --noEmit, eslint, build: OK.
- E2E completa: 74/74 (72 + 2 intake UX).
- demo-shots 4/4; docs/demo 01-10 regen;
  05-requisitos + 02-precio inspeccionadas.
Capturas /tmp: shot-intake-errors, shot-req-groups,
shot-step-badges, shot-anomaly-flag, shot-curve-flag.
Sin Meta en vivo (G3 sigue blocked: sin clave).


## 2026-10-29 · Revisión integrada y entrega ZIP

Entorno Linux, Python 3.12.14, Node 24.22.1. Código revisado 93fb854; base del autor 1a53b6a. Sin push ni inferencias nuevas a Meta.

- `python3 scripts/verify.py --skip-e2e`: exit 0 sobre c9754b4 (todas las puertas no navegador). Web: 236 tests / 31 archivos. Mypy: 55 archivos. Backend, integración, contratos, lint, tipos y build pasan.
- Después de añadir dos códigos al enum canónico y regenerar los clientes (93fb854): contratos + guardas de revisión, typecheck, ruff y mypy repetidos, exit 0 cada uno. No cambia matemática ni payloads válidos.
- `uv run python scripts/demo_story.py --output ...`: dos ejecuciones en bases temporales; cuatro escenarios, cuatro informes y comparación en cada una. Coinciden cifras/estados; snapshots separados.
- `npm run test:e2e -- --list`: exit 0, 77 tests / 25 archivos. No ejecutados: Chromium no pudo descargarse (archivo inválido). Browser QA también sin verificar por fallo de acceso al preview.
- `git apply --check cambios.patch` sobre worktree limpio 1a53b6a: exit 0.
- El primer pase encontró 404 en vez de 405 al montar la interfaz sobre API. Se corrigió la prioridad de rutas, se añadió regresión y el siguiente pase completo quedó verde.

Logs completos y comandos están en `verificacion/` del ZIP BidLab_Codigo_Revisado_2026-10-29. No se atribuye esta ejecución a Windows ni se presenta el control de fixtures como una ablation Meta real.

## 2026-10-29 · Integración issue #1 en Windows (lead)

ZIP BidLab_Codigo_Revisado_2026-10-29 verificado: base
1a53b6afc96cffb5256279669dd30b9cce8e0d87 exacta sobre HEAD
limpio, MANIFEST 412/412 hashes OK. Parche leído entero
(3443 líneas, 54 ficheros). `git apply --check`: exit 0;
aplicado y comparado contra `codigo/`: 54/54 idénticos
(salvo finales de línea). Sin reset ni reimplementación.

Fixes del integrador sobre la entrega (causa raíz
verificada en cada uno, no para tapar tests):
- web.py: `get_path` de starlette devuelve `tenders\tias`
  en Windows y el fallback a index fallaba (2 tests rojos).
  Normalización a ruta URL en `__call__`/`get_response`.
- ARCHITECTURE.md: referencia a backend-review-20261029.md
  inexistente (ni en parche ni en codigo/) → apunta a
  IMPLEMENTACION_20261029.md.
- report-archive.spec.ts: Chromium registra una línea exacta
  para TODO iframe srcdoc+sandbox aunque no haya scripts
  (reproducido con `<p>` mínimo). El sandbox se mantiene
  (el preview rinde HTML con nota de usuario); solo esa
  línea exacta queda exenta en el afterEach, como los
  precedentes 409/422. Test nuevo intacto y en verde.
- demo_story + motores SQLite (triple causa, todas reales):
  (1) env.py de alembic fugaba un engine por migrate()
  (ahora dispose); (2) demo_story dispone el engine antes
  de borrar el tempdir; (3) carrera de hilos: lru_cache
  creaba DOS pools del mismo fichero (worker vs request;
  probado con gc: 2 engines vivos). get_engine es ahora
  registro con lock (misma API cache_clear para tests).

Gates finales Windows (exit 0 observado):
- verify.py --skip-e2e: ALL CHECKS PASSED.
- pytest apps/api: 550 recogidos, 548 passed + 2 skipped
  (live opt-in + symlink sin permiso en esta cuenta).
- vitest 236/31, tsc, eslint, build, ruff, mypy 109: OK.
- E2E completa: 77/77 (74 + demo-presets 2 + preview 1).
- demo_story: 4 escenarios + 4 HTML + comparación;
  cifras/score/anomalía/snapshot 4/4 MATCH contra
  ejecucion-1 Y ejecucion-2 del ZIP. 0 llamadas Meta.
- Visual: Resumen (JourneySteps), Precio (presets +
  OfferComposition), Requisitos, móvil 390 (overflow -15).
- demo-shots 4/4; regen 01/02/06/07/08/10 (01+02
  inspeccionadas). Capturas /tmp: v-summary, v-pricing,
  v-req, v-mobile.
Sin Meta en vivo (G3 sigue blocked: sin clave). Vídeo y
sesiones de usabilidad siguen pendientes del autor.

## 2026-10-29 · Issue #2 P0 (U1/U2/U3/U6) + RC (lead, Windows)

Paquete BIDLAB_AUDITORIA_Y_PROMPT_2026-10-29 leído entero
(LEER_PRIMERO + diagnóstico + prompt 1390 líneas). Sin
MANIFEST (nada que verificar). Fase 0: HEAD bd307c9 limpio;
MODEL_API_KEY/META_API_URL ausentes → G0/M1/T1 BLOCKED
externos (autor). D-ISSUE2-1: orden vigente del autor
(siempre commit y push) prevalece sobre la regla 4 del
prompt (mismo criterio que D28-2).

Commits: 3e2172b (U1 cabecera) + fb0ea17 (U2 hero) +
73340fc (U3 procedencia) + 4b44ec9 (U6 motivos) + RC.

Gates @4b44ec9 (exit 0 observado): verify.py --skip-e2e ALL
CHECKS PASSED; backend 548+2skip (550); vitest 237/31;
tsc/eslint/build OK; ruff + mypy 109 OK; E2E 78/78 (77 +
CMP-03); demo-shots 4/4 (9 PNG regen, 02+07
inspeccionadas); demo_story 8/8 MATCH vs ZIP#1.
Visual /tmp: u1-workhead, u1-details, u1-pricing-fold,
u2-hero, u3-drawer.

Aparcados con motivo en RELEASE_CANDIDATE_20261029.md:
U4/U5/D1 (P1), U7/W1/Pareto (P2/P1), B1 (NO CHANGE),
D2 (requiere live), R1 (autor). Nota §24: el motivo
usa 5916,80 (backend), no 5.916,80; test corregido al
texto real. Sin Meta en vivo (G3 blocked). Vídeo,
sesiones y candidatura: autor.

## 2026-10-29 · Issue #3 V2 (lead, Windows)

Paquete BIDLAB_V2_PROMPT_Y_GUIA_2026-10-29.zip leído entero
(prompt 2183 líneas + guía). Sin MANIFEST (nada que
verificar). Base 616b248 limpia; MODEL_API_KEY/META_API_URL
ausentes → BL-V2-02 live BLOCKED externo. D-V2-8: orden
vigente del autor (siempre commit y push) prevalece sobre
la regla 4 del prompt.

Commits: f0cb455 (01 stale) + eca05ed (04 drawer) +
bf49982 (03 curva) + 030600c (08 pares) + fa315cb (05
Pareto) + 3795240 (06 heatmap) + 2c2cb5c/6776a5f (07
cobertura) + 5b4824b (12 rastro) + 5e698e9 (09 bandeja)
+ c68964b (15 informe) + 8b1bb93 (13/14 visual-a11y) +
522ab32 (10 bench) + 881c19c/cca2f72 (fixes + shots)
+ 264712f (Q02-F frontera 422).

Gates @264712f (exit 0 observado): verify.py ALL CHECKS
PASSED 10/10; backend 557+2skip (559); vitest 252/33;
tsc/eslint/build OK; ruff + mypy 111 OK; E2E 85/85;
demo-shots 4/4; v2-shots 3/3 (8 PNG); demo_story MATCH
(10/15: 49,0 + 5916,80); bench 2/40/100 p.; compare
offline 0/11 baseline + híbrido blocked, 0 llamadas live.
Visual: informe, stress, móvil 390 inspeccionados.

BLOQUEADO: live Meta (sin clave/admisión/saldo).
DESCARTADO con motivo: 2ª pasada P2, multilote P3,
extras §24, export A-B, filtros/criticidad sin contrato.
Vídeo, sesiones y candidatura: autor. Detalle por ID en
docs/CHANGELOG_IMPLEMENTACION_V2.md; informe §22.6 en
el cierre del issue #3.
## V3 issue #4 (29-oct-2026, Windows, lead)

Commits main: 04828fb (P0-01/P0-05) + c361ebe (P0-02/P0-03) +
956dcbe (P0-04) + def2793 (P1-01) + ad69683 (P1-03) +
66adb86 (P1-02) + 6d6028e (P1-05) + 0ec778d (P1-01 frontera) +
c179813 (P1-04) + f780bb7 (P1-06 docs: guion v5, CHANGELOG_V3, cifras).

Gates @c179813 (exit 0 observado): verify.py ALL CHECKS
PASSED 10/10 (deps, pytest unit, pytest integ+contratos,
eslint, tsc, build, vitest, ruff, mypy, e2e); backend
565 passed + 1 skipped (symlink, preexistente) + 1
deselected (live opt-in); vitest 259/33; E2E 98/98 en DOS
pasadas (85 base + 13 V3: stress dup/minimapa, curva 7,
trail 4); axe serious+ 0 (5 pestanas x 1440/390, qa-visual
6/6); shots.spec 4/4 (01-10 regen) + v3-shots 5/5 (matriz
40 PNG); primera pasada verify exit 1 con cola truncada
por pipe (detalle perdido), rerun + E2E independiente
verdes: inestabilidad no reproducida, se registra.
Contrato regen exact-repro: builder sin diff en base;
hypothesis_index +5/-0 YAML, +1 TS, +1 py (mas timestamp),
ejemplo frontera 2 lineas; sin cambio de schema la 2a vez.

Visual: s1/s2/s3/s4-320/s5/s6-320/s7 inspeccionados a ojo
(sin colisiones; s5 revelo motivo frontera inexacto ->
0ec778d; 320/extremos/zoom-equivalente fijados por E2E).
docs/v2-shots restaurado intacto tras regen accidental.

BLOQUEADO: live Meta (sin clave/admision/saldo, 0 llamadas);
video 180 s + clip hero (autor); Lighthouse sin medir (no se
publica numero). Detalle por ID en
docs/CHANGELOG_IMPLEMENTACION_V3.md; decisiones en
docs/DECISION_LOG_V3.md; informe de cierre en el issue #4.
## V5 issue #5 (29-oct-2026, Windows, lead)

Pack: BIDLAB_IMPLEMENTACION_TOTAL_META_2026.zip, SHA-256
4469799A057AC5134D251BEADAEF293B5C495EDED685FE0CAF96D2130A6400BC.
Manifiesto 27/27 integro (hash + bytes); self-check del pack
16 passed PACK_ONLY_PASS reproducido antes de editar; plan
1080 lineas + 8 parches leidos enteros; applier dry-run 14/14
anchors exactos y --apply sobre arbol limpio @28f2f54.

Commits main: 5a30563 (PR-1 META-01) + 92d1374 (PR-2 copy) +
1f0a922 (PR-3 docs) + d40112d (PR-4 eval) + 5a5ee35 (PR-6).

Gates @5a5ee35 (exit 0 observado): verify.py ALL CHECKS
PASSED 10/10 (deps, pytest unit+eval, pytest integ+contratos,
eslint, tsc, build, vitest, ruff, mypy, e2e); backend 588
passed + 1 skipped (symlink, preexistente, Windows) sobre
589 recolectados (unit+eval 423+1s, integ+contr 165+0);
vitest 260/33; E2E 98/98 incl. qa-visual 6/6 (axe serious+ 0);
ruff check + format limpios (E501 en test añadido por PR-2,
corregido partiendo la anotacion, 4 +++-); mypy exit 0.
Self-check del pack re-verde tras aplicar (16 PASS).

Corpus PR-4: 12/12 PDFs + gold committeados, autoverificado
en generacion + spot-check 11/11 texto + S06 raster 0 chars;
scorer 4/4; template 12/12 blocked (fuera de git).
Preflight PR-1: esquema real 23 props, depth 3 (limites
5000/10/120000/5000/10), dentro de build_hybrid_request.
Jury shots: 6 PNG frescas con SHA en FINAL_HEAD_VALIDATION
(2 UI Playwright 1280x720 + 4 corpus PyMuPDF 150dpi).

BLOQUEADO: live Meta 0/12 (sin META_API_KEY/MODEL_API_KEY,
sin META_CONFIRM_LIVE, sin presupuesto; presencia 29-oct,
valores jamas impresos); refusal sin clave cubierto por
test_execute_live_without_key_fails_attempt (verde).
Re-verificacion S1.2 (29-oct): developers.facebook.com y
developers.meta.com NO responden desde este entorno
(HEAD->404, GET->conexion cortada; github.com si funciona):
reglas = plan citado + preflight propio; nada afirmado como
re-leido. Video 180 s + candidatura: autor. Detalle por PR
en docs/CHANGELOG_IMPLEMENTACION_V5.md; informe S22.6 en
el cierre del issue #5.
Adenda auditoria SS0-19 (29-oct, lead, sobre 5a5ee35): Lote-0 S9.3
ejecutado: page_selection <=6 por caso cubre todo el gold (S07 6/8
con p8; S06 0 chars texto, conservada para render); semantica gold
leida (lotes scope A/B, prórrogas nunca 36 inicial, S11 neto solo,
S03 dos candidatos + conflicto, S12 sin formula inventada).
Self-check del pack re-verde tras aplicar: 16 passed PACK_ONLY_PASS
(stderr solo FutureWarning fitz). Enlaces relativos: 0 rotos en
README.md, README_EN.md, REVIEWER_GUIDE.md, submission-draft.md.
Check S11.2: sin textos viejos (No live Meta/E2E 85) salvo citas
historicas etiquetadas; consentimiento: texto exacto nuevo, logica
useLive intacta, checkbox nativo en <label> (teclado por
construccion; sin E2E dedicado: tampoco existia para el texto
viejo). Frases literales S11.1/S11.2 anadidas (rama sin-live) +
cifras V5 en README/EN/guia/audit/demo. OPT-01 DESCARTADO con
motivo; S14 sin cambios invasivos (0.0.0.0 ausente, loopback ok).
Clon limpio @5a5ee35: uv sync/npm ci/chromium exit 0 + verify.py
ALL CHECKS PASSED 10/10 (vitest 260/33, E2E 98/98), exit 0.
## V6 issue #6 baseline (29-oct-2026, Windows, lead)

HEAD: 132cfb22a22f3b84de63dea2fc3cd15e7a515a0f (main, limpio).
El issue suponia 5a5ee35; el HEAD real va un commit por delante
(132cfb2: SHAs freeze + adenda auditoria V5, solo docs).
Issue #6: BIDLAB_ISSUE_CIERRE_FINAL_META_2026.md (343 lineas,
SS0-12 + referencias), leido entero antes de actuar.

Baseline (instalacion limpia sobre HEAD, sin editar):
uv sync --frozen --all-packages exit 0; npm ci exit 0;
npx playwright install chromium exit 0;
python scripts/verify.py exit 0 ALL CHECKS PASSED 10/10
(backend 588 passed + 1 skipped symlink; vitest 260/33;
E2E 98/98; ruff/mypy/eslint/tsc/build exit 0);
uv run python scripts/demo_story.py --output
test-results/final-demo-story exit 0 (4 escenarios + 4
informes + comparacion + RESUMEN.json).
Entorno: Python 3.14.7, uv 0.12.5, Node v26.3.0, npm 12.0.2,
Playwright 1.64.1 (Chromium).

Lecturas S1 completas: AGENTS.md, ARCHITECTURE (CURRENT
IMPLEMENTATION), RULE_ENGINE.md, DECISION_LOG_V3.md,
META_EVIDENCE_V3.md, README.md, README_EN.md,
demo-script-180s.md, submission-draft.md.
Guard reset verificado en codigo: seed_demo.py rechaza
--reset fuera de BIDLAB_MODE=demo (exit 2); demo_story.py
usa TemporaryDirectory (no toca storage real).
## V6 issue #6 offline final (30-oct-2026, Windows, lead)

HEAD offline: ffa7c78 (main, limpio). Olas: 5c69fec (docs+higiene),
c869705 (FIX UX F1-F9 red->green), b28558a (F10+shots), 53c1d75
(SHAs u1/u2) + ffa7c78 (este log + freeze).
Issue #6: BIDLAB_ISSUE_CIERRE_FINAL_META_2026.md (343 lineas),
leido entero; S1-S7 ejecutados, S8 pendiente del autor.

Gates @53c1d75 (exit 0 observado): verify.py ALL CHECKS PASSED
10/10 (backend 593 passed + 1 skipped symlink; vitest 262/33;
E2E 99/99; ruff/mypy/eslint/tsc/build exit 0); demo_story.py
exit 0 (oraculos 10/15 exactos, 0 llamadas Meta).
Deltas vs V5: +5 backend (3 etiquetas ambito F5 + 2 plantilla
F2), +2 vitest (F1 leyenda, F3 warnings), +1 E2E (F10 badge).
Logs clave en test-results/final/ (gitignored, local).

Auditorias: backend SS2.2-2.3 sin FAIL (helper, 325 tests
dirigidos + matriz C:/tmp/v6-be/matriz.md, revisada por lead);
UX SS2.1/2.4/3 (helper, 67 PNG a 5 viewports + teclado/zoom,
C:/tmp/v6-fe/INFORME.md): 9 FIX aceptados + 1 bug P1 propio
del lead (F10 badge) + 6 DEFER aceptados. Correccion: el helper
invento un warning ("eligible cell count...") y erro un sufijo;
test F3 corregido a los strings reales del backend antes de
implementar. Traza "plantilla/politica" se conserva (log de
auditoria fijado por test_evaluate + E2E); "Instantanea
(snapshot)" idem (test). Precision informe: puntos/margen a
1 decimal con aviso, importes exactos.

Shots: matriz v3 5/5 re-verde (23 PNG, s5 ya con Pareto
nuevo, s4 con "Max." real); jury u1/u2 re-capturados con
scripts/demo-shots/jury-shots.spec.ts (u2 V5 mostraba el
formulario, no resultados; corregido + SHAs en
FINAL_HEAD_VALIDATION). Revision propia del lead: u1/u2,
s4/s5/s6, propia+Resumen/cabecera/empresa/archivo/export.
DEFER UX (nits, no bloquean): D1-D6 en informe helper.

S7 reglas (30-oct, web_fetch): plazo oficial 4-nov 21:00 ET
(= 5-nov 03:00 CET, EST=UTC-5) confirmado en
dev.meta.ai/events/global-hackathon; structured-output
re-verificado (confirma preflight V5); precios Spark Standard
1.25/0.15/4.25 USD por M (confirman estimador); Official Rules
privadas (las aceptadas por el titular mandan; video/limite
no confirmados en publico).
