# BidLab — runbook de grabación demo 180 s

Fuente del guion: [demo-script-180s.md](demo-script-180s.md) (R07, borrador).
Arranque verificado contra [README.md](../README.md) (Arranque),
`scripts/demo.py`, `scripts/dev.py`, `scripts/seed_demo.py`,
`tests/e2e/helpers.ts`, specs E01–E12, CMP-01/CMP-02, R01–R06, own-journey
y componentes citados.
UI en español, tuteo. Sin vídeo grabado antes de este runbook.

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
- Pestañas del ejemplo: «Resumen», «Requisitos», «Precio», «Citas»,
  «Informe» (`?tab=resumen|requisitos|precio|evidencia|informe`; la de
  citas viaja como `evidencia`). Las licitaciones propias añaden «Revisar»
  (`?tab=revisar`).

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
   comprobar título con «Tías» e insignia «Datos de ejemplo».
3. Ventana del navegador 1280×720, zoom 100 %
   (viewport R06 de escritorio en `tests/e2e/r06-layout.spec.ts`).
4. Clic en la pestaña «Precio»: el campo «Escribe tu rebaja (%)» debe
   caber en el primer pantallazo sin scroll (R06, assert de bounding-box).
5. Perfil limpio o localStorage vaciado para el origen 127.0.0.1:5173:
   claves `bidlab.session.v1` (`apps/web/src/lib/session.ts`) y
   `bidlab.drafts.v2` (`apps/web/src/lib/draftStore.ts`).
   DevTools → Application → Local Storage.
6. Sin `.env` visible, sin claves en pantalla, sin ventanas ajenas.
   (Un `.env` con `BIDLAB_MODE=demo` también vale; lo que manda es
   lo que diga `/capabilities`.)
7. No pulsar el enlace «Ver publicación en Contratación del Estado»
   ni «Fuente oficial»: son enlaces externos reales y los E2E
   exigen cero peticiones no-loopback (`installOfflineGuard`).

Nota: `demo.py` NO arranca el frontal; el terminal 2 es obligatorio.
Nota: el rótulo «Datos de ejemplo · documento público real · empresa y
rivales hipotéticos» NO existe en la UI (ver §6, desajuste 1):
hay que añadirlo como rótulo de grabación/edición, no esperarlo en pantalla.

## 2. Qué debe verse por bloque (guion R07, caso oro 10/15)

Textos entre «» son literales verificados en código o E2E.

### 00–15 s — Biblioteca `/` (bloque 1)

- En pantalla: «BidLab», «De un pliego a una decisión de oferta»,
  botón «Cargar ejemplo», sección «Biblioteca local».
- Acción: clic en «Cargar ejemplo» → navega a
  `/tenders/tias?tab=resumen`.
- Tras el clic debe aparecer título con «Tías»
  (`Servicios de asistencia técnica de gestión del Plan de Actuación
  Integrado de Tías`).

### 15–40 s — Resumen `/tenders/tias?tab=resumen` (bloque 2)

- Insignia «Datos de ejemplo» arriba a la derecha.
- Aviso: «Datos de ejemplo. Los precios de los rivales y tu coste son
  inventados para que puedas probar.»
- Cabecera: «Presupuesto de salida: 118.336 € sin IGIC
  (126.619,52 € con IGIC)»
  (`fixtures/demo/tender.json`: `pbl_net` 118336.00,
  `pbl_gross` 126619.52; formato `es-ES`).
- «Lo esencial»: «El precio da hasta 49 puntos. Aquí solo calculas los
  puntos del precio. Revisa los demás criterios en el pliego de
  condiciones (PCAP).» (`review.json`: `max_points` 49,
  `template_id` proportional_inverse).
- «Datos del 25 de octubre de 2026.» (de `source_updated_at`
  2026-10-25, formato corto `es-ES` sin dependencia de huso).
- Enlace «Ver publicación en Contratación del Estado» (visible,
  NO pulsarlo).
- Línea de honestidad (plano corto): «El asistente de IA no está
  disponible en esta demo: aquí los datos ya vienen revisados.» (E09;
  no existe botón de intento live: `live-attempt` tiene count 0).

### 40–60 s — Pestaña «Requisitos» (bloque 3)

- Clic en la pestaña «Requisitos».
- Fila «Servicios similares año mayor ejecución ≥ 207.088,00 €»:
  resultado «Por verificar» (E02; `verdictEs` traduce unknown).
- Acción: clic en el botón «Ver página 6»
  (aria «Ver página 6 en el pliego: …»).
- Drawer «Cita del pliego, página 6»: «Página 6 de 41»
  (`pages_count=41` en `apps/api/bidlab/services/seed.py`),
  cita con «207.088» (`interpretation.json`,
  `technical_services_threshold`).
- Cerrar con «Cerrar» o Escape antes del siguiente bloque.

### 60–80 s — Pestaña «Precio», coste e hipótesis (bloque 4)

- Clic en la pestaña «Precio».
- Sección «¿Cuánto quieres rebajar?»: «Rebaja: 5,0 %» por defecto,
  campo «Escribe tu rebaja (%)» visible sin scroll (R06).
- KPIs iniciales (rebaja 5 %, `fixtures/demo/expected.json` + E03):
  «Tu oferta» «112.419,20 €», «Tu beneficio» «+22.419,20 €»,
  «Tus puntos por precio» «46,4 de 49».
- Resumen de coste (sin abrir el editor): «Pyme de ejemplo · directos
  80.000,00 € · indirectos 10.000,00 € · revisión 1.»
  (`fixtures/demo/company.json`). Línea de beneficio: «Es un dato
  inventado.»
- Panel «Prueba con precios de rivales»: A «106.502,40 €»,
  B «110.052,48 €» (campos «Rival A · precio sin IGIC en € (coma o
  punto)», aceptan coma o punto), «Tomas estos como todos los rivales.»
- Notas de honestidad visibles: «Empiezan inventados. Pon los que creas
  probables.», «No adivinamos los rivales: usamos tus precios.»,
  «Precios de rivales inventados por ti para probar» (en «Supuestos
  declarados»).

### 80–100 s — Rebaja al 10 % (bloque 5, caso oro)

- Acción: campo «Escribe tu rebaja (%)»: escribir `10` + Tab.
- KPIs: «Tu oferta» «106.502,40 €», «Tu beneficio» «+16.502,40 €»,
  «Tus puntos por precio» «49,0 de 49» (CMP-02, R06).
- «Conclusión»: «Sacarías 49,0 de 49 puntos por precio.»
- Bajar a «¿Cómo sale tu resultado?»: «Tu precio: 118.336 € menos un
  10,0 % = 106.502,40 €.», «La oferta más barata es 106.502,40 €.»,
  «Tus puntos: 49 puntos máximos × oferta más barata ÷ tu oferta = 49,0.»

### 100–122 s — Guardar 10 y 15, comparar desde Precio (bloque 6)

- Sección «¿Guardas esta prueba?»: escribir nombre (p. ej. `Demo 10`),
  clic «Guardar esta prueba» → «Prueba «Demo 10» guardada.»
  + enlace «Verla en el informe» (NO pulsarlo aún).
- «Escribe tu rebaja (%)» a `15` + Tab: «100.585,60 €»,
  «+10.585,60 €», «49,0 de 49» (E03, `expected.json`).
- Guardar como `Demo 15` → «Prueba «Demo 15» guardada.»
- Sin salir de «Precio», sección «¿Qué prueba te conviene más?»
  (R06, `CompareFromPricing` reutiliza la bandeja de Informe):
  marcar PRIMERO «Comparar Demo 10» (queda como base) y después
  «Comparar Demo 15», clic «Comparar».
- Resultado: «Puedes compararlas: comparten contexto.», delta precio
  «-5916,80 €» (formato `es-ES`: sin punto de miles bajo 10.000),
  ««Demo 10» conserva 5916,80 € más de beneficio con los mismos puntos.»
  y ««Demo 10» supera a «Demo 15» en beneficio, con los mismos puntos,
  en este caso.» (CMP-02 + backend `higher_profit_same_score`).

### 122–140 s — Cambio de hipótesis (bloque 7)

- Acción: «Escribe tu rebaja (%)» de vuelta a `5` + Tab
  (vuelve a «46,4 de 49»).
- Luego campo «Rival A · precio sin IGIC en € (coma o punto)»:
  escribir `100585.60` → «43,8 de 49» (E04).
- Sección «Supuestos declarados» visible al hacer scroll.
- No aparece «probabilidad» ni «optimizar para ganar» (E04 lo aserta).
- Al final, restaurar rival A a `106502.40` («46,4 de 49` de nuevo).

### 140–158 s — Conjunto incompleto (bloque 8, opcional)

- Acción: desmarcar «Tomar estos como todos los rivales».
- «Tus puntos por precio» → «Sin determinar»; «Tu oferta»
  («112.419,20 €») y «Tu beneficio» («+22.419,20 €») intactos (E06).
- Volver a marcar antes del bloque 9.
- Si falta tiempo, saltar al bloque 9.

### 158–180 s — Informe y cierre (bloque 9)

- Clic en la pestaña «Informe».
- «Paso 1 · Abre una prueba guardada»: clic «Abrir prueba Demo 10»:
  «Precio neto» 106.502,40 €, «Copia (SHA-256)» de 64 hex (E07),
  «Regla tias-price-r1 rev. 1 · empresa rev. 1 · motor 1.0.0»,
  «Supuestos», «Lo que te falta por comprobar (n)», «Fuentes (n)».
- «Paso 2 · Decide y crea tu informe»: «Borrador (sin archivar). Tú decides:
  elige una opción, escribe tu nota y crea el informe.»
  Marcar radio «Preparar oferta» (el defecto es «Seguir estudiándola»),
  escribir nota en «Tus notas (saldrán tal cual en el informe)»,
  clic «Crear informe» → «Decisión: Preparar oferta» (E08).
- Clic «Descargar HTML» → descarga `bidlab-informe-<fecha>.html`
  (contiene `proportional_inverse`, `tias-18-5`, el hash, «sintética»,
  «Pendientes»; sin secretos ni `<script`, E08).
- Cierre: clic en la pestaña «Resumen», plano final con
  insignia «Datos de ejemplo».

## 3. Recorrido propio (fuera del vídeo; para ensayo local)

Fijado por tests/e2e/own-journey.spec.ts (4/4, R05 ×4) + R01–R04.
Mismos puertos, mismo arranque; no toca el ejemplo.

1. Biblioteca → «Nueva licitación» → «¿Qué licitación quieres dar de
   alta?» → «Crear y continuar».
2. «¿Quieres añadir el pliego en PDF?» → «Subir documento» →
   «Continuar con tu empresa» (o «Continuar sin documento»).
3. «¿Quién eres en esta licitación?» → «Crear tu empresa»
   (o «Continuar sin empresa»): atajo honesto «Crea tu empresa
   en Revisar» si faltan costes.
4. «Revisar» (insignia «Tus datos»): «¿Pides propuestas automáticas?»
   → «Pedir propuestas automáticas» → «Lista»,
   «Sin propuestas automáticas; revisa a mano.» (análisis offline,
   sin red). Formulario: «Presupuesto sin impuestos (€)»,
   «¿Cómo reparte puntos tu pliego?», «Puntos máximos del precio»,
   «¿Qué revisaste? (motivo)» → «Aprobar tu revisión» →
   «Ya guardamos tu revisión» → «Ir a Precio». Atajo honesto
   «Revisa tu fórmula» si falta la regla.
5. «Precio»: simular, «Guardar esta prueba» → «Verla en el informe».
6. «Informe»: «¿Qué prueba te conviene más?» → «Comparar» (misma
   bandeja que en Precio), «Paso 2 · Decide y crea tu informe»,
   «Crear informe», «Descargar HTML».

## 4. Fallbacks si algo falla en directo

La demo es 100 % loopback: NO necesita Meta, red ni claves.
`meta_configured=false` es el estado correcto, no un fallo.

| Fallo | Síntoma en UI | Fallback (en orden) |
|---|---|---|
| API caída | «No pudimos cargar …» + «Reintentar» (biblioteca, requisitos, precio, informe) | 1. Comprobar Terminal 1 vivo y <http://127.0.0.1:8000/api/v1/health>. 2. Rearrancar sin reset: `python scripts/dev.py` (conserva la DB). 3. Recargar la página y repetir el bloque. |
| Web caída | Página en blanco / conexión rechazada en 5173 | Rearrancar Terminal 2: `npm run dev -w apps/web`. La sesión demo vive en localStorage; si se pierde, repetir «Cargar ejemplo». |
| DB sucia (ensayos previos) | Pruebas/informes viejos en «Informe» | Repetir desde cero: parar API, `python scripts/demo.py --reset-demo`, vaciar las 2 claves (`bidlab.session.v1`, `bidlab.drafts.v2`) de localStorage, recargar. |
| Borrador no persistido (R04) | «Tu borrador no se guardó en este navegador.» + «Sigue en memoria: no recargues ni cierres esta pestaña.» | No recargar: pulsar «Reintentar guardado». Si persiste, liberar espacio/cuota del navegador y reintentar. El borrador en memoria sigue editable. |
| Coste obsoleto (R02) | «Tus datos cambiaron en otro lugar.» | En directo: no forzar; «Guardar de todas formas» solo si el valor en pantalla es el querido. Si aparece sin ensayo paralelo, repetir desde DB limpia. |
| Puerto 8000 ocupado | uvicorn error al arrancar; E2E abortan vía `check-ports.mjs` | Localizar el proceso que escucha 8000 y pararlo; o `BIDLAB_PORT=<libre>` en ambas terminales (la web dev usa `VITE_API_URL`, por defecto `http://127.0.0.1:8000/api/v1`). No inventar puertos distintos sin comprobar. |
| Puerto 5173 ocupado | Vite error / otro proyecto | Parar el otro proceso; Vite propone puerto alternativo solo si se acepta explícitamente. |
| Intento live sin clave | Línea «El asistente de IA no está disponible en esta demo…» (E09) | Es el comportamiento esperado: cero llamadas a `/analysis`, sin botón de reintento. No reintentar como si fuera un error. |
| Enlace externo pulsado por error | Se abre contrataciondelestado / fuente oficial | Cortar el plano, volver atrás, repetir el bloque sin pulsar enlaces. |
| Formato rival rechazado | Alerta bajo el campo | Reescribir con coma o punto: `100585.60` o `100585,60` (la etiqueta dice «coma o punto»). |

Si la grabación se interrumpe a mitad: el orden de recuperación es
API → web → recargar → «Cargar ejemplo» → navegar a la pestaña del bloque
(`?tab=resumen|requisitos|precio|evidencia|informe`; la pestaña de citas es
`evidencia`, etiqueta «Citas»; «Revisar» solo existe en licitaciones propias).

## 5. Limpieza post-grabación

1. Parar los dos terminales (Ctrl+C en cada uno).
2. (Opcional, deja el repo como estaba) reset del storage de grabación:
   `uv run python scripts/seed_demo.py --reset` con `BIDLAB_MODE=demo`,
   o borrar la carpeta usada en `BIDLAB_STORAGE_DIR`
   (por defecto `./storage`, gitignored).
3. Vaciar localStorage del origen 127.0.0.1:5173
   (`bidlab.session.v1`, `bidlab.drafts.v2`).
4. Borrar `bidlab-informe-*.html` de la carpeta de descargas.
5. Si hubo ensayos E2E: `test-results/` y `playwright-report/` están
   gitignored; se pueden borrar.
6. No commitear nada de la grabación sin autorización del autor.
   `git status` debe quedar limpio salvo los docs del encargo.

## 6. Desajustes guion-vs-repo encontrados (R07)

1. **Rótulo persistente inexistente en la UI.** El guion exige el rótulo
   de grabación «Datos de ejemplo · documento público real · empresa y
   rivales hipotéticos». Esa cadena no existe en el código: `DemoBadge`
   solo renderiza «Datos de ejemplo» (y nada en Biblioteca, `mode={null}`),
   y el aviso del workspace dice «Datos de ejemplo. Los precios de los
   rivales y tu coste son inventados para que puedas probar.» Debe
   añadirse como rótulo de grabación/edición.
2. **Nombre de pestaña.** El guion antiguo decía «Pestaña Pricing Lab»;
   la etiqueta visible es «Precio» (`id` de pestaña `precio`,
   `WorkspacePage.tsx`, `helpers.ts openTab`). «PricingLab» es solo
   el nombre del componente. El guion R07 ya dice «Precio».
3. **Claves de localStorage.** El runbook antiguo citaba tres claves
   `bidlab.*.v1`; hoy son dos: `bidlab.session.v1` (sesión) y
   `bidlab.drafts.v2` (borradores). Actualizado en §1 y §5.
4. **Puntos con 1 decimal.** Los KPIs muestran «46,4 de 49» /
   «49,0 de 49» (`formatPoints` canónico), no «46,4211 / 49,0000».
   El guion R07 usa el formato visible.
5. **Miles bajo 10.000.** El formato `es-ES` no agrupa bajo 10.000:
   «-5916,80 €», «5916,80 €» (CMP-02, backend `_abs_money_es`).
   No escribir «5.916,80» para el delta oro.
6. **Comparar vive en Precio e Informe.** Desde R06 la misma bandeja
   «¿Qué prueba te conviene más?» existe en ambas pestañas
   (`CompareFromPricing`). El guion compara sin salir de Precio.
7. **Sin botón live.** No existe «Intentar análisis en vivo» en el
   frontal (E09 aserta `live-attempt` count 0 y cero llamadas).
   El fallback antiguo que lo citaba se ha retirado.

Sin desajuste (verificado correcto): `demo.py --reset-demo`, capacidades
demo/false, URLs y puertos, «Cargar ejemplo», ruta
`/tenders/tias?tab=resumen`, PBL neto/bruto, 49 puntos,
enlace «Ver publicación en Contratación del Estado», «Ver página 6» →
«Página 6 de 41» + cita 207.088, caso oro 10/15 (106.502,40 /
+16.502,40 / 49,0 de 49 frente a 100.585,60 / +10.585,60 / 49,0 de 49,
delta −5916,80 € con los mismos puntos), «¿Cómo sale tu resultado?»,
«Supuestos declarados», «¿Guardas esta prueba?» →
«Guardar esta prueba» → «Verla en el informe», «Copia (SHA-256)» 64 hex,
«empresa rev. 1», radio «Preparar oferta», «Crear informe»,
«Descargar HTML», y el mapa de evidencia E01–E09 + CMP-02 + R01–R06 +
own-journey con `fixtures/demo/expected.json` (90000.00 = 80000 + 10000
de `company.json`; casos 5/15/30 %; caso 10 % fijado por specs).
