Inventory complete. READ-ONLY: no file was created, edited, or committed. All paths relative to `C:\Users\zrano\Documents\Meta Hackathon`. Suggestions follow tú / ≤20 words.

# Jargon inventory — BidLab user-visible strings

## A. Frontend `apps/web/src/**`

| file:line | current string | cat. | suggested plain-ES replacement |
|---|---|---|---|
| WorkspacePage.tsx:90 | tooltip = `tender_not_found: unknown tender tias` (errorCode) | IDs+EN | Oculta el código; muestra solo el mensaje español. |
| WorkspacePage.tsx:118 | `Exp. 2026/00006554N` | ABBR | `Expediente 2026/00006554N` |
| WorkspacePage.tsx:122 | `PBL neto 118.336,00 €` | ABBR | `Presupuesto sin impuestos 118.336,00 €` |
| WorkspacePage.tsx:123 | `bruto 126.619,52 €` | TEC | `con impuestos 126.619,52 €` |
| WorkspacePage.tsx:131 | `cifras de semilla revisada del 25/10/2026` | TEC | `cifras revisadas del 25/10/2026` |
| WorkspacePage.tsx:132 | `el coste de empresa son sintéticos` | TEC | `y el coste de empresa es inventado para la demo` |
| SummaryTab.tsx:12 | `las cifras proceden de la semilla revisada` | TEC | `las cifras son revisadas, no automáticas` |
| SummaryTab.tsx:13 | `requiere modo live y clave de modelo` | EN | `necesita el modo en vivo y tu clave` |
| SummaryTab.tsx:19 | passthrough `?? code` (unknown limitation codes raw) | IDs+EN | Muestra `Aviso sin traducir` en vez del código. |
| SummaryTab.tsx:30 | `Meta no está configurado… (falta modo live…)` | EN+ABBR | `El análisis en vivo no está listo en tu equipo.` |
| SummaryTab.tsx:31 | `revisión manual del PCAP` | ABBR | `revisión manual del pliego de cláusulas` |
| SummaryTab.tsx:30-32 | `Puedes seguir…` (tú) + `No se ha enviado…` (impersonal) | MIX | `…No enviaremos ningún documento ni simularemos nada.` |
| SummaryTab.tsx:37-38 | `en esta versión del frontal` | TEC | `en esta versión de la aplicación` |
| SummaryTab.tsx:74 | `Estado observado: PUB` (status_raw) | IDs | `Estado: publicada` |
| SummaryTab.tsx:77-78 | `CPV: 79411000, 71356200` | ABBR | `Actividad (CPV): 79411000, 71356200` |
| SummaryTab.tsx:81-82 | `Límite (literal): 2026-11-25 23:59:00; Hora peninsular` | ISO | `Límite: 25 de noviembre de 2026, 23:59` |
| SummaryTab.tsx:91 | `Snapshot c15cf714…b0da` (64 hex) | EN+HASH | `Copia del anuncio oficial (verificada)` |
| SummaryTab.tsx:95 | `Calidad: demo_source_snapshot_not_live`, `semantic_review_pending_for_application` | IDs+EN | `Origen: copia revisada`, `Revisión de uso pendiente` |
| SummaryTab.tsx:102 | `Aviso: document doc-tias-pcap: original bytes not redistributed…` (+2 status-mapping warnings) | EN+IDs | `Aviso: el PDF no se comparte; solo verás extractos.` |
| SummaryTab.tsx:116 | `proportional_inverse · 49 puntos · revisión 1` | IDs | `Reparto inverso · 49 puntos · revisión 1` |
| SummaryTab.tsx:129 | `Anormalidad: tias_18_5 (revisada)` | IDs | `Anormalidad: regla del pliego 18.5 (revisada)` |
| SummaryTab.tsx:137 | `Análisis en vivo (Meta)` | ABBR | `Análisis en vivo` |
| SummaryTab.tsx:143 | `Modo: demo` / `live` | EN | `Modo: demo` / `En vivo` |
| SummaryTab.tsx:146 | `Meta configurado: No` | ABBR | `Análisis en vivo listo: no` |
| SummaryTab.tsx:151 | `Modelo: muse-spark-1.3` | ABBR | Oculta el nombre interno del modelo. |
| RequirementsTab.tsx:127 | `No se pudo evaluar… Reintenta cuando la API local responda` | MIX+ABBR | `No pudimos evaluar. Vuelve a intentarlo enseguida.` |
| RequirementsTab.tsx:135 | `empresa sintética (hipótesis)` | TEC | `empresa inventada para la demo` |
| RequirementsTab.tsx:166-167 | `295840.00 EUR` (threshold + unit raw) | FORM+ABBR | `295.840,00 €` |
| RequirementsTab.tsx:175 | reason codes raw: `value_meets_threshold`, `text_found`, `value_below_threshold`, `missing_company_evidence`, `evidence_not_reviewed`, `unit_mismatch`, `insufficient_period`, `missing_threshold`, `threshold_unparseable`, `value_unparseable`, `manual_review_required`, `rule_not_approved`, `value_above_threshold`, `value_differs`, `text_not_found` (15 codes, no ES map) | IDs+EN | Añade mapa ES: `cumple el umbral`, `texto localizado`, etc. |
| RequirementsTab.tsx:193 | aria-label `ver evidencia cit-turnover_threshold` | IDs | `p. 5: ver evidencia` |
| RequirementsTab.tsx:208-209 | `Los grupos Y/O se combinan en el servidor` | TEC | `Los grupos se combinan solos: cumple, no cumple o por verificar.` |
| RequirementsTab.tsx:163,208 | labels/groupLabels mojibake: `TÃ­as`, `â‰¥`, `â‚¬`, `Ã³` | MOJ | Corrige la codificación a UTF-8 en el origen. |
| ReportTab.tsx:63 | `46,4000 / 49,0000` (formatPoints 1-arg, 4 dec) | DEC | `46,4 de 49` (forma de 2 argumentos) |
| ReportTab.tsx:73-74 | `Regla tias-price-r1 rev. 1 · empresa rev. 1 · motor 1.0.0` | IDs+ABBR | `Regla revisada n.º 1 · cálculo verificado` |
| ReportTab.tsx:77 | `Snapshot 9f2c…` (full 64-hex) | EN+HASH | `Copia verificada` |
| ReportTab.tsx:90-92 | pendientes renderizados tal cual, incluyen `(incomplete_rival_set)` | IDs | Filtra los códigos entre paréntesis al mostrar. |
| ReportTab.tsx:100 | `cit-price_points · p. 10 · literal` | IDs | `Evidencia p. 10 · literal` |
| ReportTab.tsx:123 | filename `bidlab-informe-{32hex}.html` | HASH | `bidlab-informe-{fecha}.html` |
| ReportTab.tsx:129,140,233 | `Reintenta cuando la API local responda` (×3) | MIX+ABBR | `Vuelve a intentarlo en unos segundos.` |
| ReportTab.tsx:168 | `Descargar HTML` | ABBR | `Descargar informe` |
| ReportTab.tsx:171 | `Vista previa del HTML` | ABBR | `Vista previa del informe` |
| ReportTab.tsx:266,349 | `a1b2c3d4…` (UUID fragments) | HASH | Muestra solo nombre y fecha. |
| ReportTab.tsx:289 | `La decisión la tomas tú` vs resto impersonal | MIX | Mantén el tuteo en todos los mensajes. |
| EvidenceTab.tsx:24 | `41 páginas · pcap · derechos…` (kind raw) | IDs | `41 páginas · pliego de cláusulas…` |
| EvidenceTab.tsx:24 | `derechos: solo investigación` | TEC | `uso: solo consulta` |
| EvidenceTab.tsx:25 | `lectura: por revisar` (parse_status) | TEC | `texto: por revisar` |
| EvidenceTab.tsx:27 | `SHA c74d0632…9677` (64 hex) | HASH+ABBR | `Copia verificada` |
| EvidenceTab.tsx:60 | celda `cit-pbl_gross` etc. | IDs | `Evidencia 1`, `Evidencia 2`… |
| EvidenceTab.tsx:67 | aria-label `Abrir evidencia cit-…, página 8` | IDs | `Abrir evidencia, página 8` |
| EvidenceDrawer.tsx:136 | aria-label `Evidencia cit-…` | IDs | `Evidencia, página 8` |
| EvidenceDrawer.tsx:158 | `PCAP Tías (research copy; bytes not redistributed)` | EN+ABBR | `Pliego de cláusulas de Tías (copia de consulta)` |
| EvidenceDrawer.tsx:158 | fallback `doc-tias-pcap` | IDs | `Documento del pliego` |
| EvidenceDrawer.tsx:167-168 | `SHA-256 del documento` + hash 64 hex | HASH | `Documento verificado` |
| EvidenceDrawer.tsx:195,200 | `(extracto curado)` / `extractos curados` | TEC | `(copia revisada)` / `copia revisada` |
| EvidenceDrawer.tsx:208 | `Extractor curated-excerpts-1` | IDs | `Texto revisado para la demo` |
| EvidenceDrawer.tsx:209 | `curated_excerpt_only` | IDs | Oculta la etiqueta interna. |
| EvidenceDrawer.tsx:231 | `no se redistribuye; usa la fuente oficial…` | MIX+TEC | `no podemos compartirlo; usa la fuente oficial…` |
| PricingLab.tsx:32 | `no tiene ámbito ni regla de precio` | TEC | `no tiene apartado ni regla para simular` |
| PricingLab.tsx:40 | `Regla tias-price-r1 en estado Pendiente` | IDs | `La regla de precio está pendiente.` |
| CurveChart.tsx:37,39,58,81 | `puntos del backend` / `calculados por el backend` (×4) | EN | `calculados automáticamente` |
| CurveChart.tsx:46 | tooltip `maximumFractionDigits: 4` → `46,4000` | DEC | Un decimal: `46,4` |
| CurveChart.tsx:56 | `coste sintético de la empresa demo` | TEC | `coste inventado para la demo` |
| CurveChart.tsx:99 | `formatPoints` 1-arg → `46,4000` | DEC | Un decimal: `46,4` |
| CurveSection.tsx:36 | `Curva del backend con rivales fijos` | EN+TEC | `Curva calculada con los rivales que supones` |
| CurveSection.tsx:56 | `Pasos de cálculo devueltos por el backend…` | EN | `Pasos del cálculo: precio, puntos, anormalidad y margen` |
| CurveSection.tsx:62 | header `Expresión` | TEC | `Operación` |
| CurveSection.tsx:71 | `118336.00*(1-0.050000000000)`, `min(…)`, `plantilla proportional_inverse sobre…`, `política tias-18-5, rama n3_trimmed`, `(112419.20-90000.00)/112419.20` | FORM+DEC+IDs | `118.336,00 € × (1 − 5 %)`, `la menor oferta`, etc. |
| CurveSection.tsx:74 | `sin determinar` (minúscula; resto `Sin determinar`) | OTRO | `Sin determinar` |
| CurveSection.tsx:76 | bloque raw duplica valor: `0.199425009251` (12 dec) | DEC | Elimina el duplicado crudo. |
| CurveSection.tsx:84-85 | `Regla tias-price-r1 rev. 1 · motor 1.0.0 · empresa rev. 1` | IDs | `Regla revisada n.º 1 · cálculo verificado` |
| CurveSection.tsx:93 | `El backend no devolvió huellas de fuente.` | EN | `No hay huellas de fuente.` |
| CurveSection.tsx:99 | `c15cf7144811345e…` + title=hash completo | HASH | Muestra solo el nombre del documento. |
| CurveSection.tsx:100 | `snapshot Atom del anuncio` | EN+ABBR | `copia del anuncio oficial` |
| HypothesesForm.tsx:18 | `Baja propia sobre PBL neto` | ABBR | `Tu baja sobre el presupuesto sin impuestos` |
| HypothesesForm.tsx:54 | `Límites de interfaz (0–40 %)` | TEC | `Puedes simular bajas de 0 a 40 %.` |
| HypothesesForm.tsx:61 | `Petición n.º 12` | TEC | Oculta el contador interno. |
| HypothesesForm.tsx:66 | `title={rawError}` = `code: english message` | IDs+EN | Oculta el código crudo. |
| HypothesesForm.tsx:94,120 | `precio neto (€, formato 1234.56)` (×2) | FORM | `precio neto en € (como 1234,56)` |
| HypothesesForm.tsx:156,164 | `Calificación del conjunto` / `Sin calificar` | TEC | `Estado del conjunto` / `Sin suponer` |
| HypothesesForm.tsx:209 | `pero el backend responde unknown: …` | EN+IDs | `pero faltan datos: …` |
| HypothesesForm.tsx:229-230 | `No se infiere ninguna distribución de rivales.` | TEC+MIX | `No adivinamos los rivales: usamos tus precios.` |
| HypothesesForm.tsx:256-257 | `Hipótesis A · 106502.40 € · grupo…` (dot decimal) | FORM | `Hipótesis A · 106.502,40 €…` |
| HypothesesForm.tsx:268 | `Mínimos por grupo (responde el backend)` | EN | `Mínimos por grupo` |
| HypothesesForm.tsx:302-303 | `tres licitadores… (n3_trimmed)` | IDs | Quita el código entre paréntesis. |
| HypothesesForm.tsx:310-311 | `El backend usa… (LCSP 149.3)… no son dos observaciones independientes.` | EN+ABBR+TEC | `Cuenta la oferta menor de cada grupo (Contratos 149.3).` |
| KpiSection.tsx:40 | `Fuente: PBL neto 118.336,00 €` | ABBR | `Fuente: presupuesto sin impuestos…` |
| KpiSection.tsx:50 | `Fuente oficial (Atom)` | ABBR | `Fuente oficial` |
| KpiSection.tsx:67 | `(empresa sintética)` | TEC | `(empresa inventada para la demo)` |
| KpiSection.tsx:70-72 | `(hipótesis declarada, sin cita documental)` | TEC | `(dato inventado, sin documento que lo respalde)` |
| KpiSection.tsx:81 | `46,4000 / 49,0000` | DEC | `46,4 de 49` |
| KpiSection.tsx:95 | `Fuente: regla proportional_inverse · 49 puntos…` | IDs | `Fuente: regla de reparto inverso…` |
| KpiSection.tsx:110-111 | `tias-18-5 · …` (policy_id) | IDs | Quita el identificador interno. |
| KpiSection.tsx:119 | `…rama n3_trimmed` | IDs | Quita el código; basta la etiqueta. |
| KpiSection.tsx:123 | `Fuente: política tias_18_5…` | IDs | `Fuente: política del pliego…` |
| SaveScenarioSection.tsx:40 | `Aviso: document doc-tias-pcap: original bytes…` | EN | `Aviso: el PDF no se comparte; solo extractos.` |
| SaveScenarioSection.tsx:61 | heading `Comparar escenarios` (acción real: guardar) | OTRO | `Guardar escenario` |
| SaveScenarioSection.tsx:82 | `title={saveRawError}` | IDs+EN | Oculta el código crudo. |
| SaveScenarioSection.tsx:88 | `Guardado: 9f2c1a…` (hash16) | HASH | `Guardado: {nombre} · {fecha}` |
| SaveScenarioSection.tsx:111,116,122 | `tias-whole`, `tias-price-r1 rev. 1 (approved)`, `company-demo rev. 1` | IDs+EN | `Apartado único`, `regla n.º 1 (aprobada)`, `empresa demo` |
| SaveScenarioSection.tsx:130-144 | `Puntos (código): unknown · incomplete_rival_set`, `Anormalidad (código): unknown · n3_trimmed · …` | IDs+EN | `Puntos: sin determinar…`, `Anormalidad: sin determinar…` |
| SourceCitations.tsx:27-28 | aria-label/title `ver evidencia cit-…` | IDs | `p. 10: ver evidencia` |
| sources.ts:35 | `maximumFractionDigits: 12` → `0,199425009251` | DEC | Máximo 2 decimales (1 en puntos y %) |
| sources.ts:57,72,85,111,123,135 | 6× passthrough `?? code` (reason/branch/variable/match/rights/parse) | IDs | Cubre todos los códigos; fallback `sin determinar`. |
| sources.ts:145 | `snapshot Atom del anuncio` | EN+ABBR | `copia del anuncio oficial` |
| usePricingState.ts:199,231 | `Reintenta cuando la API local responda` (×2) | MIX+ABBR | `Vuelve a intentarlo en unos segundos.` |
| usePricingState.ts:222 | `Faltan identificadores para guardar…` | TEC | `Faltan datos para guardar (sesión, regla o empresa).` |
| LibraryPage.tsx:33,95 | `Reintenta… API local` / `Comprueba que la API local está en marcha` | MIX+ABBR | `Vuelve a intentarlo en unos segundos.` |
| LibraryPage.tsx:72,94 | `title={demoRawError}` / `title={errorCode}` | IDs+EN | Oculta el código crudo. |
| LibraryPage.tsx:80 | `Buscar por título, expediente o CPV` | ABBR | `…o código de actividad (CPV)` |
| LibraryPage.tsx:112 | `Exp. … · CPV 79411000, …` | ABBR | `Expediente … · Actividad …` |
| LibraryPage.tsx:115 | `PBL neto … · Estado observado PUB` | ABBR+IDs | `Presupuesto sin impuestos… · Estado: publicada` |
| lib/format.ts:22-24,84 | `points4` legacy → `46,4000` (3 call sites) | DEC | Migra los 3 sitios a `46,4 de 49`. |
| lib/errors.ts:9 | `…Pide su revisión antes de simular.` (impers.+tú, `base de precio`) | MIX+TEC | `El presupuesto no está revisado. Pide que lo revisen.` |
| lib/errors.ts:13-14 | `…Ajusta el valor/valores.` (impers.+tú) | MIX | `La baja sale del rango 0–40 %. Cambia el valor.` |
| lib/errors.ts:15 | `No se encontró el ámbito… Recarga la página.` | MIX+TEC | `No encontramos el apartado. Recarga la página.` |
| lib/errors.ts:16 | `No se encontró la empresa demo. Vuelve a cargar…` | MIX | `Perdimos la empresa demo. Carga el ejemplo de nuevo.` |
| lib/errors.ts:17-18 | `no se redistribuye; usa… extractos curados` | MIX+TEC | `no podemos compartir el PDF. Usa la copia revisada.` |
| lib/errors.ts:20 | `No se encontró el trabajo de análisis. Inténtalo…` | MIX+TEC | `No encontramos ese análisis. Inténtalo de nuevo.` |
| lib/errors.ts:21 | `…en la interpretación. Pide una revisión.` | MIX+TEC | `Hay un dato sin localizar. Pide que lo revisen.` |
| lib/errors.ts:22 | `El árbol de requisitos está dañado. Pide…` | MIX+TEC | `La lista de requisitos está dañada. Pide que la revisen.` |
| lib/errors.ts:23 | `no tiene el formato 1234.56. Corrige…` | MIX+FORM | `no es válido (usa 1234,56). Corrige el valor.` |
| lib/errors.ts:25,28 | `Reintenta cuando la API local responda` (×2) | MIX+ABBR | `Vuelve a intentarlo en unos segundos.` |
| lib/errors.ts:36 | `La API devolvió un error (código 500). …` | ABBR+IDs | `Hubo un error temporal. …` |
| lib/errors.ts:44 | `errorCode()` = `code: english message` (8 tooltip sites) | IDs+EN | No expongas el código en la interfaz. |
| lib/validation.ts:11 | `Usa el formato 1234.56 (punto decimal, dos decimales)` | FORM | `Escribe dos decimales (como 1234,56).` |
| ErrorBoundary.tsx:32 | `title={error.message}` (raw EN exception) | EN | Oculta el mensaje técnico. |
| ErrorBoundary.tsx:34-35 | `La vista se interrumpió… todo sigue en tu equipo.` | MIX+TEC | `Algo falló aquí. Tus datos siguen en tu equipo.` |
| api/client.ts:53,96 | `La API devolvió ${status} / una respuesta inesperada` (tooltips) | ABBR | `Hubo un error temporal.` |

## B. Report template `apps/api/bidlab/services/templates/report.html.jinja`

| file:line | current string | cat. | suggested plain-ES replacement |
|---|---|---|---|
| :25 | badge `{{ decision }}` → `study` / `prepare` / `discard` | EN | `Seguir estudiando` / `Preparar oferta` / `Descartar` |
| :26 | `{{ created_at }}` → `2026-10-27T01:23:45.123+00:00` | ISO | `27 de octubre de 2026, 01:23` |
| :31-33 | `118336.00 €`, `90000.00 €`, `22419.20 €` (dot, no thousands) | FORM | `118.336,00 €`, `90.000,00 €`, `22.419,20 €` |
| :34 | `0.199425009251` (12 dec, dot) | DEC | `19,9 %` |
| :35 | `46.938775510204` (raw, dot) or raw status passthrough | DEC+IDs | `46,4 de 49` / `Sin determinar` |
| :36 | `possible_justification_required` / `not_flagged_under_assumptions` passthrough | IDs+EN | `Posible justificación` / `Sin presunción` |
| :46 | `118336.00*(1-0.050000000000)`, `min(…)`, `plantilla proportional_inverse…`, values `46.938775510204` | FORM+DEC+IDs | `118.336,00 € × (1 − 5 %)`, `la menor oferta`, `46,94` |
| :46 | `or "sin determinar"` (lowercase) | OTRO | `Sin determinar` |
| :70 | `Documento doc-tias-pcap, página 8` | IDs | `Pliego de Tías, página 8` |
| :77 | `Instantánea (snapshot) c15c… · motor 1.0.0 · generado 2026-10-27T…` | EN+HASH+ISO | `Copia verificada · generado el 27 de octubre de 2026` |

## C. Backend payload strings

### C1. assumptions / trace (evaluation.py) — mostly ES, flagged items:

| file:line | current string | cat. | suggested plain-ES replacement |
|---|---|---|---|
| evaluation.py:185 | `Conjunto rival sin calificar` | TEC | `Conjunto rival sin suponer` |
| evaluation.py:189 | `Conjunto incompleto: puntuación sin determinar` | OTRO | `Conjunto incompleto: puntos sin determinar` |
| evaluation.py:237 | `Coste de empresa sintética` | TEC | `Coste inventado para la demo` |
| evaluation.py:239 | `Sin coste computable: beneficio y margen sin determinar` | TEC | `Sin coste conocido: beneficio y margen sin determinar` |
| evaluation.py:262 | trace label `Puntuación económica` (vs `Puntos` elsewhere) | OTRO | `Puntos de precio` |
| evaluation.py:253,258,263,268,277 | trace expressions (formulas §A CurveSection:71) | FORM+DEC | Operaciones en palabras con ≤2 decimales. |

### C2. pending_items (scenarios.py):

| file:line | current string | cat. | suggested plain-ES replacement |
|---|---|---|---|
| :74 | `Puntuación sin determinar (incomplete_rival_set): no usar para decidir` | IDs+MIX+OTRO | `Puntos sin determinar: no decidas con este dato.` |
| :76 | `Puntuación no soportada: plantilla fuera del rango autorizado` | TEC+OTRO | `Puntos no calculables: fórmula fuera de rango.` |
| :81 | `Anormalidad sin determinar (group_membership_unconfirmed): conjunto insuficiente` | IDs | `Anormalidad sin determinar: faltan ofertas.` |
| :83 | `Posible anormalidad: preparar justificación de costes` (infinitive) | MIX | `Posible anormalidad: prepara la justificación.` |
| :101 | `PDF original no redistribuido: verificado solo por extractos` | TEC | `PDF no disponible: verificado solo con extractos.` |
| :180 | `Coste de empresa sintética: sustituir por el coste real` (infinitive) | MIX+TEC | `Coste inventado: sustitúyelo por tu coste real.` |

### C3. workspace warnings / capabilities / seed (shown in UI §A):

| file:line | current string | cat. | suggested plain-ES replacement |
|---|---|---|---|
| workspace.py:88,96 | `document doc-tias-pcap: unmapped rights_status '…' / parse_status '…'` | EN+IDs | `El documento trae un estado nuevo; lo marcamos por revisar.` |
| workspace.py:91-93,99-101 | `document …: internal status 'research_copy_pending_publication_review' served as 'research_only'` (×2) | EN+IDs | No muestres el mapeo interno; omite el aviso. |
| workspace.py:103-104 | `document doc-tias-pcap: original bytes not redistributed; metadata and excerpts only` | EN | `El PDF no se comparte; solo verás extractos.` |
| workspace.py:201 | `no interpretation yet for this tender` | EN | `Esta licitación aún no tiene análisis.` |
| capabilities.py:23,25 | `curated_demo: figures come from the reviewed seed…`, `meta_live_unavailable: needs mode=live…` | EN | `Demo revisada: cifras comprobadas…`, `En vivo apagado: …` |
| seed.py:163 | `PCAP Tías (research copy; bytes not redistributed)` | EN+ABBR | `Pliego de cláusulas de Tías (copia de consulta)` |
| seed.py:166-167,184,196 | `research_copy_pending_publication_review`, `metadata_only_curated_excerpts`, `curated-excerpts-1`, `curated_excerpt_only` | IDs | Códigos internos: no los muestres. |
| fixtures/demo/tender.json | `quality_flags: ["demo_source_snapshot_not_live", "semantic_review_pending_for_application"]`, `status_raw: "PUB"`, `deadline_literal: "2026-11-25 23:59:00; …"` | IDs+EN+ISO | `Origen revisado`, `Revisión pendiente`, `Publicada`, fecha normal |
| fixtures/demo/interpretation.json | title/labels/excerpts mojibake (`TÃ­as`, `â‰¥`, `â‚¬`, `Ã³`) — rendered in H1, table, drawer | MOJ | Recodifica los fixtures a UTF-8. |

### C4. errors.py envelope messages:

| file:line | current string | cat. | suggested plain-ES replacement |
|---|---|---|---|
| errors.py:91-92 | code `http_404` + `Not Found` (Starlette EN detail) | EN+IDs | `No encontrado` |
| errors.py:101 | details `body.discount_rate: Input should be a valid…` (pydantic EN) | EN | `Revisa los datos enviados.` |
| errors.py:106 | `request validation failed` | EN | `Los datos enviados no son válidos.` |
| errors.py:111-114 | domain `str(exc)` passthrough (all §C6 messages) | EN | Traduce cada código de dominio al español. |
| errors.py:135 | `internal error` | EN | `Error interno. Inténtalo de nuevo.` |

### C5. ApiError call sites (72 sites, all EN; shown to API users + UI tooltips):

| file:lines | current messages | cat. | suggested plain-ES replacement |
|---|---|---|---|
| deps.py:35,38 | `missing or invalid X-BidLab-Client`; `untrusted origin` | EN+IDs | `Falta la clave local.`; `Origen no permitido.` |
| documents.py:19,47,55 | `original bytes not redistributed; use source_url and curated excerpts`; `unknown page 3 of doc-tias-pcap`; `unknown document …` | EN+IDs | `El PDF no se comparte; usa la fuente oficial.`; `Página no encontrada.`; `Documento no encontrado.` |
| companies.py:36,56,63,104,144,147,153,157,163 | `money value invalid: …`; `unknown company …:1`; `unknown scope …`; `company … unreadable`; `unknown company …` (×2); `company … has no revision` (×2); `company …:1 is not latest (2)` | EN+IDs | `Importe no válido.`; `No encontramos la empresa.`; `…el apartado.`; `Dato de empresa ilegible.`; `…` |
| demo.py:26 | `demo seed missing; run python scripts/demo.py --reset-demo` | EN+TEC | `Falta el ejemplo. Regenera la demo local.` |
| eligibility.py:118,206,210,220,225,233,236,238,243,250,283 | `leaf …: bad field/operator`; `requirements tree exceeds depth 10`; `requirements node is not an object`; `requirements group malformed`; `unknown requirements kind '…'`; `unknown tender …`; `unknown scope …`; `scope … is not in …`; `company is scoped to …`; `unknown interpretation …:1`; `eligibility result invalid` | EN+IDs | `Requisito dañado.`; `Lista de requisitos muy profunda.`; `…`; `No encontramos la licitación.`; etc. |
| evaluation.py:30,33,35,42,44,51 | `unknown scope …`; `scope …: basis not approved`; `scope …: no budget_net`; `unknown rule …:1`; `rule …:1 not approved`; `unknown company …:1` | EN+IDs | `No encontramos el apartado.`; `El presupuesto no está revisado.`; `…`; `No encontramos la regla.`; etc. |
| evaluation.py:59,63,67,69 | `rule lacks expression/template_id`; `stored expression invalid: …`; `unknown template …`; `stored AST differs from its template` | EN+IDs | `Regla dañada.`; `Fórmula guardada no válida.`; `…` |
| evaluation.py:162,341 | `discount_rate: P0 scope is 0 to 0.40`; `curve range must sit within 0 to 0.40` | EN+IDs | `La baja sale de 0–40 %.`; `La curva sale de 0–40 %.` |
| evaluation.py:146,218 | groups `str(exc)` passthrough | EN | Traduce los errores de grupo. |
| idempotency.py:34,75 | `Idempotency-Key reused with a different body` (×2) | EN | `Repetiste el envío con otros datos.` |
| jobs.py:77,122,128,133,142,151,154,326 | `unknown job …`; `live model budget exhausted`; `unknown tender …`; `live mode requires allow_remote_processing=true`; `expected interpretation revision 1, got 2`; `unknown document …`; `document … is not from this tender`; `job … is already running` | EN+IDs | `No encontramos el análisis.`; `Se acabó el presupuesto.`; `Activa el permiso remoto.`; `Recarga: los datos cambiaron.`; etc. |
| meta_adapter.py:260,267 | `MODEL_API_KEY is not set; live extraction unavailable (G3 blocked)`; `META_API_URL is not set; no verified Muse endpoint (G3 blocked)` | EN+ABBR+IDs | `Falta tu clave de modelo.`; `Falta el servicio de análisis.` |
| pdf.py:66,72,74,78,85 | `PDF is 999 bytes; limit is 20971520`; `cannot parse PDF: …`; `PDF contains no pages`; `PDF has 200 pages; limit is 120`; `page 3 unreadable: …` | EN | `El PDF pesa demasiado.`; `No pudimos leer el PDF.`; `El PDF no tiene páginas.`; etc. |
| reports.py:79,81,87,91 | `unknown report …`; `report …: invalid payload`; `unknown report …`; `report …: html not found` | EN+IDs | `No encontramos el informe.`; `Informe dañado.`; etc. |
| review.py:55,58,63,78 | `unknown tender …`; `no interpretation for …`; `expected interpretation revision 1, got 2`; `unknown claim keys: foo` | EN+IDs | `No encontramos la licitación.`; `Nada que revisar.`; `Recarga: cambió la revisión.`; etc. |
| scenarios.py:48,129,135,142,220,235 | `requirements tree exceeds depth 10`; `rule …:1 is not latest (2)`; `company …:1 is not latest (2)`; `referenced rows vanished mid-save`; `scenario …: hash mismatch`; `unknown scenario …` | EN+IDs | `Lista muy profunda.`; `La regla cambió; recarga.`; `…`; `No pudimos guardar.`; `Copia dañada.`; `…` |
| workspace.py:51 | `unknown tender …` | EN+IDs | `No encontramos la licitación.` |

### C6. Domain errors via `_from_domain` (64 sites, all EN, envelope `message`):

| file | messages (complete set) | count |
|---|---|---|
| money.py:50,52,60,64,66,68,78,93,106-108,117,122,130,141,150,160,164,189,193,201,204,208 | `…: bool is not a numeric input`; `…: float input forbidden, use str`; `…: invalid numeric string '…'` (×2); `…: unsupported numeric type`; `…: non-finite value`; `money: quantization overflow`; `decimal: quantization overflow`; `discount_rate: … outside P0 scope 0..0.40`; `budget_net: must be > 0` (×2); `price_net: must be > 0`; `…: must be > 0`; `price_net: above approved ceiling`; `cost_net: negative cost rejected` (×3); `margin_rate: non-finite result`; `margin_rate: must satisfy 0 <= m < 1`; `target_price: non-finite result`; `awarded_net: negative award rejected`; `historic_drop: non-finite result` | 21 |
| expressions.py:70,72,78,81,84,86,99,108,115,119,121,126,140,142,146,149,151,155,159,163,166,169,173,177,179,184,186,224,232,237,240,250,253,270,273,275,276,361 | `const: non-finite value`; `const: magnitude exceeds 10^12`; `…: requires exactly 2 args…`; `…: requires 2..8 args…`; `log10: requires exactly 1 arg…`; `call: unknown op '…'` (×3); `expression: cyclic reference rejected` (×2); `var: unknown name '…'` (×2); `log10: const argument must be > 0`; `log10: argument must be > 0`; `expression: unknown node type` (×2); `expression: depth exceeds 8` (×2); `expression: nodes exceed 200` (×4); `expression: node must be an object`; `const: keys must be exactly kind,value`; `const: float/bool value forbidden`; `const: value must be a decimal string`; `const: …`; `var: keys must be exactly kind,name`; `call: keys must be exactly kind,op,args`; `call: args must be an array`; `expression: unknown kind '…'`; `variable …: …`; `evaluate: no value for …`; `evaluate: operations exceed 1000`; `div(…)=unknown:zero_denominator`; `…: non-finite result`; `template: unknown id '…'` | 38 |
| scoring.py:63,66,71,93,114 | `rivals: at most 20 offers`; `own_price: must be > 0`; `rivals[0]: must be > 0`; `max_points: must be > 0`; `reference_price: must be > 0` | 5 |
| anomaly.py:71,107,110,115,118,326 | `anomaly: non-finite mean`; `own_price: must be > 0`; `base: must be > 0`; `offers[0]: must be > 0`; `offers: at least one price required`; `variant: unknown id '…'` | 6 |
| groups.py:51,72,75 | `…: must be > 0`; `own_price: must be > 0`; `…: must be > 0` | 3 |

Suggested replacement (all §C6): map each `code` to a fixed ES string with tuteo, e.g. `offer_not_positive` → `El precio debe ser mayor que cero.` (73 distinct codes → 73 map entries, each ≤20 words).

## D. Counts per category

Primary category per finding (findings with 2 cats counted once under the first):

| category | count | where |
|---|---|---|
| Untranslated English (EN) | 168 | 72 ApiError sites + 64 domain sites + 5 errors.py + 12 UI (`backend`×8, `Snapshot`×2, `live`×2, exception title, `research copy…`) + 4 template (`study…`, statuses) + 11 backend payload (warnings, limitations, seed) |
| Internal IDs / snake_case codes (IDs) | 64 | `cit-*`×8, `tias-*`/`company-demo`×10, `proportional_inverse`×3, `tias_18_5`×3, branch codes×3, `PUB`×2, quality_flags×3, `curated-*`×3, reason-code leaks + 6 passthroughs + template/jinja 4 |
| Abbreviations unexplained (ABBR) | 30 | PBL×5, CPV×4, PCAP×2, Atom×4, Meta/modelo×4, API×10 (`API local`), HTML×2, IGIC shown only inside excerpts (explained by context — OK), LCSP, `rev.`, `Exp.`, SHA, EUR, `máx.` skipped |
| Raw hashes / UUIDs (HASH) | 12 | full sha256×4 (Summary, ReportTab, EvidenceTab, EvidenceDrawer) + truncated×3 + UUID frags×3 + filename×1 + template×1 |
| Formulas / protocol formats (FORM) | 12 | trace expressions×2 blocks, `formato 1234.56`×4, dot-decimal money×3, `Umbral EUR` cell, `min(…)` |
| Excessive decimals (DEC) | 11 | 4-dec points×4 sites, 12-dec `formatProtocol`, 12-dec margin/threshold, tooltip 4-dec, raw duplicate block, template margin/score |
| ISO dates (ISO) | 4 | deadline_literal, created_at + generated_at (template), `source_updated_at` is formatted OK |
| tú / impersonal mixing (MIX) | 24 | 11× `Reintenta…` pattern, 9× errors.ts `Pide/Recarga/Ajusta…`, pending infinitives×3, EvidenceDrawer, ErrorBoundary, `tomas tú` doc-level |
| Tecnicismo ES (TEC) | 38 | `sintética`×6, `semilla`×2, `curado`×4, `backend` counted EN, `ámbito`×2, `motor`×2, `frontal`, `interfaz`, `Petición n.º`, `identificadores`, `calificar`, `distribución`, `plantilla`×2, `extractos`, `redistribuye`×2, `interpretación`, `árbol`, `vista`, `cita documental`, `servidor` skipped (plain), `Y/O`, `sin calificar` |
| Mojibake / otros (MOJ+OTRO) | 9 | mojibake×2 blocks (H1 + labels + excerpts), `Puntuación` vs `Puntos`×4, lowercase `sin determinar`×2, heading `Comparar`×1 |
| **Total findings** | **~372** | |

Notes: IGIC appears only inside pliego excerpts (`incluido IGIC` / `sin IGIC`) where context explains it — not flagged. `EUR`, `máx.`, `PDF`, `p.`, `%` treated as understood — not flagged except raw `EUR` unit code. `success` toasts and tú-only imperatives (`Carga`, `Guárdalos`, `Selecciona`) are consistent — not flagged.