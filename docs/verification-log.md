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
