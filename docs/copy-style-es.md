# BidLab — Tarjeta de estilo ES

Ámbito: todos los textos que ve la usuaria en español — etiquetas de
`apps/web/src`, cargas útiles ES del backend (`assumptions`, `trace`,
`pending_items`, etiqueta de ámbito) y la plantilla
`apps/api/bidlab/services/templates/report.html.jinja`.
Los mensajes de error de la API (`ApiError`, errores de dominio) son hoy
cadenas de protocolo en inglés; esta tarjeta no propone traducir el contrato,
sino traducir en el frontal (ver «Patrón de mensajes de error»).

Diagnóstico (skill copywriting, situación B): el producto ya tiene voz —
honesta, nominal, «no se inventa nada» — y decide bien casi todo. Esta tarjeta
fija esa voz por escrito y corrige solo fugas: un `usted` suelto, `unknown` /
`scope` / `scoring` sin traducir, y errores ingleses mostrados tal cual.

## Decisiones clave

1. **Tuteo (`tú`), nunca `usted`.** La UI ya tutea de forma consistente
   («Carga el ejemplo», «Comprueba que la API…», «Selecciona un escenario»,
   «La decisión la tomas tú», «tus supuestos»). El único `usted`
   («Use formato 1234.56») es una errata: pasa a «Usa el formato…».
2. **Backend impersonal, sin tratamiento.** Las cargas ES del backend
   (`assumptions`, `pending_items`, etiquetas de traza) usan estilo nominal
   o infinitivo («Puntuación sin determinar», «No usar para decidir»),
   nunca segunda persona. Sin cambios de arquitectura.
3. **Los códigos de protocolo se traducen en el frontal, no en la API.**
   Patrón ya existente y a extender: `LIMITATION_ES` en `SummaryTab.tsx`,
   `reasonEs` / `anomalyEs` / `branchEs` / `variableEs` en
   `pricing/sources.ts`. La etiqueta ES va primero; el código crudo queda
   en la sección «Identificadores y códigos» o en `title`.
4. **`unknown` → «sin determinar», `unsupported` → «no soportada/o».**
   Nunca se muestra `unknown` suelto. Donde el backend lo incrusta en una
   frase ES (`scenarios.py`, `evaluation.py`), se corrige en origen porque
   esa frase ya es ES de contrato.
5. **Caja de frase (sentence case).** «No localizado», «Precio neto»,
   «Bruto» pasa a «bruto» a mitad de frase. Sin exclamaciones.
6. **Formato es-ES para mostrar, protocolo para introducir.** Mostrar
   `1.234,56 €` (`toLocaleString("es-ES")`, ya usado); los campos de entrada
   siguen pidiendo `1234.56` y lo dicen explícitamente.

## Reglas de voz

- **Clara antes que ingeniosa.** Una idea por frase; verbo activo
  («BidLab conserva el escenario» no «el escenario es conservado»).
- **Específica antes que vaga.** «Baja máxima 40 %» no «baja limitada»;
  «Página 12 no disponible en los extractos curados» no «error de página».
- **Honesta antes que tranquilizadora.** Lo no calculado se nombra:
  «sin determinar», «por verificar», «hipótesis declarada».
  Nunca se rellena un hueco con un número («los demás puntos no se
  calculan en esta versión»).
- **Sin jerga de plataforma.** `backend` → «el servidor» (o nada);
  `scope` → «ámbito»; `snapshot` → «instantánea» (el hash puede citarse
  como «instantánea (snapshot)» la primera vez); `endpoint`, `parse`,
  `filas del backend`, `P0`, `workspace` no salen a la UI.
- **Sin anglicismos de dominio.** `scoring` → «puntuación»;
  `Pricing Lab` → «Precio» (pestaña); `template` → «plantilla»;
  `policy/branch` en trazas → «política/rama».
- **Lenguaje del cliente.** La usuaria habla de licitaciones, pliegos,
  bajas y ofertas (ver glosario). Los códigos (`n3_trimmed`,
  `review_status`, `match_status`) se traducen o se relegan a
  identificadores.
- **Sin marcas de IA.** Nada de «no es X, es Y», listas de negaciones,
  preguntas auto-respondidas ni «en el vertiginoso mundo actual».
  Una página, un momento con gracia como mucho (el tagline
  «De un pliego a una decisión de oferta» ya lo es).

## Glosario de términos de licitación

| Término ES | Significado | No decir |
|---|---|---|
| licitación | el procedimiento completo (`tender`) | concurso (salvo cita literal), workspace |
| lote / ámbito | cada parte simulable (`scope`; `__whole__` = contrato completo) | scope |
| pliego (PCAP/PCP) | los documentos rectores | documento (solo), endpoint |
| requisito | condición de elegibilidad (`requirements_tree`, hojas) | criterio (para elegibilidad) |
| criterio de puntuación | cada criterio que da puntos | requisito (para puntos) |
| regla de precio | fórmula + máximos + política (`pricing_rule`) | scoring rule, endpoint |
| plantilla | AST autorizado de fórmula (`template_id`) | template |
| oferta | cada propuesta económica (propia, rival, hipótesis A/B) | bid, propuesta (para rivales) |
| baja | descuento sobre PBL neto (`discount_rate`) | descuento (en UI; en API vale) |
| PBL neto / bruto | presupuesto base de licitación sin/con IVA | presupuesto (a secas, si ambigua) |
| puntuación / puntos | resultado de aplicar la regla (`score`) | scoring, nota |
| anormalidad | presunción de oferta anormal (`anomaly`) | baja temeraria (término antiguo) |
| escenario | conjunto de hipótesis guardado (`scenario`) | simulación (para lo guardado) |
| informe | registro de decisión sobre un escenario (`report`) | reporte |
| cita / evidencia / extracto | `citation` verificada contra el texto | quote, excerpt |
| supuesto / hipótesis | valor declarado, no observado (`assumptions`, rivales) | estimación, predicción |
| pendiente | lo que falta antes de decidir (`pending_items`) | warning, todo |
| empresa sintética | empresa demo con costes ficticios (`synthetic`) | empresa falsa, mock |
| revisión | versión aprobada de regla/empresa (`revision`) | versión (para reglas) |
| instantánea (snapshot) | hash del anuncio o escenario | snapshot (solo, en UI) |
| huella | hash sha256 de fuente | hash (en UI) |

## Patrón de mensajes de error

Estructura: **qué pasó (ES) + qué hacer (ES) + código (técnico)**.

```text
No se pudo evaluar la elegibilidad. Reintenta cuando la API local responda.
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
3. Cada error ofrece una acción: reintentar, cargar el ejemplo, revisar
   la regla, comprobar que la API local está en marcha. Sin acción posible,
   decirlo («No se ha enviado ningún documento») en vez de callar.
4. Impersonal o `tú` imperativo («Reintenta», «Selecciona»), coherente
   con la decisión 1. Nada de `usted`.

## Notas de formato

- Moneda: `formatEUR` / `formatSignedEUR` (es-ES, `€` detrás).
- Tasas y descuentos: `formatRate` (`5 %`, con espacio fino si el
  formateador lo da; nunca `5%` pegado en texto nuevo).
- Puntos: `formatPoints` (`12,50 / 20`).
- Fechas: `formatDateTime` (nunca ISO crudo en UI; la plantilla de informe
  debe formatear `created_at` o aceptar el ISO como sello técnico).
- Códigos, hashes e ids: en `<code>`, truncados con `title` completo.
- Estados `*_status` y `reason_codes` crudos no se muestran; van por
  `reasonEs`/`anomalyEs`/mapa equivalente o a «Identificadores y códigos».

## Apéndice: textos concretos a cambiar

Leyenda: `archivo:línea` — actual → propuesto _(motivo)_.

### A. Backend — cargas ES (`assumptions`, `trace`, `pending_items`)

| # | Ubicación | Actual → propuesto |
|---|---|---|
| A1 | `apps/api/bidlab/services/evaluation.py:187` | «Conjunto incompleto: puntuación unknown» → «Conjunto incompleto: puntuación sin determinar» _(anglicismo)_ |
| A2 | `apps/api/bidlab/services/evaluation.py:192` | «…anormalidad unknown» → «…anormalidad sin determinar» _(anglicismo)_ |
| A3 | `apps/api/bidlab/services/evaluation.py:237` | «Sin coste computable: beneficio y margen unknown» → «…beneficio y margen sin determinar» _(anglicismo)_ |
| A4 | `apps/api/bidlab/services/evaluation.py:261` | expresión `template {id} sobre {precio}` → `plantilla {id} sobre {precio}` _(glosario)_ |
| A5 | `apps/api/bidlab/services/evaluation.py:266` | expresión `policy {id} branch {rama}` → `política {id}, rama {rama o «sin determinar»}` _(glosario + unknown)_ |
| A6 | `apps/api/bidlab/services/scenarios.py:50` | «Requisito manual pendiente: {label}» → «Pendiente de revisión manual: {label}» _(accionable)_ |
| A7 | `apps/api/bidlab/services/scenarios.py:69` | «Puntuación unknown ({r}): no usar para decidir» → «Puntuación sin determinar ({r}): no usar para decidir» _(anglicismo)_ |
| A8 | `apps/api/bidlab/services/scenarios.py:71` | «Puntuación unsupported: …» → «Puntuación no soportada: plantilla fuera del rango autorizado» _(anglicismo)_ |
| A9 | `apps/api/bidlab/services/scenarios.py:76` | «Anormalidad unknown ({r}): …» → «Anormalidad sin determinar ({r}): conjunto insuficiente» _(anglicismo)_ |
| A10 | `apps/api/bidlab/services/scenarios.py:78` | «Anormalidad posible: …» → «Posible anormalidad: preparar justificación de costes» _(orden natural)_ |
| A11 | `apps/api/bidlab/services/scenarios.py:96` | «…verificado por extractos» → «…verificado solo por extractos» _(precisión honesta)_ |
| A12 | `apps/api/bidlab/services/scenarios.py:174` | «…sustituir por real» → «…sustituir por el coste real» _(elipsis)_ |

### B. Plantilla de informe (`report.html.jinja`)

| # | Ubicación | Actual → propuesto |
|---|---|---|
| B1 | línea 33 | `value or status` (muestra `unknown` crudo) → mapa ES `{"unknown": "sin determinar", "unsupported": "no soportada"}` _(anglicismo)_ |
| B2 | línea 40 | «Traza de cálculo» → «Detalle del cálculo» _(jerga; `trace` queda en código)_ |
| B3 | línea 44 | `step.value or "unknown"` → `or "sin determinar"` _(anglicismo)_ |
| B4 | línea 68 | `· {{ cit.match_status }}` crudo → mapa ES (`exact` → «literal», etc.) _(código crudo)_ |
| B5 | línea 75 | «snapshot … · motor … · generado …» → «Instantánea (snapshot) … · motor … · generado …» _(glosario)_ |

### C. Frontal — tratamiento, anglicismos y jerga

| # | Ubicación | Actual → propuesto |
|---|---|---|
| C1 | `apps/web/src/lib/validation.ts:11` | «Use formato 1234.56…» → «Usa el formato 1234.56 (punto decimal, dos decimales)» _(`usted` → `tú`)_ |
| C2 | `apps/web/src/lib/validation.ts:18` | «La baja máxima en P0 es 40 %» → «La baja máxima es 40 %» _(jerga P0)_ |
| C3 | `WorkspacePage.tsx:16` | pestaña «Pricing Lab» → «Precio» _(anglicismo)_ |
| C4 | `WorkspacePage.tsx:50` | «Cargando espacio de trabajo…» → «Cargando la licitación…» _(jerga)_ |
| C5 | `WorkspacePage.tsx:63,86` | «← Volver a la biblioteca» / «← Biblioteca» → unificar en «← Biblioteca» _(consistencia)_ |
| C6 | `WorkspacePage.tsx:99-100` | «no localizado» / «Bruto» → «No localizado» / «bruto» _(caja de frase)_ |
| C7 | `LibraryPage.tsx:66` | `title` «…falta el endpoint de creación…» → «No disponible en esta versión: aún no se pueden añadir pliegos» _(jerga)_ |
| C8 | `SummaryTab.tsx:64` | «(los otros puntos no se inventan)» → «(los demás puntos no se calculan en esta versión)» _(registro)_ |
| C9 | `SummaryTab.tsx:68` | «Fecha del snapshot» → «Fecha de la instantánea» _(glosario)_ |
| C10 | `PricingLab.tsx:231` | «no tiene scope o regla de precio» → «no tiene ámbito ni regla de precio» _(anglicismo)_ |
| C11 | `PricingLab.tsx:238-239` | «Regla {id} en estado {review_status}… No se evalúa.» → estado por mapa (Revisado/Bloqueado/Pendiente) + «No se puede simular hasta su revisión.» _(código crudo + voz)_ |
| C12 | `PricingLab.tsx:300` | «Sin determinar ({status})» → «Sin determinar» (el código queda en «Identificadores y códigos») _(duplicado)_ |
| C13 | `PricingLab.tsx:441` | `"unknown"` → `"sin determinar"` _(anglicismo)_ |
| C14 | `PricingLab.tsx:495,583` | «puntuación unknown» (×2) → «puntuación sin determinar» _(anglicismo)_ |
| C15 | `PricingLab.tsx:593,609,627` | «anormalidad unknown» (×3) → «anormalidad sin determinar» _(anglicismo)_ |
| C16 | `PricingLab.tsx:604` | «Puntuación unknown» → «Puntuación sin determinar» _(anglicismo)_ |
| C17 | `PricingLab.tsx:675` | «Referencias unknown:» → «Referencias sin determinar:» _(anglicismo)_ |
| C18 | `PricingLab.tsx:714-715` | «El scoring conserva…» → «La puntuación conserva todas las ofertas declaradas.» _(anglicismo)_ |
| C19 | `PricingLab.tsx:788` | «Scope» → «Ámbito» _(glosario)_ |
| C20 | `PricingLab.tsx:312,338` | «(PCAP p. 10)» / «(PCAP p. 20)» fijos → derivar de las citas o quitar el nº de página _(dato fijo)_ |
| C21 | `sources.ts:24,31-32,35` | razones con «unknown» (×4) → «…sin determinar» _(anglicismo)_ |
| C22 | `sources.ts:55,75,88` | «sin rama (unknown)» / «sin determinar (unknown)» (×2) → «sin rama aplicable» / «sin determinar» _(duplicado)_ |
| C23 | `sources.ts:102` | «…en este workspace» → «…en esta licitación» _(anglicismo)_ |
| C24 | `RequirementsTab.tsx:22` | «Por verificar · unknown» → «Por verificar» _(duplicado)_ |
| C25 | `RequirementsTab.tsx:144` | «Resultado empresa» → «Resultado de la empresa» _(gramática)_ |
| C26 | `RequirementsTab.tsx:157` | umbral «manual» → «revisión manual» _(código crudo)_ |
| C27 | `RequirementsTab.tsx:165` | `reason_codes.join(", ")` crudos → pasar por `reasonEs` _(código crudo)_ |
| C28 | `RequirementsTab.tsx:197-199` | «Los grupos OR/AND se pliegan con lógica trivaluada en el backend.» → «Los grupos Y/O se combinan en el servidor: cumple, no cumple o por verificar.» _(jerga)_ |
| C29 | `EvidenceTab.tsx:22` | «derechos {code} · parse {code}» → «derechos: {ES} · lectura: {ES}» con mapa _(código crudo + anglicismo)_ |
| C30 | `EvidenceTab.tsx:52` | `{match_status}` crudo → mapa ES _(código crudo)_ |
| C31 | `EvidenceDrawer.tsx:94` | «Cita ({match_status})» → «Cita ({ES})» con el mismo mapa _(código crudo)_ |
| C32 | `EvidenceDrawer.tsx:170` | mensaje inglés crudo del backend → mapa: «el PDF original no se redistribuye; usa la fuente oficial y los extractos curados» _(idioma + accionable)_ |
| C33 | `ReportTab.tsx:271,310` | sección «Construir informe» + botón «Exportar informe» → sección «Nuevo informe» + botón «Exportar informe» _(doblete)_ |
| C34 | `ReportTab.tsx:237` | «Guárdalos desde el Pricing Lab…» → «Guárdalos desde la pestaña Precio…» _(acoplado a C3)_ |
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
13 archivos. Prioridad 1: C1 (usted), C13–C17 + A1–A3 + A7–A9 (`unknown`
visible), D1–D4 (errores en inglés), C29–C32 (códigos crudos en Evidencia).
