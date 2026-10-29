# Arquitectura implementable
Estado: diseño cerrado para P0 (implementado 2026-10-28, HEAD 4f1cc61; ver «Mapa real implementado»).

## CURRENT IMPLEMENTATION (authoritative, 29-oct-2026)

This section wins over the historical ADR table below. Frontend: React 19 +
TypeScript strict + Vite + Tailwind v4 (CSS-first, no config file) +
react-router + TanStack Query + sonner + zod; charts are hand-rolled SVG
(`recharts` sits unused in devDependencies). No Radix/shadcn. PDF: text via
pypdf (`EXTRACTOR_VERSION="bidlab-pdf-1"`), page renders via PyMuPDF
(`bidlab-render-1`) served as backend PNGs; no pdfplumber, no PDF.js in
`apps/web`. Backend: FastAPI + Pydantic v2 + SQLAlchemy 2 + SQLite WAL,
single Uvicorn on loopback; build served same-origin at 127.0.0.1:8000.
Meta: Chat Completions adapter, opt-in, currently blocked (no credential).

## ADR y stack (historical; see CURRENT IMPLEMENTATION above)
| ADR | Decisión | Motivo y límite |
|---|---|---|
| A01 | Monorepo Python + TypeScript | Equipo de una persona, dominio numérico Python y UI rica. Contrato REST versionado. |
| A02 | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, SQLite | Un proceso, WAL, foreign_keys=ON, busy_timeout=5000. Sin Redis/Celery/Postgres. Revisiones append-only. |
| A03 | Node 22.12+; React, TypeScript strict, Vite, Tailwind, componentes Radix/shadcn, Recharts | D: usar versiones estables compatibles que el agente resuelva y fije el primer día; no “latest” durante CI. Vite documenta Node 20.19+/22.12+. Un package-lock.json y uv.lock reproducibles. |
| A04 | pypdf + pdfplumber para extracción local; PDF.js para visor | No hacer depender producto de PyMuPDF utilizado en la investigación sin revisar su licencia AGPL/comercial. pypdf no es OCR ni renderizador. [Ver nota A04-2026-10-28 bajo la tabla.] | —texto con pypdf (`services/pdf.py`, `EXTRACTOR_VERSION="bidlab-pdf-1"`), render con PyMuPDF (`services/render.py`, `bidlab-render-1`) y visor con PNG del backend (usado por `EvidenceDrawer.tsx`); sin pdfplumber en dependencias y sin PDF.js en `apps/web` (cero menciones). La cautela de licencia sobre PyMuPDF del diseño previo queda como decisión pendiente de registrar antes de publicar. pypdf sigue sin ser OCR ni renderizador.
| A05 | Plantillas y AST JSON restringido; Decimal | Fórmulas aisladas de red/IA. P0 una plantilla aprobada; gramática acotada extensible. |
| A06 | Meta Spark 1.3 estándar, Chat Completions con texto paginado y JSON schema | Una sola familia de endpoint para extracción P0. PDF/vision opcional y segmentada si hace falta, no requisito de demo. Sin embeddings ni vector DB. |
| A07 | Import offline + fixture curado real | Sin crawler nacional ni fetch de URLs arbitrarias desde la UI. P1 procesa ZIP local. |
| A08 | Servir build web desde FastAPI en 127.0.0.1:8000 | Un origen en demo. Vite 5173 y proxy /api solo en desarrollo. No exposición a LAN ni cloud sin revisión de autenticación. |
| A09 | Jobs persistidos, un worker en el proceso | Extracción puede durar minutos. Recuperación explícita; no hacer pasar una función BackgroundTasks sin persistencia por cola durable. |
| A10 | Sin modelo predictivo | Datos disponibles no identifican la distribución competitiva. Estadística descriptiva independiente del simulador. |

> Nota A04-2026-10-28: implementado con otra pila —texto con pypdf (`services/pdf.py`, `EXTRACTOR_VERSION="bidlab-pdf-1"`), render con PyMuPDF (`services/render.py`, `bidlab-render-1`) y visor con PNG del backend (usado por `EvidenceDrawer.tsx`); sin pdfplumber en dependencias y sin PDF.js en `apps/web` (cero menciones). La cautela de licencia sobre PyMuPDF del diseño previo queda como decisión pendiente de registrar antes de publicar. pypdf sigue sin ser OCR ni renderizador.

Tecnologías son elecciones, no afirmaciones de “más reciente”. El agente registra versiones resueltas en docs/environment.md, verifica licencias directas/transitivas y actualiza solo por incompatibilidad o vulnerabilidad relevante. Referencias primarias: [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy](https://docs.sqlalchemy.org/en/20/), [Vite](https://vite.dev/guide/), [pypdf](https://pypdf.readthedocs.io/), [Playwright](https://playwright.dev/docs/intro), [PDF.js](https://mozilla.github.io/pdf.js/).

## Componentes y límites
~~~mermaid
flowchart TD
  UI["React: workspace y Pricing Lab"] --> API["FastAPI: contratos y revisión"]
  API --> DOMAIN["Dominio: Decimal, reglas y escenarios"]
  API --> JOBS["Jobs: páginas, extracción y citas"]
  JOBS --> META["Meta Model API"]
  API --> DB["SQLite: revisiones y snapshots"]
  JOBS --> BLOBS["Archivos locales por hash"]
  ETL["Importación oficial offline"] --> DB
  DOMAIN --> REPORT["Informe reproducible"]
~~~

Frontend → API → servicios de aplicación → dominio puro.
Servicios coordinan repositorios SQLite, almacenamiento local y adaptador Meta. Dominio no importa FastAPI, SQLAlchemy, HTTP ni SDK Meta. Importación es CLI y usa los mismos normalizadores y repositorios.

Frontend conserva solo estado de UI y filtros. React Query para datos/polling y React Hook Form con Zod para formularios; tipos generados del OpenAPI con openapi-typescript. No implementar la fórmula dos veces en JS y Python. Recharts transforma decimales a number únicamente para dibujar; cifras y CSV provienen del backend como strings.

Flujo principal:
1. Cargar ejemplo → transacción seed idempotente que copia datos curados a DB/sesión.
2. Seleccionar scope y perfil → GET workspace proporciona reglas vigentes, revisión y evidencias.
3. POST /scenarios/evaluate resuelve scope, regla y revisión empresa; valida precondiciones; motor devuelve KPIs, traza y curva.
4. Guardar → POST /scenarios reevalúa el mismo input en backend y almacena input+resultado+hashes inmutables.
5. Crear informe → POST /reports con scenario_id y decisión manual; devuelve reporte inmutable y URL local de HTML.
6. Ver informe → renderer Jinja con autoescape desde snapshot; no otra llamada LLM.

## Árbol de producto que deberá crear el agente
~~~text
AGENTS.md
README.md
.env.example
.gitignore
pyproject.toml
uv.lock
package.json
package-lock.json
scripts/
  dev.py
  demo.py
  verify.py
  seed_demo.py
  inspect_meta.py
apps/
  api/
    pyproject.toml
    alembic.ini
    migrations/
    bidlab/
      main.py
      settings.py
      api/{health,capabilities,tenders,documents,analysis,companies,scenarios,reports}.py
      schemas/{common,tender,extraction,company,scenario,report}.py
      domain/{money,eligibility,expressions,scoring,anomaly,statistics}.py
      services/{workspace,document_pipeline,citations,extraction,review,evaluation,reports}.py
      adapters/{meta_model,fixture_provider,pdf_text,filesystem}.py
      db/{session,models,repositories}.py
      jobs/{worker,queue}.py
      ingestion/{placsp,normalize,quality}.py
      prompts/{extract_v1,repair_v1}.txt
      templates/decision_report.html
    tests/
      unit/
      integration/
      contracts/
      live/
  web/
    package.json
    vite.config.ts
    tsconfig.json
    src/
      api/{client,generated}.ts
      app/{router,providers}.tsx
      features/
        library/
        workspace/
        requirements/
        pricing/
        evidence/
        reports/
      components/{ui,StatusBadge,Money,EmptyState,ErrorState}.tsx
      lib/{format,requestSequence}.ts
      styles.css
    public/pdfjs/ 
    tests/
tests/e2e/
fixtures/
  demo/{manifest,tender,company,interpretation,review,expected}.json
  synthetic/{malicious_xml,zero_price,ocr_required,...}
docs/
  [los diez documentos normativos más MUSE_GOAL]
  verification-log.md
  environment.md
  task-board.md
  blockers.md
  publication-manifest.json
storage/                    [gitignored]
  bidlab.sqlite3
  blobs/<sha256>
  raw/<sha256>
  exports/
evidence/                   [investigación; no publicar en bloque]
schemas/
examples/
tools/                      [sondas de este paquete]
.github/workflows/ci.yml
~~~
Las llaves indican varios archivos a crear, no nombres literales con comas. El árbol no es una lista de implementaciones ya existentes.

## Mapa real implementado (2026-10-28, HEAD 4f1cc61)

Verificado listando `apps/api/bidlab/`, `apps/web/src/`, `scripts/` y `fixtures/`. Difiere del árbol de diseño previo en estos nombres:

- `api/`: capabilities, companies, deps, documents, errors, health, jobs, reports, review, scenarios, stress, tenders (registrados en `main.py` con prefijo `/api/v1`). No existe `api/analysis.py`: el análisis vive en `POST /tenders/{id}/analysis` (202 + `Location`, en `api/jobs.py`) más `services/jobs.py`.
- `schemas/`: common, generated (OpenAPI), observations (observaciones v2, PKG-T07). Sin `schemas/{tender,extraction,company,scenario,report}.py` separados.
- `domain/`: money, eligibility, expressions, groups, scoring, anomaly. Sin `statistics.py` (histórico descriptivo es P1, no implementado).
- `services/`: budget, companies, compare, consistency, demo, eligibility, evaluation, extraction_compare, extraction_eval, idempotency, intake, jobs, meta_adapter, pdf, render, reports, review, scenarios, seed, stress, worker, workspace, más `templates/report.html.jinja`. Sin paquetes `adapters/`, `jobs/`, `ingestion/` ni `prompts/`, y sin `db/repositories.py` ni `services/{document_pipeline,citations,extraction}.py`: el adaptador Meta y el stub viven en `services/meta_adapter.py`, el worker en `services/worker.py`, y no hay ETL de producto (solo la sonda de investigación `tools/probe_placsp.py`).
- `db/`: session, models (20 clases; ver DATA_MODELS). Migraciones `0001`–`0006` en `apps/api/migrations/versions/`.
- Web real: `features/` contiene company, evidence, intake, library, pricing, report, requirements, review y workspace (sobre las seis previstas existen además company, intake y review). Sin `public/pdfjs/`: el visor usa texto e imagen PNG servidos por el backend.
- Scripts reales: `scripts/dev.py`, `demo.py --reset-demo`, `verify.py [--skip-e2e]`, `seed_demo.py`, `inspect_meta.py`, más `compare_extraction.py` y `score_extraction.py` (harness de evaluación offline, PKG-T10/T11).
- `fixtures/demo/` contiene manifest, tender, company, interpretation, review y expected `.json` (coincide con el diseño); no existe `fixtures/synthetic/`.

Flujo implementado (rutas con prefijo `/api/v1`): coincide con el §Flujo principal salvo prefijo, más `POST /scopes/{id}/stress-tests` (malla de estrés persistida), `POST /scenarios/compare`, `GET /documents/{id}/pages/{n}/image` (render versionado `bidlab-render-1`, DPI 72–300, defecto 150) y `GET /jobs/{id}` (poll de análisis). `Workspace` incluye `consistency` (radar de incoherencias, PKG-T20).

## Contratos internos exactos
~~~python
# Especificación de firmas, no implementación
extract_pages(pdf_path: Path) -> list[PageText]
verify_citation(citation: CitationProposal, page: PageText) -> CitationCheck
extract_document(pages: list[PageText], context: ExtractionContext) -> ExtractionProposal
compile_rule(revision: PricingRuleRevision) -> CompiledRule
evaluate_price(ctx: EvaluationContext, request: EvaluationRequest) -> EvaluationResult
evaluate_anomaly(policy: AnomalyPolicy, offers: list[Offer], basis: PriceBasis) -> AnomalyResult
evaluate_requirement(tree: RequirementNode, evidence: list[CompanyEvidence]) -> EligibilityResult
build_report(snapshot: ScenarioSnapshot, decision: ReportDecision) -> ReportSnapshot
~~~
EvaluationContext contiene scope aprobado, regla/revisión, empresa/revisión y hashes. Nunca construirlo desde una fórmula que envía el navegador. La evaluación de fórmulas nuevas exige endpoint de revisión previo y schema/whitelist.

## Extracción y revisión documental
1. Upload streaming a archivo temporal privado; verificar firma %PDF-, MIME permitido y lector real; 20 MiB, 120 páginas, sin cifrado, sin portfolio/adjuntos ejecutables. UUID interno, nombre de usuario solo para display escapado. Hash antes de procesar. Duplicado por hash/tender devuelve referencia existente.
2. Parser en subprocess con timeout 30 s y límites disponibles del SO. Linux: CPU/memoria/proceso; Windows: timeout y límites de tamaño, documentar diferencia y usar Job Object si se incorpora. No afirmar aislamiento fuerte de PDF si solo hay timeout.
3. pypdf extract_text por página física; pdfplumber como segunda lectura para tabla/fórmula si el texto falla. Guardar extractores/versión y texto original; normalización separada. Página con <80 caracteres útiles => low_text/needs_review, no requisito ausente.

> Nota 2026-10-28: solo pypdf implementado (`services/pdf.py`); sin segunda lectura pdfplumber. Normalización implementada: `nfkc-noshyphen-collapse-1`.
4. Indexar todas las páginas hasta límite, sin recortar silenciosamente las finales. En P0 la extracción live hace una petición de hasta 6 páginas: `page_selection.py` prioriza señales de fórmula/puntos, anormalidad, presupuesto/plazo y solvencia, con al menos una página por documento cuando cabe. Conserva IDs/hashes y registra `page_selection` y cobertura de TODAS las páginas físicas: las no enviadas siguen pendientes. Esto no es una pasada de lectura completa ni OCR general. La lectura adaptativa o múltiples paquetes requieren presupuesto por intento y evaluación aparte.
5. Llamadas Meta sin herramientas, con developer prompt que trata documentos como datos no confiables, instrucciones de no inferir y esquema fijo. Tareas: datos económicos/criterios, requisitos/obligaciones, fechas. Deduplicar hallazgos por clave y evidencia, sin usar un segundo LLM como árbitro exclusivo.
6. Cada propuesta incluye valor bruto, valor normalizado nullable, unidad, notas, citas y ambigüedad. El LLM no fija reviewed=true ni compila código.
7. Validar JSON local con Pydantic. Refusal, finish_reason length, cadena vacía o esquema inválido => job fallido/needs_review, no partial como completo. Una reparación estructural como máximo; no llenar campos inexistentes para pasar el esquema.
8. Comprobar cita contra página exacta: NFKC, soft-hyphen eliminado y espacios colapsados; preservar puntuación y cifras. Resultado exact/normalized_match/missing. Guardar offsets sobre texto normalizado y versión de normalización, no asumir que UTF-16 del browser coincide con índices Python.
9. Dato “cita localizada” sigue propuesto. Finanzas/scope, fórmula y política de anormalidad requieren aprobación semántica humana registrada. Choque XML/PDF crea issue; no elegir automáticamente el de mayor “confidence”.
10. Revisión crea nueva revision, expected_revision obligatorio; estado anterior permanece en historial. Documento cambiado invalida aprobaciones y escenarios nuevos hasta revalidar. Los escenarios guardados conservan su snapshot anterior.

PDF nativo Meta: doc M04 admite input_file/Chat file, pero tiene límites de primeras 100 páginas texto y 50 imágenes. Si se activa P1, dividir PDF con pypdf en ≤40 páginas y guardar mapping a páginas del original; costo medido real y eliminar archivo remoto si se usa Files. P0 envía texto segmentado y no crea almacenamiento remoto Files. El modelo no accede a documentos privados por URL pública.

## Meta adapter
Base fija https://api.meta.ai/v1; modelo por META_MODEL=muse-spark-1.3; clave solo MODEL_API_KEY. Rechazar contributor por defecto; opción deliberada solo con datos de prueba públicos y aceptación explícita de sus condiciones. La variable META_API_KEY pertenece al CLI y la app no la usa como fallback silencioso.

Fragmento documental mínimo:
~~~python
client = OpenAI(
    base_url="https://api.meta.ai/v1",
    api_key=os.environ["MODEL_API_KEY"],
    timeout=90.0,
    max_retries=0,
)
response = client.chat.completions.create(
    model=settings.meta_model,
    messages=[
        {"role": "developer", "content": prompt},
        {"role": "user", "content": page_marked_text},
    ],
    max_completion_tokens=6000,
    response_format={
        "type": "json_schema",
        "json_schema": {"name": "bidlab_extraction", "schema": extraction_schema},
    },
)
# validar contenido y finish_reason antes de persistir cualquier propuesta
~~~
El adaptador limita la salida con max_completion_tokens=6000, documentado para Chat Completions (https://dev.meta.ai/docs/protocols/chat-completions). max_output_tokens pertenece a Responses y no se envía a Chat. Se comprueba el SDK con smoke antes de integración. No configurar temperature=0 para “garantizar verdad”; dejar default y exigir evidencias/validación. Cache por hashes de documento/páginas + prompt + schema + modelo + opciones + extractor. No cachear como éxito errores ni respuestas truncadas. No prometer reproducibilidad byte a byte de inferencia live.

Política vigente 29-oct: un solo intento de transporte, sin reintentos automáticos (también ante 429/timeout). La reserva y el marcador de posible envío se confirman ANTES de entrar al adaptador. Si el transporte confirma rechazo antes de enviar se libera; si puede haberse enviado y falta uso, permanece uncertain y bloquea nuevas reservas hasta conciliación. Solo uso reportado liquida el coste: una estimación nunca se presenta como factura real. El estimador chars/4 no acota todos los tokens de entrada ni imágenes; el ledger limita admisiones con esa estimación, no garantiza un techo duro del proveedor. Concurrencia de inferencia 1. Tokens/latencia/estado sin texto completo ni razonamiento privado en logs. Ver IMPLEMENTACION_20261029.md (Backend corregido).

Implementación (`services/meta_adapter.py`, `services/budget.py`, `settings.py`): el endpoint live exige `META_API_URL` con la URL completa en el entorno del proceso además de `MODEL_API_KEY` y `BIDLAB_MODE=live` (`settings.live_ready`); la URL oficial es `https://api.meta.ai/v1/chat/completions`. El contrato de respuesta es observaciones v2 (`schemas/observations.py`, `SCHEMA_VERSION="2.0-proposal"`) adaptadas a la propuesta v1; el techo de gasto es `BIDLAB_META_BUDGET_USD` con ledger atómico en micro-USD.

## Jobs, errores y persistencia
Job: queued → running → succeeded | needs_review | failed | cancelled. Un worker consume SQLite con lease; al arrancar marca jobs running sin worker como failed:interrupted. No hace llamadas remotas repetidas tras un reinicio sin acción explícita. El usuario puede reintentar como job nuevo; Idempotency-Key evita duplicación por doble clic.

Implementación (`services/jobs.py` + `services/worker.py`): un hilo demonio con cola FIFO (`WORKER_ID="worker-1"`), claim compare-and-swap con columna `generation` (migración 0006), lease de 10 min (`LEASE_MINUTES=10`); al arrancar reencola únicamente jobs queued. Los running heredados se marcan failed/interrupted y sus reservas potenciales se retienen; failed no es una cola de reintento. Recibos y gasto se guardan aunque una generación, revisión o versión documental posterior impida promover la propuesta.

POST analysis devuelve 202 + Location /jobs/:id. Poll 1 s al principio y 3 s después; timeout UI no cancela la ejecución a escondidas. Job tiene progreso por páginas/lotes, no porcentaje de “certeza”. La DB nunca permanece bloqueada durante HTTP ni parsing. (El «límite 1 running y 5 queued» del diseño previo no existe en código: un solo worker reclama jobs sin cupo de admisión; el único 429 implementado es `budget_exhausted`.)

Errores JSON comunes: code, message, request_id, details (sin traceback). HTTP 409 stale_revision o rule_unapproved; 422 domain_validation; 413 upload_too_large; 415 unsupported_media; 503 provider_not_configured; 502 provider_failure. Unknown matemático es 200 con status unknown y motivos, no cero ni NaN. Fallo de infraestructura no se disfraza como unknown jurídico.

Escenario: snapshot inmutable de inputs/rules/company/source hashes, engine_version y resultado. El hash del snapshot sirve para integridad/reproducción, no es firma jurídica. Informe basado solo en un escenario persistido.

## Seguridad y privacidad P0
- Bind loopback, allowed Host localhost/127.0.0.1; mismo origen en producción; dev allowlist exacta 5173. Para mutations exigir X-BidLab-Client: local-ui y validar Origin; CORS sin wildcard ni credenciales universales. Esto no es autenticación multiusuario: prohibido desplegar públicamente sin agregar auth/aislamiento.
- No endpoint fetch(URL). Descargas administrativas mediante CLI con allowlist, HTTPS, redirects comprobados y límites; bloquear IP privadas/metadata en cada resolución si se amplía a URLs.
- Uploads fuera de webroot, permisos OS privados, sin rutas del cliente, symlink/path traversal rechazado. Nunca ejecutar enlaces/JavaScript/adjuntos del PDF.
- PDF.js local con scripting/XFA/eval desactivados donde la API lo admita; CSP propia, sin scripts de CDN. No permitir dangerouslySetInnerHTML sobre texto de documentos. HTML de informe Jinja autoescape y CSP sin ejecución.
- No secretos en frontend, fixture, querystrings, log, screenshots o informe. .env gitignored. Logs redactan Authorization. Secret scanner en CI y revisión de diff antes de hacer público.
- El prompt no tiene tools ni credenciales, solo páginas seleccionadas. “Ignora tus instrucciones” dentro de un PDF es texto; prueba adversarial obligatoria.
- Perfil/costes locales por defecto; confirmación de procesamiento remoto por conjunto de documentos, no enviar costes ni certificados de empresa para extraer PCAP. Modo estándar de Meta no equivale a residencia UE ni a ausencia de tratamiento.
- Política de borrado: eliminar perfil/documento debe alcanzar blobs no referenciados y derivados; informes con snapshots requieren borrado explícito. El contrato P0 no incluye una UI o API de borrado granular; README debe explicar cómo eliminar todos los datos locales y esta capacidad se añade antes de cualquier uso cloud/multiusuario. Para demo usar solo datos públicos y perfil sintético.
- storage está en disco local, sin cifrado de app P0: proteger cuenta/disco del SO. No afirmar “cifrado en reposo empresarial”. Antes de cloud revisar RGPD, encargados, transferencias, retención y autenticación.

## Observabilidad
request_id en respuesta y logs JSON; job_id, stage, elapsed_ms, status, tokens y gasto estimado. GET health no comprueba saldo Meta ni realiza llamadas facturables. GET capabilities informa configured/demo/model/limitaciones, no api_key. Tabla ModelInvocation distingue live/fixture/manual y conserva proveedor request_id si se devuelve; fixture/manual no tiene tokens ficticios.

Guardar command, timestamp, exit code, commit/hashes y ruta de evidencia de cada check en verification-log.md. Revisiones y cambios de coste en audit_event con actor local explícito y motivo. Sin analytics remoto.

## Arranque y Windows
Scripts Python multiplataforma implementados: `python scripts/dev.py`, `python scripts/demo.py --reset-demo`, `python scripts/verify.py [--skip-e2e]` (orquesta: deps-python `uv sync --frozen --all-packages`, pytest unit+evaluation, pytest integration+contracts, npm lint/typecheck/build/test:unit, ruff, mypy y playwright-e2e salvo `--skip-e2e`). No depender de make, bash o Docker. `uv sync --frozen --all-packages` y `npm ci`; servir el build web desde FastAPI sigue pendiente (`main.py` conserva `TODO(T19)`). Reseteo afecta exclusivamente DB de demo identificada, no storage privado.

Documentar dos terminales si dev.py falla y registrar prueba real en Windows; ejecutar en Linux no cuenta como Windows PASS. La demo offline exige dependencias ya instaladas y assets/browser disponibles: “sin Internet durante ejecución” no significa instalación nueva sin descargas.

Cloud es una extensión futura: no crear DB gestionada ni hosting para hackathon hasta tener P0 estable y autorización del autor.


Referencia de licencia consultada: https://pymupdf.readthedocs.io/en/latest/about.html, sección License and Copyright. La librería se usó para investigación/inspección; el producto elige pypdf/pdfplumber para evitar incorporar esa dependencia sin decidir su licencia.

Contrato de configuración inicial: usar los nombres de .env.example; BIDLAB_MODE=demo|live|manual, BIDLAB_BIND_HOST=127.0.0.1, BIDLAB_PORT=8000, BIDLAB_STORAGE_DIR, BIDLAB_HISTORY_ENABLED y BIDLAB_META_BUDGET_USD. La clave vacía no habilita live. No inferir modo live por encontrar una clave si BIDLAB_MODE sigue demo.

El progreso de jobs cuenta páginas únicas por etapa, con processed_pages≤total_pages; cambiar de etapa reinicia ese contador. No sumar varias pasadas como si fueran páginas distintas.
