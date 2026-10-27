# BidLab — licitación real, revisión trazable, Pricing Lab determinista

[![bidlab-ci](https://github.com/iggykimi/bidlab/actions/workflows/ci.yml/badge.svg)](https://github.com/iggykimi/bidlab/actions/workflows/ci.yml)

BidLab ayuda a una pyme a decidir si pujar: biblioteca de licitaciones,
matriz de requisitos con citas localizadas en página, y Pricing Lab con
puntos, anomalía y curva calculados por un motor determinista en Python.
El LLM propone estructura y citas; la aritmética, la elegibilidad y la
anormalidad viven en dominio puro. Dinero y puntos en `Decimal`, API con
strings, sin fórmulas autoritativas en el frontend.

Caso P0: **2026/00006554N** (asistencia técnica del PAI de Tías),
PBL neto 118.336 EUR, 49 puntos de precio, regla proporcional inversa
(PCAP p.10) y anormalidad (PCAP p.20). Estado: P0 en curso según
[task-board](docs/task-board.md); este README describe la instalación
limpia rehearseada en T31/T32.

## Demo

Pack para revisores (capturas, guía de 5 minutos, límites honestos):
[docs/demo/](docs/demo/). Vista rápida:

![Resumen](docs/demo/01-resumen.png)
![Pricing Lab](docs/demo/02-precio.png)

## Requisitos previos

| Herramienta | Mínimo | Verificado (Windows, 26-oct-2026) |
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
  Ensayo: `up to date, audited 279 packages, found 0 vulnerabilities`.
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

Comprobado en T31: arrancar con storage vacío crea 18 tablas
(alembic `0001_initial`), la primera petición responde 200 (sin 500),
y `GET /tenders` devuelve `total: 0` hasta sembrar. Tras
`seed_demo.py`: 1 tender (`tias`), 6 páginas, 9 citas, 1 regla, 1
empresa + revisión; `POST /demo/sessions` → 201
`{"tender_id":"tias","scope_id":"tias-whole","company_id":"company-demo","mode":"demo"}`.

Mutaciones API (demo incluida) exigen cabeceras:

```sh
curl -X POST http://127.0.0.1:8000/api/v1/demo/sessions \
  -H "Content-Type: application/json" \
  -H "X-BidLab-Client: local-ui" -H "Idempotency-Key: <uuid>" -d "{}"
```

Sin `X-BidLab-Client: local-ui` → 403; sin `Idempotency-Key` → 422.
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

Estado a 27-oct-2026 (verificado por ejecución propia; detalle
y comandos en [verification-log](docs/verification-log.md)):

- `verify.py`: ALL CHECKS PASSED, 10/10 puertas, exit 0.
- Backend: 229 tests (164 unit + 65 integración/contratos); web: 109
  unit; E2E: 27/27 herméticos. Ruff y mypy limpios.
- CI (GitHub Actions, 18 pasos incl. Playwright): verde, ver badge.
- Auditoría UX externa aplicada; 4 jueces ≥ 9.5/10
  ([ux-review](docs/ux-review.md)).

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
| `BIDLAB_META_BUDGET_USD` | `20.00` | techo de gasto Meta |
| `META_MODEL` | `muse-spark-1.3` | modelo de extracción |
| `MODEL_API_KEY` | vacío | live solo si modo=live y clave |

## Límites

- Un proceso Uvicorn + SQLite WAL; sin auth multiusuario (loopback +
  cabecera no es auth; despliegue público la exigiría).
- PDF: 20 MB, 120 páginas, 100.000 caracteres; curva limitada a 201
  puntos (ver `/api/v1/capabilities`).
- Sin todas las ofertas reales, los escenarios son hipótesis
  declaradas; no hay predictor de adjudicación ni distribución rival.
- `unknown` se representa con `null`, nunca cero; regla o scope
  pendientes bloquean puntos; la anormalidad es presunción, no
  exclusión automática.
- Histórico descriptivo P1 aparcado salvo P0 sólido + tiempo.

## Notas honestas de la demo

- La insignia **Demo curada** significa: cifras de la semilla manual
  revisada (`fixtures/demo/`), no de extracción live. Tokens `null`.
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
