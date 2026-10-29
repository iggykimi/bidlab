# BidLab — licitación real, revisión trazable, Pricing Lab determinista

BidLab ayuda a una pyme a decidir si pujar: biblioteca de licitaciones,
matriz de requisitos con citas localizadas en página, y Pricing Lab con
puntos, anomalía y curva calculados por un motor determinista en Python.
El LLM propone estructura y citas; la aritmética, la elegibilidad y la
anormalidad viven en dominio puro. Dinero y puntos en `Decimal`, API con
strings, sin fórmulas autoritativas en el frontend.
(Sin CI remota ni badge: por decisión del autor, las puertas son locales
vía `scripts/verify.py`.)

Caso P0: **2026/00006554N** (asistencia técnica del PAI de Tías),
PBL neto 118.336 EUR, 49 puntos de precio, regla proporcional inversa
(PCAP p.10) y anormalidad (PCAP p.20). Estado: P0 en curso según
[task-board](docs/task-board.md); este README describe la instalación
limpia rehearseada en T31/T32.

## Revisión de código · 29 de octubre

Correcciones de backend, revisión de fuentes, estados de interfaz y ejemplos seleccionables ya aplicadas: [detalle e integración](docs/IMPLEMENTACION_20261029.md).

Con `npm run build` completado, `python scripts/demo.py` sirve API e interfaz desde <http://127.0.0.1:8000/>. No hace falta Vite para usar la compilación. Las dos terminales siguen disponibles para desarrollo.

Ejemplos reproducibles sin modificar tu base: `uv run python scripts/demo_story.py --output test-results/demo-story`. Crea una base temporal y exporta cuatro escenarios, cuatro informes y su comparación. No llama a Meta.

## Demo

Pack para revisores (capturas, guía de 5 minutos, límites honestos):
[docs/demo/](docs/demo/). Vista rápida:

![Resumen](docs/demo/01-resumen.png)
![Pricing Lab](docs/demo/02-precio.png)

## Requisitos previos

| Herramienta | Mínimo | Verificado (Windows, 29-oct-2026) |
|---|---|---|
| Python | >= 3.12 (`pyproject.toml`) | 3.14.7 |
| uv | reciente con workspaces | 0.12.5 |
| Node | >= 20.19 (Vite 6) | v26.3.0 |
| npm | cualquiera con `package-lock` | 12.0.2 |
| Chromium Playwright | solo para E2E | 1.64.1 (`npx playwright install chromium`) |

Sin claves ni red para la demo offline. La extracción live con Meta es
opt-in y necesita `MODEL_API_KEY` (ver [Configuración](#configuración)).

## Instalación (limpia)

Desde la raíz del repo:

```sh
uv sync --all-packages
npm install
npx playwright install chromium   # solo para test:e2e / verify.py completo
```

Notas exactas del ensayo limpio (T31):

- `uv sync` necesita `--all-packages` para instalar el miembro
  `apps/api`; sin ese flag el API no queda instalado.
- `npm install` no necesita aprobación manual de esbuild: los
  `allowScripts` de esbuild ya están fijados en `package.json`.
  Ensayo: `up to date, audited 313 packages, found 0 vulnerabilities`.
- Los locks (`uv.lock`, `package-lock.json`) fijan las versiones; no
  usar `latest`.

## Arranque

Tres terminales (o dos, si se usa `demo.py`):

```sh
# 1. API (migra al arrancar sobre storage vacío; sin seed automático)
python scripts/dev.py
# equivale a: uv run uvicorn bidlab.main:app --host 127.0.0.1 --port 8000

# 2. Semilla demo (idempotente; --reset solo en modo demo)
uv run python scripts/seed_demo.py

# 3. Web
npm run dev -w apps/web
```

Atajo demo: `python scripts/demo.py --reset-demo` resetea la DB demo,
siembra y arranca el API en un solo paso.

URLs:

- Web: <http://127.0.0.1:5173/> (botón demo → workspace `/tenders/tias`)
- API: <http://127.0.0.1:8000/api/v1/health> →
  `{"status":"ok","engine_version":"1.0.0","schema_version":"1.0.0"}`
- Capacidades y límites: `/api/v1/capabilities`

Storage por defecto `./storage` (SQLite WAL, gitignored). Para un
storage fresco aislado:

```powershell
$env:BIDLAB_STORAGE_DIR = "C:\ruta\fresca"   # PowerShell
```

```sh
export BIDLAB_STORAGE_DIR=/ruta/fresca       # bash
```

Comprobado en T19 (dos ensayos limpios R1+R2, 28-oct):
arrancar con storage vacío crea 20 tablas (alembic
`0006_job_generation`), la primera petición responde 200
(sin 500), y `GET /tenders` devuelve `total: 0` hasta
sembrar. Tras `seed_demo.py`: 1 tender (`tias`);
`POST /demo/sessions` → 201
`{"tender_id":"tias","scope_id":"tias-whole","company_id":"company-demo","mode":"demo"}`;
capacidades `mode: demo, meta_configured: false`; web `/` 200.

Mutaciones API (demo incluida) exigen cabeceras:

```sh
curl -X POST http://127.0.0.1:8000/api/v1/demo/sessions \
  -H "Content-Type: application/json" \
  -H "X-BidLab-Client: local-ui" -H "Idempotency-Key: <uuid>" -d "{}"
```

Sin `X-BidLab-Client: local-ui` → 403; sin `Idempotency-Key` → 422
(salvo revisión, que la acepta opcional).
El bind solo acepta loopback (`127.0.0.1`, `localhost`, `::1`).

## Verificación

```sh
python scripts/verify.py            # todas las puertas; exit 0 = verde
python scripts/verify.py --skip-e2e # sin Playwright
```

`verify.py` para en el primer fallo y devuelve su exit code. Puertas,
en orden: `uv sync --frozen --all-packages`, pytest unit,
pytest integration+contracts, `npm run lint`, `npm run typecheck`,
`npm run build`, `npm run test:unit`, `ruff check .`,
`mypy apps/api/bidlab`, Playwright E2E (Chromium, API+web reales).

Estado a 29-oct-2026 (contado en este árbol; detalle y comandos
en [verification-log](docs/verification-log.md)):

- Backend: 550 recogidos, 548 en verde + 2 skipped (live opt-in +
  symlink sin permiso en Windows).
  Web: 236 en 31 ficheros (`npm run test:unit`, verde).
  E2E: 77 tests herméticos (Chromium, loopback).
- `verify.py` completo (10/10 puertas): ALL CHECKS PASSED, exit 0 (@7af9417, 29-oct).
- Puertas locales: pytest, ruff, mypy, tsc, eslint, vitest,
  Playwright, `verify.py`. Sin CI remota (decisión del autor).
- Auditoría UX externa aplicada ([ux-review](docs/ux-review.md)).
- Alcance: ejemplo revisado (caso oro 10/15: mismos 49 puntos, el 10 %
  conserva 5916,80 € más) + recorrido propio completo offline
  (alta + PDF + empresa + análisis + revisión manual + simular +
  comparar + exportar) + visita guiada + malla de resistencia.
  Paquete integral: extracción con recibos live, gold humano +
  harness de control offline; comparación real texto/híbrido pendiente (T11), imagen exacta de página (T15),
  radar de incoherencias (T20), techo de coste con paridad motor (T21).
  Revisión 29-oct (issue #1, @7af9417): recibos/reservas/guardas backend,
  UI servida en el mismo origen, presets demo, composición coste/beneficio
  y `demo_story` reproducible (4 escenarios + 4 informes + comparación).
  Footage-oro regrabado post-paquete (VP9 15 s, UI actual);
  guion 180s v2 verificado; vídeo narrado pendiente del autor;
  sin envío.

## Configuración

Sin `.env`, el arranque usa: modo `demo`, bind `127.0.0.1:8000`,
storage `./storage`, historial desactivado. Para live con Meta, copiar
[.env.example](.env.example) a `.env` (gitignored, nunca commitear) y
definir `BIDLAB_MODE=live` + `MODEL_API_KEY`. Clave presente en modo
demo no activa live (`live_ready` exige ambas). `META_API_KEY`
pertenece al entorno del CLI de Muse, no a la app.

| Variable | Defecto | Efecto |
|---|---|---|
| `BIDLAB_MODE` | `demo` | `demo`/`live`/`manual` |
| `BIDLAB_BIND_HOST` / `BIDLAB_PORT` | `127.0.0.1` / `8000` | bind API (loopback only) |
| `BIDLAB_STORAGE_DIR` | `./storage` | SQLite + uploads |
| `BIDLAB_HISTORY_ENABLED` | `false` | histórico P1 desactivado |
| `BIDLAB_META_BUDGET_USD` | `20.00` | presupuesto de admisión y reservas Meta |
| `META_MODEL` | `muse-spark-1.3` | modelo de extracción |
| `MODEL_API_KEY` | vacío | live solo si modo=live y clave |

## Límites

- Un proceso Uvicorn + SQLite WAL; sin auth multiusuario (loopback +
  cabecera no es auth; despliegue público la exigiría).
- PDF: 20 MB, 120 páginas, 100.000 caracteres por página; curva limitada a 201
  puntos (ver `/api/v1/capabilities`).
- Sin todas las ofertas reales, los escenarios son hipótesis
  declaradas; no hay predictor de adjudicación ni distribución rival.
- `unknown` se representa con `null`, nunca cero; regla o scope
  pendientes bloquean puntos; la anormalidad es presunción, no
  exclusión automática.
- Sin Meta en vivo en el frontal (solo smoke backend); empresa y
  rivales sintéticos; sin predicción.
- Histórico descriptivo P1 aparcado salvo P0 sólido + tiempo.

## Notas honestas de la demo

- La insignia **Datos de ejemplo** significa: cifras de la semilla manual
  revisada (`fixtures/demo/`), no de extracción live. Tokens `null`.
  Las licitaciones propias muestran **Tus datos**.
- Offline total: los E2E abortan cualquier petición no-loopback.
- Ofertas de escenarios y costes de empresa sintéticos, siempre
  rotulados. Sin animaciones ni registros ficticios de API.
- Documentos originales de investigación bajo
  [publication-manifest](docs/publication-manifest.json): copias con
  publicación desactivada hasta revisión por fichero (T04 pendiente).

## Documentación

Contrato y diseño en `docs/`: [PRD](docs/PRD.md),
[ARCHITECTURE](docs/ARCHITECTURE.md),
[API_CONTRACT](docs/API_CONTRACT.yaml),
[DATA_MODELS](docs/DATA_MODELS.md), [RULE_ENGINE](docs/RULE_ENGINE.md),
[TEST_STRATEGY](docs/TEST_STRATEGY.md), [MILESTONES](docs/MILESTONES.md),
[DEMO_SUBMISSION](docs/DEMO_SUBMISSION.md),
[SOURCE_AUDIT](docs/SOURCE_AUDIT.md),
[DATA_FEASIBILITY](docs/DATA_FEASIBILITY.md). Reglas de agente en
[AGENTS.md](AGENTS.md). Puertas y entorno en
[task-board](docs/task-board.md), [environment](docs/environment.md),
[blockers](docs/blockers.md) y
[verification-log](docs/verification-log.md).

## Licencias y derechos

- Este repo aún no incluye fichero `LICENSE`; no asumir licencia de
  uso hasta que el autor la añada (T32 deja constancia, no la inventa).
- `evidence/originals/` excluido del repo público (ver
  `publication-manifest.json` y `.gitignore`): son copias de
  investigación, no una licencia concedida.
- `tools/` conserva sondas de investigación congeladas (excluidas del
  lint); `bidlab_blueprint/` y el ZIP son drops locales del autor,
  fuera del índice git.
