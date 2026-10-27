# BidLab — Tarjeta de estilo ES (v2)

Ámbito: todos los textos que ve la usuaria en español — etiquetas de
`apps/web/src`, cargas útiles ES del backend (`assumptions`, `trace`,
`pending_items`, etiqueta de ámbito) y la plantilla
`apps/api/bidlab/services/templates/report.html.jinja`.
Los mensajes de error de la API (`ApiError`, errores de dominio) son hoy
cadenas de protocolo en inglés; esta tarjeta no propone traducir el contrato,
sino traducir en el frontal (ver «Patrón de mensajes de error»).

Autoridad: [la guía de voz](voice-guide-es.md) manda. Esta tarjeta aplica
sus reglas a textos concretos y localiza cada cambio. Ante cualquier
discrepancia, la guía gana y esta tarjeta se corrige.

Novedades de la v2 (revisión de producto, lenguaje claro): tuteo total
(también en cargas del backend), frases de un dato y veinte palabras
como máximo, títulos como preguntas del usuario, glosario nuevo
(rebaja, Presupuesto de salida, oferta sospechosamente baja) y
formateadores canónicos. La entrada de precios acepta coma y punto.

## Decisiones clave

1. **Tuteo (`tú`) en todas las capas, sin excepción.** La UI ya tutea
   («Carga el ejemplo», «La decisión la tomas tú», «tus supuestos»).
   La v1 permitía un backend impersonal; la v2 lo elimina: las cargas ES
   del backend (`assumptions`, `pending_items`, trazas) hablan de tú
   («Te falta revisar…», «Tus puntos están sin determinar»). El único
   `usted` («Use formato 1234.56») era una errata y desaparece con la
   nueva entrada de precios (ver decisión 6 y C1).
2. **Una frase, un dato, veinte palabras.** Verbo activo, caja de frase,
   sin exclamaciones. («BidLab conserva tu escenario», no
   «el escenario es conservado».)
3. **Los títulos son preguntas del usuario.** «¿Cuánto oferto?»,
   «¿Puedo presentarme?», «¿Mi oferta parece sospechosa?».
4. **Los códigos de protocolo se traducen en el frontal, no en la API.**
   Patrón ya existente y a extender: `LIMITATION_ES` en `SummaryTab.tsx`,
   `reasonEs` / `anomalyEs` / `branchEs` / `variableEs` en
   `pricing/sources.ts`. La etiqueta ES va primero; el código crudo queda
   en la sección «Identificadores y códigos» o en `title`.
5. **`unknown` → «sin determinar», `unsupported` → «no soportada/o».**
   Nunca se muestra `unknown` suelto. Donde el backend lo incrusta en una
   frase ES (`scenarios.py`, `evaluation.py`), se corrige en origen porque
   esa frase ya es ES de contrato.
6. **Formato es-ES para mostrar, coma o punto para introducir.**
   Mostrar `1.234,56 €` con los formateadores canónicos de
   `apps/web/src/lib/format.ts` (ningún otro archivo formatea números).
   Los campos de precio aceptan coma y punto mediante `parsePrecioInput`
   y piden teclado decimal (`PRECIO_INPUT_MODE`); el mensaje ya no exige
   «punto decimal».

## Reglas de voz

- **Clara antes que ingeniosa.** Un dato por frase; verbo activo.
- **Específica antes que vaga.** «Rebaja máxima 40 %» no «rebaja limitada»;
  «Página 12 no disponible en las citas de ejemplo» no «error de página».
- **Honesta antes que tranquilizadora.** Lo no calculado se nombra:
  «sin determinar», «por verificar», «supuesto que declaras tú».
  Nunca se rellena un hueco con un número («los demás puntos no se
  calculan en esta versión»).
- **Sin jerga de plataforma.** `backend`, `semilla`, `curada`, `snapshot`,
  `endpoint`, `parse`, `workspace`, hashes e identificadores `cit-*` no
  salen a la UI. `scope` → «ámbito»; la copia técnica es «copia guardada»
  solo cuando hace falta nombrarla.
- **Sin anglicismos de dominio.** `scoring` → «puntos»;
  `Pricing Lab` → pantalla «¿Cuánto oferto?» (pestaña corta «Precio»);
  `template` → «fórmula»; `policy` → «regla aplicada»; `branch` → «caso».
- **Lenguaje del cliente.** La usuaria habla de licitaciones, pliegos,
  rebajas y ofertas (ver glosario). Los códigos (`n3_trimmed`,
  `review_status`, `match_status`, `proportional_inverse`) se traducen a
  palabras o se relegan a identificadores; `proportional_inverse` nunca
  se muestra.
- **Sin marcas de IA.** Nada de «no es X, es Y», listas de negaciones,
  preguntas auto-respondidas ni «en el vertiginoso mundo actual».
  Una página, un momento con gracia como mucho (el tagline
  «De un pliego a una decisión de oferta» ya lo es).

## Glosario (nuevo, resumen; la tabla completa vive en la guía de voz)

| Dices | No dices |
|---|---|
| Presupuesto de salida sin IGIC | PBL neto |
| Presupuesto de salida con IGIC | PBL bruto, bruto (a secas) |
| rebaja | baja, descuento (en UI) |
| oferta sospechosamente baja (+ nota legal, primer uso) | presunción de anormalidad, anormalidad, baja temeraria |
| coste de ejemplo / empresa de ejemplo | coste sintético, empresa sintética |
| pliego (primera mención: pliego de condiciones, PCAP) | PCAP (solo), documento (solo) |
| fórmula / fórmula de puntos | plantilla, template, regla de precio |
| puntos («46,4 de 49») | puntuación, scoring, nota |
| cita (con texto y página) | extracto, evidencia, quote, cit-* |
| te falta / por verificar | pendiente, warning, todo |
| supuesto (valor que declaras tú) | estimación, predicción |
| detalle del cálculo | traza, trace |
| ejemplo (Ejemplo Tías) | semilla, curada, Demo curada (en UI) |
| (no se muestra) | snapshot, backend, hash, endpoint, parse, workspace |

## Patrón de mensajes de error

Estructura: **qué pasó (ES) + qué haces (ES) + código (técnico)**.

```text
No pudimos evaluar tu oferta. Comprueba que la aplicación local responde.
(código: basis_not_approved)
```

Reglas:

1. El frontal traduce los códigos frecuentes con un mapa `ERROR_ES`
   (nuevo, en `apps/web/src/lib/` o `api/client.ts`), siguiendo el patrón
   de `LIMITATION_ES`. Mínimo a cubrir: `basis_not_approved`,
   `rule_not_approved`, `stale_revision`, `revision_conflict`,
   `discount_out_of_scope`, `curve_out_of_scope`, `scope_not_found`,
   `company_not_found`, `document_bytes_unavailable`, `budget_exhausted`,
   `job_not_found`, `unknown_claim_key`, `requirements_tree_corrupt`,
   `money_unparseable`, `forbidden` (+ genérico `http_N`).
2. Los cinco puntos que hoy interpolan `${code}: ${message}` crudo
   (`WorkspacePage`, `LibraryPage`, `PricingLab` ×2, `ReportTab` ×3)
   pasan por ese mapa; el mensaje inglés original queda en `title`
   o en detalles, nunca como texto principal.
3. Cada error ofrece una acción en imperativo de tú: reintentar, cargar
   el ejemplo, revisar la regla, comprobar que la aplicación local está
   en marcha. Sin acción posible, decirlo («No has enviado ningún
   documento todavía») en vez de callar.
4. Siempre `tú`, también en textos del backend (decisión 1). Nada de
   `usted` ni de impersonal mezclado.

## Notas de formato

- Titulares: `formatEurosHeadline` (`118.336 €`, 0 decimales).
- Tablas y detalle: `formatEurosExact` (`118.336,00 €`).
- Puntos: `formatPoints(valor, máximo)` (`46,4 de 49`).
- Rebajas y márgenes: `formatPercent` (`5,0 %`).
- Fechas: `formatFechaNormal` (`25 de noviembre de 2026, 23:59`; nunca
  ISO crudo en UI; la plantilla de informe usa el mismo formato).
- Entrada de precios: `parsePrecioInput` (coma y punto) con
  `inputMode={PRECIO_INPUT_MODE}`.
- Heredados (`formatEUR`, `formatRate`, `formatDateTime`, `formatPoints`
  de un argumento) siguen vivos hasta que fases laterales migren sus
  llamadas; el código nuevo usa solo los canónicos.
- Códigos, hashes e ids: en `<code>`, truncados con `title` completo,
  y solo dentro de «Identificadores y códigos».
- Estados `*_status` y `reason_codes` crudos no se muestran; van por
  `reasonEs`/`anomalyEs`/mapa equivalente o a «Identificadores y códigos».

## Apéndice: textos concretos a cambiar

Leyenda: `archivo:línea` — actual → propuesto _(motivo)_.
Todos los propuestos hablan de tú (decisión 1) y usan el glosario nuevo.

### A. Backend — cargas ES (`assumptions`, `trace`, `pending_items`)

| # | Ubicación | Actual → propuesto |
|---|---|---|
| A1 | `apps/api/bidlab/services/evaluation.py:187` | «Conjunto incompleto: puntuación unknown» → «Tu conjunto está incompleto: tus puntos están sin determinar» _(tú + anglicismo)_ |
| A2 | `apps/api/bidlab/services/evaluation.py:192` | «…anormalidad unknown» → «…no sabemos si tu oferta parece sospechosa» _(tú + glosario)_ |
| A3 | `apps/api/bidlab/services/evaluation.py:237` | «Sin coste computable: beneficio y margen unknown» → «Sin coste computable: tu beneficio y tu margen están sin determinar» _(tú + anglicismo)_ |
| A4 | `apps/api/bidlab/services/evaluation.py:261` | expresión `template {id} sobre {precio}` → `fórmula {id} sobre {precio}` _(glosario)_ |
| A5 | `apps/api/bidlab/services/evaluation.py:266` | expresión `policy {id} branch {rama}` → `regla aplicada {id}, caso {rama o «sin determinar»}` _(glosario + unknown)_ |
| A6 | `apps/api/bidlab/services/scenarios.py:50` | «Requisito manual pendiente: {label}» → «Te falta revisar a mano: {label}» _(tú + accionable)_ |
| A7 | `apps/api/bidlab/services/scenarios.py:69` | «Puntuación unknown ({r}): no usar para decidir» → «Tus puntos están sin determinar ({r}): no decidas con este dato» _(tú + anglicismo)_ |
| A8 | `apps/api/bidlab/services/scenarios.py:71` | «Puntuación unsupported: …» → «Fórmula no soportada: tu fórmula queda fuera del rango autorizado» _(tú + glosario)_ |
| A9 | `apps/api/bidlab/services/scenarios.py:76` | «Anormalidad unknown ({r}): …» → «No sabemos si tu oferta parece sospechosa ({r}): tu conjunto es insuficiente» _(tú + glosario)_ |
| A10 | `apps/api/bidlab/services/scenarios.py:78` | «Anormalidad posible: …» → «Tu oferta parece sospechosa: prepara la justificación de tus costes» _(tú + glosario)_ |
| A11 | `apps/api/bidlab/services/scenarios.py:96` | «…verificado por extractos» → «…verificado solo por citas» _(glosario + precisión honesta)_ |
| A12 | `apps/api/bidlab/services/scenarios.py:174` | «…sustituir por real» → «…sustituir por tu coste real» _(tú + elipsis)_ |

### B. Plantilla de informe (`report.html.jinja`)

| # | Ubicación | Actual → propuesto |
|---|---|---|
| B1 | línea 33 | `value or status` (muestra `unknown` crudo) → mapa ES `{"unknown": "sin determinar", "unsupported": "no soportada"}` _(anglicismo)_ |
| B2 | línea 40 | «Traza de cálculo» → «Detalle del cálculo» _(glosario)_ |
| B3 | línea 44 | `step.value or "unknown"` → `or "sin determinar"` _(anglicismo)_ |
| B4 | línea 68 | `· {{ cit.match_status }}` crudo → mapa ES (`exact` → «literal», etc.) _(código crudo)_ |
| B5 | línea 75 | «snapshot … · motor … · generado …» → «Copia guardada … · motor … · generado …» _(snapshot no se muestra)_ |

### C. Frontal — tratamiento, anglicismos y jerga

| # | Ubicación | Actual → propuesto |
|---|---|---|
| C1 | `apps/web/src/lib/validation.ts:11` | «Use formato 1234.56…» → «Escribe tu precio con coma o punto (ejemplo: 118.336,50)» con `parsePrecioInput` + `PRECIO_INPUT_MODE` _(`usted` → `tú`; coma aceptada)_ |
| C2 | `apps/web/src/lib/validation.ts:18` | «La baja máxima en P0 es 40 %» → «Tu rebaja máxima es 40 %» _(tú + glosario + jerga P0)_ |
| C3 | `WorkspacePage.tsx:16` | pestaña «Pricing Lab» → pantalla «¿Cuánto oferto?» (pestaña corta «Precio») _(título pregunta)_ |
| C4 | `WorkspacePage.tsx:50` | «Cargando espacio de trabajo…» → «Cargando tu licitación…» _(tú + jerga)_ |
| C5 | `WorkspacePage.tsx:63,86` | «← Volver a la biblioteca» / «← Biblioteca» → unificar en «← Biblioteca» _(consistencia)_ |
| C6 | `WorkspacePage.tsx:99-100` | «no localizado» / «Bruto» → «No localizado» / «con IGIC» _(caja de frase + glosario)_ |
| C7 | `LibraryPage.tsx:66` | `title` «…falta el endpoint de creación…» → «No disponible en esta versión: aún no puedes añadir pliegos» _(tú + jerga)_ |
| C8 | `SummaryTab.tsx:64` | «(los otros puntos no se inventan)» → «(los demás puntos no se calculan en esta versión)» _(registro)_ |
| C9 | `SummaryTab.tsx:68` | «Fecha del snapshot» → «Fecha de la copia guardada» _(glosario)_ |
| C10 | `PricingLab.tsx:231` | «no tiene scope o regla de precio» → «no tiene ámbito ni fórmula de puntos» _(glosario)_ |
| C11 | `PricingLab.tsx:238-239` | «Regla {id} en estado {review_status}… No se evalúa.» → estado por mapa (Revisado/Bloqueado/Pendiente) + «No puedes simular hasta su revisión.» _(tú + código crudo)_ |
| C12 | `PricingLab.tsx:300` | «Sin determinar ({status})» → «Sin determinar» (el código queda en «Identificadores y códigos») _(duplicado)_ |
| C13 | `PricingLab.tsx:441` | `"unknown"` → `"sin determinar"` _(anglicismo)_ |
| C14 | `PricingLab.tsx:495,583` | «puntuación unknown» (×2) → «puntos sin determinar» _(glosario + anglicismo)_ |
| C15 | `PricingLab.tsx:593,609,627` | «anormalidad unknown» (×3) → «oferta sospechosa sin determinar» _(glosario + anglicismo)_ |
| C16 | `PricingLab.tsx:604` | «Puntuación unknown» → «Puntos sin determinar» _(glosario + anglicismo)_ |
| C17 | `PricingLab.tsx:675` | «Referencias unknown:» → «Referencias sin determinar:» _(anglicismo)_ |
| C18 | `PricingLab.tsx:714-715` | «El scoring conserva…» → «Tus puntos conservan todas las ofertas que declaras.» _(tú + glosario)_ |
| C19 | `PricingLab.tsx:788` | «Scope» → «Ámbito» _(glosario)_ |
| C20 | `PricingLab.tsx:312,338` | «(PCAP p. 10)» / «(PCAP p. 20)» fijos → derivar de las citas o quitar el nº de página _(dato fijo)_ |
| C21 | `sources.ts:24,31-32,35` | razones con «unknown» (×4) → «…sin determinar» _(anglicismo)_ |
| C22 | `sources.ts:55,75,88` | «sin rama (unknown)» / «sin determinar (unknown)» (×2) → «sin caso aplicable» / «sin determinar» _(glosario + duplicado)_ |
| C23 | `sources.ts:102` | «…en este workspace» → «…en tu licitación» _(tú + anglicismo)_ |
| C24 | `RequirementsTab.tsx:22` | «Por verificar · unknown» → «Por verificar» _(duplicado)_ |
| C25 | `RequirementsTab.tsx:144` | «Resultado empresa» → «Resultado de tu empresa» _(tú + gramática)_ |
| C26 | `RequirementsTab.tsx:157` | umbral «manual» → «revisión manual» _(código crudo)_ |
| C27 | `RequirementsTab.tsx:165` | `reason_codes.join(", ")` crudos → pasar por `reasonEs` _(código crudo)_ |
| C28 | `RequirementsTab.tsx:197-199` | «Los grupos OR/AND se pliegan con lógica trivaluada en el backend.» → «Los grupos Y/O se combinan: cumples, no cumples o te falta verificar.» _(tú + jerga)_ |
| C29 | `EvidenceTab.tsx:22` | «derechos {code} · parse {code}» → «derechos: {ES} · lectura: {ES}» con mapa _(código crudo + anglicismo)_ |
| C30 | `EvidenceTab.tsx:52` | `{match_status}` crudo → mapa ES _(código crudo)_ |
| C31 | `EvidenceDrawer.tsx:94` | «Cita ({match_status})» → «Cita ({ES})» con el mismo mapa _(código crudo)_ |
| C32 | `EvidenceDrawer.tsx:170` | mensaje inglés crudo del backend → mapa: «el PDF original no se redistribuye; usa la fuente oficial y las citas» _(tú + idioma)_ |
| C33 | `ReportTab.tsx:271,310` | sección «Construir informe» + botón «Exportar informe» → sección «Nuevo informe» + botón «Exportar informe» _(doblete)_ |
| C34 | `ReportTab.tsx:237` | «Guárdalos desde el Pricing Lab…» → «Guárdalos desde ¿Cuánto oferto?…» _(acoplado a C3)_ |
| C35 | `CurveChart.tsx:71` | «(tabla, {n} filas del backend)» → «(tabla, {n} puntos)» _(jerga)_ |
| C36 | `CurveChart.tsx:95` | «Sin determinar ({status})» → «Sin determinar» _(duplicado)_ |

### D. Frontal — errores crudos de la API (pasan por el mapa `ERROR_ES`)

| # | Ubicación | Actual → propuesto |
|---|---|---|
| D1 | `WorkspacePage.tsx:57-58` | `${code}: ${message}` inglés → `errorEs(err)` + código en `title` |
| D2 | `LibraryPage.tsx:28` | idem (sesión demo) |
| D3 | `PricingLab.tsx:181,211` | idem (evaluar, guardar) |
| D4 | `ReportTab.tsx:118,127,225` | idem (descargar, previsualizar, exportar) |

Total: 12 (A) + 5 (B) + 36 (C) + 4 (D) = **57 cambios propuestos** en
13 archivos. Prioridad 1: C1 (usted + coma), C13–C17 + A1–A3 + A7–A9
(`unknown` visible), D1–D4 (errores en inglés), C29–C32 (códigos crudos
en Evidencia). Las llamadas a formateadores migran en fases laterales;
esta fase solo añade los canónicos.
