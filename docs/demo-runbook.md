# BidLab — runbook de grabación demo 180 s

Fuente del guion: [demo-script-180s.md](demo-script-180s.md) (T33, borrador).
Arranque verificado contra [README.md](../README.md) (Arranque),
`scripts/demo.py`, `scripts/dev.py`, `scripts/seed_demo.py`,
`tests/e2e/helpers.ts`, specs E01–E08 y componentes citados.
UI en español. Sin vídeo grabado antes de este runbook.

Regla de honestidad (del guion): solo se muestra lo que existe y pasa E2E
en Chromium. No se muestra instalación, claves ni recuperaciones no medidas.

## 0. Puertos y URLs (fijos por el repo)

| Servicio | Puerto | URL |
|---|---|---|
| API (uvicorn, loopback) | 8000 (`BIDLAB_PORT`) | <http://127.0.0.1:8000/api/v1/health> |
| Capacidades | — | <http://127.0.0.1:8000/api/v1/capabilities> |
| Web (Vite dev, `apps/web/vite.config.ts`) | 5173 | <http://127.0.0.1:5173/> |

- La API solo acepta bind loopback (`127.0.0.1`, `localhost`, `::1`):
  `scripts/dev.py` rechaza cualquier otro host con exit 2.
- Health esperado: `{"status":"ok","engine_version":"1.0.0","schema_version":"1.0.0"}`.
- Tras «Cargar ejemplo», la app navega a `/tenders/tias?tab=resumen`
  (`apps/web/src/features/library/LibraryPage.tsx`).

## 1. Checklist pre-grabación (en orden, dos terminales)

Terminal 1 — API + seed (bloquea el terminal):

```sh
python scripts/demo.py --reset-demo
```

Esto hace, en orden (`scripts/demo.py` + `scripts/seed_demo.py`):

1. Fija `BIDLAB_MODE=demo` si no está definido.
2. `uv run python scripts/seed_demo.py --reset`: borra
   `<storage>/bidlab.sqlite3` más `-wal` y `-shm`, y resiembra
   (1 tender `tias`, 6 páginas, 9 citas, 1 regla, 1 empresa + revisión).
   `--reset` se niega (exit 2) si `BIDLAB_MODE` no es `demo`.
3. Arranca la API con `scripts/dev.py`
   (`uv run uvicorn bidlab.main:app --host 127.0.0.1 --port 8000`).

Storage por defecto: `./storage` (gitignored, SQLite WAL).
Para aislar la grabación del storage habitual, antes del paso anterior:

```powershell
$env:BIDLAB_STORAGE_DIR = "C:\ruta\fresca"   # PowerShell
```

```sh
export BIDLAB_STORAGE_DIR=/ruta/fresca       # bash
```

Terminal 2 — web (Vite dev, sin build):

```sh
npm run dev -w apps/web
```

Prerrequisitos (solo si la máquina no está instalada, ver README):

```sh
uv sync --all-packages
npm install
```

Verificación previa (sin grabar, ~1 min):

1. Abrir <http://127.0.0.1:8000/api/v1/capabilities> y comprobar
   `mode` = `demo`, `meta_configured` = `false`.
   (`meta_configured` refleja `live_ready`: exige modo live + clave.)
2. Abrir <http://127.0.0.1:5173/>, clic en «Cargar ejemplo»,
   comprobar título con «Tías» e insignia «Demo curada».
3. Ventana del navegador 1280×720, zoom 100 %
   (viewport del E11 de escritorio en `tests/e2e/e11-responsive.spec.ts`).
4. Perfil limpio o localStorage vaciado para el origen 127.0.0.1:5173:
   claves `bidlab.session.v1`, `bidlab.scenarios.v1`, `bidlab.reports.v1`
   (`apps/web/src/lib/session.ts`). DevTools → Application → Local Storage.
5. Sin `.env` visible, sin claves en pantalla, sin ventanas ajenas.
   (Un `.env` con `BIDLAB_MODE=demo` también vale; lo que manda es
   lo que diga `/capabilities`.)
6. No pulsar el enlace «Ver publicación en Contratación del Estado»
   ni «Fuente oficial (Atom)»: son enlaces externos reales y los E2E
   exigen cero peticiones no-loopback (`installOfflineGuard`).

Nota: `demo.py` NO arranca el frontal; el terminal 2 es obligatorio.
Nota: el overlay «Demo curada · documento público real · empresa y
rivales hipotéticos» NO existe en la UI (ver §5, desajuste 1):
hay que añadirlo como rótulo de grabación/edición, no esperarlo en pantalla.

## 2. Qué debe verse por bloque (guion § «Guion segundo a segundo»)

Textos entre «» son literales verificados en código o E2E.

### 00–12 s — Biblioteca `/`

- En pantalla: «BidLab», «De un pliego a una decisión de oferta»,
  botón «Cargar ejemplo», sección «Biblioteca local».
- Acción: clic en «Cargar ejemplo» → navega a
  `/tenders/tias?tab=resumen`.
- Tras el clic debe aparecer título con «Tías»
  (`Servicios de asistencia técnica de gestión del Plan de Actuación
  Integrado de Tías`).

### 12–25 s — Resumen `/tenders/tias?tab=resumen`

- Insignia «Demo curada» arriba a la derecha.
- Aviso: «Demo curada: cifras de semilla revisada del 25/10/2026,
  no extracción en vivo. Las hipótesis de rivales y el coste de
  empresa son sintéticos.»
- Cabecera: «PBL neto 118.336,00 € · bruto 126.619,52 €»
  (`fixtures/demo/tender.json`: `pbl_net` 118336.00,
  `pbl_gross` 126619.52; formato `es-ES`).
- «49 puntos» («Puntos de precio», `review.json`: `max_points` 49,
  `template_id` proportional_inverse).
- «Fecha de la instantánea» 25 oct 2026 (formato medio `es-ES`,
  de `source_updated_at` 2026-10-25).
- Enlace «Ver publicación en Contratación del Estado» (visible,
  NO pulsarlo).

### 25–45 s — Pestaña «Requisitos»

- Clic en la pestaña «Requisitos».
- Fila «Servicios similares año mayor ejecución ≥ 207.088,00 €»:
  resultado «Por verificar» (E02; `verdictEs` traduce unknown).
- Acción: clic en el chip «p. 6»
  (aria «Ver evidencia …, página 6»).
- Drawer «Evidencia documental»: «Página 6 de 41»
  (`pages_count=41` en `apps/api/bidlab/services/seed.py`),
  cita con «207.088,00€» (`interpretation.json`,
  `technical_services_threshold`).
- Cerrar con «Cerrar» o Escape antes del siguiente bloque.

### 45–60 s — Pestaña «Precio» (etiqueta visible; el guion la llama «Pricing Lab»)

- Clic en la pestaña «Precio».
- KPIs iniciales (baja 5 %, `fixtures/demo/expected.json` + E03):
  precio «112.419,20 €», beneficio «+22.419,20 €»
  (`formatSignedEUR`, con signo +), puntos «46,4211 / 49,0000».
- Panel «Hipótesis de rivales»: campos con «106502.40» y «110052.48»
  (formato de entrada `1234.56`, sin separador de miles, con punto).
- Notas de honestidad visibles: «(empresa sintética)»,
  «coste de empresa sintética», «hipótesis declarada, sin cita documental»,
  «Mejor oferta incluyendo la propia · máx. 49».

### 60–85 s — Baja 5 → 15

- Acción: campo «Baja (%)» (`discount-input`): escribir `15` + Tab.
- KPIs: precio «100.585,60 €», beneficio «+10.585,60 €»,
  puntos «49,0000 / 49,0000» (E03).
- Bajar a la sección «Ver cálculo»: tabla de pasos con valores
  (`100585.60` en la traza, E03) y línea
  «Regla … rev. … · motor … · empresa rev. …».

### 85–105 s — Rival A cambia

- Acción: primero devolver «Baja (%)» a `5` + Tab (vuelve a 46,4211).
- Luego campo «Hipótesis A · precio neto»: escribir `100585.60`
  (punto decimal, formato `1234.56`) → puntos «43,8421 / 49,0000» (E04).
- Sección «Supuestos declarados» visible al hacer scroll.
- No aparece «probabilidad» ni «optimizar para ganar» (E04 lo aserta).

### 105–130 s — Baja al 30 %

- Acción: restaurar rival A a `106502.40`; «Baja (%)» a `30` + Tab.
- KPI «Presunción de anormalidad»: «Posible necesidad de justificación»
  (E05; `anomalyEs`), subtítulo «Presunción condicional,
  no exclusión automática».
- En pantalla NO aparece «excluida» (E05 lo aserta).
- Referencia (`expected.json`, caso 30 %): precio 82.835,20 €,
  beneficio negativo −7.164,80 €.

### 130–150 s — Traza

- Sección «Ver cálculo»: pasos precio → mejor oferta → puntuación →
  anormalidad → margen; «Regla tias-price-r1 rev. 1 · motor 1.0.0 ·
  empresa rev. 1»; «Huellas de fuente».
- KPI puntos: «Fuente: regla proportional_inverse · 49 puntos».
- «Supuestos declarados» y «Curva precio-puntos»
  (41 puntos de curva del backend; no confundir con las 41 páginas).

### 150–170 s — Guardar escenario + Informe

- Sección «Comparar escenarios»: escribir nombre
  (p. ej. `Demo 5 %`; por defecto «Base 5 %»), clic «Guardar escenario».
- Aparece «Guardado: `<hash16>…`» + enlace «Abrir en Informe»: pulsarlo
  (E07; lleva a `?tab=informe&scenario=<id>`).
- Pestaña «Informe», «Escenarios guardados»: detalle con «112.419,20»,
  «Snapshot `<64 hex>`», «Regla … rev. 1 · empresa rev. 1 · motor …»,
  «Hipótesis», «Pendientes (n)», «Fuentes (n)».
- «Nuevo informe»: marcar radio «Preparar oferta» (el defecto es
  «Seguir estudiando»), escribir nota, clic «Exportar informe».
- Debe aparecer «Decisión: Preparar oferta» (E08).

### 170–180 s — Descarga y cierre

- Clic «Descargar HTML» → descarga `bidlab-informe-<id>.html`
  (contiene `proportional_inverse`, `tias-18-5`, el hash, «sintética»,
  «Pendientes», «Demo curada»; sin secretos ni `<script`, E08).
- Cierre: clic en la pestaña «Resumen», plano final con
  insignia «Demo curada».

## 3. Fallbacks si algo falla en directo

La demo es 100 % loopback: NO necesita Meta, red ni claves.
`meta_configured=false` es el estado correcto, no un fallo.

| Fallo | Síntoma en UI | Fallback (en orden) |
|---|---|---|
| API caída | «…Reintenta cuando la API local responda.» (biblioteca, requisitos, precio, informe) | 1. Comprobar Terminal 1 vivo y <http://127.0.0.1:8000/api/v1/health>. 2. Rearrancar sin reset: `python scripts/dev.py` (conserva la DB). 3. Recargar la página y repetir el bloque. |
| Web caída | Página en blanco / conexión rechazada en 5173 | Rearrancar Terminal 2: `npm run dev -w apps/web`. La sesión demo vive en localStorage; si se pierde, repetir «Cargar ejemplo». |
| DB sucia (ensayos previos) | Escenarios/informes viejos en «Informe» | Repetir desde cero: parar API, `python scripts/demo.py --reset-demo`, vaciar las 3 claves `bidlab.*.v1` de localStorage, recargar. |
| Puerto 8000 ocupado | uvicorn error al arrancar | Localizar el proceso que escucha 8000 y pararlo; o `BIDLAB_PORT=<libre>` en ambas terminales (la web dev usa `VITE_API_URL`, por defecto `http://127.0.0.1:8000/api/v1`). No inventar puertos distintos sin comprobar. |
| Puerto 5173 ocupado | Vite error / otro proyecto | Parar el otro proceso; Vite propone puerto alternativo solo si se acepta explícitamente. |
| Intento live sin clave | Botón «Intentar análisis en vivo» | Es el comportamiento E09 esperado: mensaje «Meta no está configurado en este equipo… No se ha enviado ningún documento ni se ha simulado un análisis.» Cero llamadas a `/analysis`. No reintentar como si fuera un error. |
| Enlace externo pulsado por error | Se abre contrataciondelestado / Atom | Cortar el plano, volver atrás, repetir el bloque sin pulsar enlaces. |
| Formato rival rechazado | «Precio A no válido» bajo el campo | Reescribir con punto decimal: `100585.60`, nunca `100.585,60` (el campo exige formato `1234.56`). |

Si la grabación se interrumpe a mitad: el orden de recuperación es
API → web → recargar → «Cargar ejemplo» → navegar a la pestaña del bloque
(`?tab=resumen|requisitos|pricing|informe`; la pestaña de precio es
`pricing`, etiqueta «Precio»).

## 4. Limpieza post-grabación

1. Parar los dos terminales (Ctrl+C en cada uno).
2. (Opcional, deja el repo como estaba) reset del storage de grabación:
   `uv run python scripts/seed_demo.py --reset` con `BIDLAB_MODE=demo`,
   o borrar la carpeta usada en `BIDLAB_STORAGE_DIR`
   (por defecto `./storage`, gitignored).
3. Vaciar localStorage del origen 127.0.0.1:5173
   (`bidlab.session.v1`, `bidlab.scenarios.v1`, `bidlab.reports.v1`).
4. Borrar `bidlab-informe-*.html` de la carpeta de descargas.
5. Si hubo ensayos E2E: `test-results/` y `playwright-report/` están
   gitignored; se pueden borrar.
6. No commitear nada de la grabación. `git status` debe quedar limpio
   salvo este runbook (nuevo, sin commit según encargo).

## 5. Desajustes guion-vs-repo encontrados

1. **Rótulo persistente inexistente en la UI.** El guion exige «En pantalla
   siempre: “Demo curada · documento público real · empresa y rivales
   hipotéticos”». Esa cadena no existe en el código: `DemoBadge` solo
   renderiza «Demo curada» (y nada en Biblioteca, `mode={null}`), y el
   aviso del workspace dice «Demo curada: cifras de semilla revisada del
   25/10/2026, no extracción en vivo. Las hipótesis de rivales y el coste
   de empresa son sintéticos.» Debe añadirse como rótulo de grabación.
2. **Nombre de pestaña.** El guion dice «Pestaña Pricing Lab»;
   la etiqueta visible es «Precio» (`id` de pestaña `pricing`,
   `WorkspacePage.tsx`, `helpers.ts openTab`). «PricingLab» es solo
   el nombre del componente.
3. **Preparación, paso 3.** «Coste y rivales iniciales visibles arriba»:
   tras «Cargar ejemplo» se aterriza en Resumen (título, PBL, badge,
   aviso). Coste y rivales solo se ven en la pestaña «Precio».
   Hay que añadir «clic en Precio» a la comprobación previa.
4. **Falta arrancar el frontal.** La preparación cita solo `demo.py`
   (API+seed); sin `npm run dev -w apps/web` no hay nada que grabar.
5. **«Por verificar · unknown».** La UI muestra «Por verificar»
   (`verdictEs`) más motivos en español; el literal `unknown` no
   aparece en `RequirementsTab` y E02 solo aserta «Por verificar».
   No prometer la cadena «unknown» en pantalla.
6. **Formato de rivales.** El guion escribe «A 106.502,40, B 110.052,48»;
   los campos muestran `106502.40` / `110052.48` (formato `1234.56`,
   etiqueta «precio neto (€, formato 1234.56)»). Al editar hay que
   teclear con punto decimal.
7. **Puntos y beneficio exactos.** El guion abrevia («46,4211 de 49»,
   «beneficio 22.419,20»); en pantalla es «46,4211 / 49,0000»
   (`formatPoints` en ambos) y «+22.419,20 €» (`formatSignedEUR`
   con signo). Contiene lo narrado, pero el plano mostrará el `+` y `/`.
8. **«Snapshot 25/10».** La fecha se renderiza con formato medio `es-ES`
   (`formatDateTime`, p. ej. «25 oct 2026, …»), no literalmente «25/10».
   El dato (2026-10-25) es correcto.

Sin desajuste (verificado correcto): `demo.py --reset-demo`, capacidades
demo/false, URLs y puertos, «Cargar ejemplo», ruta
`/tenders/tias?tab=resumen`, PBL neto/bruto, 49 puntos,
enlace «Ver publicación en Contratación del Estado», «p. 6» →
«Página 6 de 41» + cita 207.088, KPIs 5 %/15 %/30 % y 43,8421,
«Ver cálculo», «Supuestos declarados», «Comparar escenarios» →
«Guardar escenario» → «Abrir en Informe», hash 64 hex,
«empresa rev. 1», radio «Preparar oferta», «Exportar informe»,
«Descargar HTML», y el mapa de evidencia E01–E08 con
`fixtures/demo/expected.json` (90000.00 = 80000 + 10000 de
`company.json`; casos 5/15/30 %; anomalía a 30 %).
