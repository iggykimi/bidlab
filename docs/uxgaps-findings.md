READ-ONLY audit done. No files edited. Persona: 70 years old, first online tender. Voice follows the lead decision in `docs/ux-review.md` §4 (tuteo).

# UX gaps audit — Requisitos, Informe, Evidencia, Library, mobile, empty/error/loading

## Screenshot evidence gaps (read first)
- `test-results/qa-desktop-requisitos.png` and `qa-mobile-requisitos.png` show the **Resumen** tab, not Requisitos (capture raced the tab transition; same artifact class the external review notes in §2/§9). There is **no valid Requisitos capture** — those findings are code+fixture verified.
- `test-results/qa-mobile-informe.png` shows **Evidencia** content (same race). No valid Informe-mobile capture.
- No Library capture and no error/empty-state captures exist. Recommend 4 added captures (Library, Requisitos desktop, Informe-mobile settled, one API-down Library).

## BLOCKS (senior cannot finish the flow)

**B1 — Informe: disabled «Exportar informe» with zero explanation; guidance path is dead code.**
`apps/web/src/features/report/ReportTab.tsx:319-326` (disabled when `!selectedScenario`), `:218` (error text unreachable because the button is disabled). Ref: `qa-desktop-informe.png` (button at/below fold, no hint).
Fix: keep the button always enabled AND add helper text. Exact text under the button when `!selectedScenario`: `Primero abre un escenario guardado de la lista de arriba.` (Confirms external review §3: "Si desactivado, di por qué".)

**B2 — Mobile: the action column is cut off-screen with no scroll cue (both tables).**
`apps/web/src/features/evidence/EvidenceTab.tsx:40-41` (`min-w-[560px]`, «Abrir» last at `:63-71`) and `apps/web/src/features/requirements/RequirementsTab.tsx:139-140` (`min-w-[640px]`, evidence chips last at `:183-200`). Ref: `qa-mobile-evidencia.png` (only Cita+Página visible; Coincidencia/Abrir hidden), `qa-mobile-informe.png` (same table).
Fix (minimal): move the action column to second position and add a hint line above the table: `Desliza a la derecha para ver más →`. Better: render `<ul>` cards instead of `<table>` under `sm:`.

**B3 — Library error state: jargon + no recovery action.**
`apps/web/src/features/library/LibraryPage.tsx:93-97`. Ref: none (state never captured).
Fix: exact replacement text `No se pudo cargar la biblioteca. Comprueba que el programa está en marcha y pulsa Reintentar.` + add `<Button onClick={() => tendersQuery.refetch()}>Reintentar</Button>`.

**B4 — Requisitos without session: dead-end text, no button.**
`apps/web/src/features/requirements/RequirementsTab.tsx:109-115`. Ref: none (state never captured).
Fix: exact text `Para comprobar los requisitos, primero abre el ejemplo.` + `<Link to="/">Ir a la biblioteca</Link>` button.

## COMPREHENSION (jargon / English / IDs / answers no user question)

**C1 — Requirements table shows RAW ENGLISH reason codes.** None of the 15 eligibility codes from `apps/api/bidlab/services/eligibility.py:33-44,107-194` (`value_meets_threshold`, `manual_review_required`, …) exist in `REASON_ES`, so `reasonEs()` passes them through. Rendered at `RequirementsTab.tsx:173-177` (`apps/web/src/features/pricing/sources.ts:40-59`). Ref: no valid capture (see note).
Fix: add mappings. Exact strings: `value_meets_threshold`→`tu cifra alcanza lo exigido`; `value_below_threshold`→`tu cifra está por debajo de lo exigido`; `value_above_threshold`→`tu cifra supera el máximo permitido`; `value_differs`→`tu dato no coincide con lo exigido`; `text_found`→`dato localizado`; `text_not_found`→`dato no localizado`; `rule_not_approved`→`aún sin revisar`; `manual_review_required`→`hay que comprobarlo a mano`; `missing_company_evidence`→`tu empresa no aportó este dato`; `evidence_not_reviewed`→`dato de tu empresa aún sin revisar`; `unit_mismatch`→`las unidades no coinciden`; `insufficient_period`→`el periodo acreditado es demasiado corto`; `missing_threshold`→`falta el valor exigido`; `threshold_unparseable`→`el valor exigido no se pudo leer`; `value_unparseable`→`el dato de tu empresa no se pudo leer`.

**C2 — Threshold shown as raw protocol `295840.00 EUR`.** `RequirementsTab.tsx:165-168`; data `fixtures/demo/interpretation.json:218,229,259`. Violates the format canon (`format.ts`).
Fix: `{leaf.threshold ? formatEUR(leaf.threshold) : "Hay que comprobarlo a mano"}` (drop the `unit` suffix; `formatEUR` adds €).

**C3 — «Umbral» header + English `OR` inside Grupo values.** `RequirementsTab.tsx:143-145`; data `interpretation.json:209` (`Solvencia económica: OR de tres medios (p.5-6)`).
Fix headers: `Requisito`→`Lo que te piden`, `Grupo`→`Apartado`, `Umbral`→`Cuánto te piden`, `Resultado de la empresa`→`Tu empresa`, `Evidencia`→`Dónde lo pone el pliego`. Values: `groupLabel.replace(/\bOR\b/, "o").replace(/\bAND\b/, "y")` (or fix in seed).

**C4 — «elegibilidad» heading, `empresa sintética (hipótesis)`, `API local` errors.** `RequirementsTab.tsx:119` (heading), `:130-137` (summary), `:121-124` (loading `revisión de empresa`), `:125-129` (error).
Fix: heading → `Requisitos: ¿puede tu empresa presentarse?`; summary → `Resultado general: Cumple. Se han podido comprobar 3 de los 5 requisitos (datos de ejemplo de una empresa ficticia).`; loading → `Comprobando si tu empresa cumple los requisitos…`; error → `No se pudo comprobar si tu empresa cumple los requisitos. Comprueba tu conexión e inténtalo de nuevo.` + Reintentar button (refetch both queries).

**C5 — Footnote about `Y/O` + `servidor`, set at 12px.** `RequirementsTab.tsx:207-210`.
Fix: `Este resultado solo cuenta los requisitos ya comprobados. Cuando basta con cumplir una de varias opciones, con una es suficiente.` + bump to `text-sm`.

**C6 — Evidence chips `p. 6` + aria leaks raw ID; `Sin citas vinculadas`.** `RequirementsTab.tsx:189-197`, `:185`. (Aria change touches `/p\. 6: ver evidencia/` in 5 spec files: e01, e11, e12, qa-visual, t23-t24.)
Fix: visible `Ver pág. 6`, aria `Ver en el pliego, página 6`; empty → `Sin página del pliego localizada`.

**C7 — Citation column is English snake_case IDs (`cit-turnover_threshold`, …).** `EvidenceTab.tsx:58-60` (ids built as `cit-{key}` in `seed.py:212`). Ref: `qa-desktop-evidencia.png`, `qa-mobile-evidencia.png`.
Fix: `CITATION_ES` map (adopt external review §3): turnover→`Volumen de negocio exigido`, insurance→`Seguro exigido`, technical_services→`Experiencia exigida en servicios técnicos`, estimated_value→`Valor estimado del contrato`, pbl_gross→`Presupuesto con IGIC`, initial_duration_months→`Duración inicial`, price_points→`Puntos por precio`, anomaly_single/two_discount_gt→`Cuándo una oferta se considera sospechosa`. Header `Cita`→`Dato respaldado`.

**C8 — Document card: English `display_name`, raw `pcap`, `derechos/lectura` jargon, full SHA.** `EvidenceTab.tsx:22-27` (data `seed.py:160-167`). Ref: `qa-desktop-evidencia.png`.
Fix: title `Pliego de condiciones (PCAP) de Tías`; line `41 páginas · Pliego de condiciones`; move kind/rights/parse/SHA into `<details><summary>Detalles técnicos</summary>`.

**C9 — `Citas verificadas`, `Coincidencia: literal`, bare `Abrir`.** `EvidenceTab.tsx:39,44-47,63-70`.
Fix: subtitle under heading — `Cada cifra enlaza con la página del pliego donde aparece.`; `Coincidencia`→`Texto`, `literal`→`Idéntico al pliego`, `normalizada`→`Equivalente`, `ausente`→`No encontrada`, `visual manual`→`Revisada a mano`; button → `Ver página {n}`; aria `Ver el fragmento del pliego, página {n}` (drop `c.id`).

**C10 — Drawer: `Evidencia documental`, `Cita (literal)`, SHA-256 block, `extracto curado`, `Extractor curated-excerpts-1`, `no se redistribuye`.** `EvidenceDrawer.tsx:136,144,161-169,195,207-210,229-237`. Ref: `qa-desktop-drawer.png`, `qa-mobile-drawer.png`.
Fix: title → `Lo que dice el pliego`; `Cita (…)` → `Fragmento (idéntico al pliego)`; SHA + Extractor lines → `<details>Detalles técnicos</details>`; section → `Texto de la página`; availability → `El PDF original no se puede descargar desde aquí; consúltalo en la web oficial o usa los extractos de esta página.`; aria-label → `Evidencia del pliego, página {n}` (drop `citation.id`).

**C11 — Informe scenario detail: `Regla proportional_inverse rev. … motor …` + 64-char Snapshot + `Fuentes` with raw IDs.** `ReportTab.tsx:72-78,95-104`. Ref: none (empty-state capture only).
Fix: tech lines + Snapshot → `<details><summary>Detalles técnicos</summary>` (keep `data-testid="scenario-hash"` inside; E07 asserts it); Fuentes items → `Página {n} del pliego · {texto idéntico|texto equivalente}`; drop `c.id`.

**C12 — Pending items embed raw English codes in parentheses.** `ReportTab.tsx:88-94,158-164` rendering backend strings (`scenarios.py:74,81`: `Puntuación sin determinar (incomplete_rival_set)…`, `Anormalidad sin determinar (group_membership_unconfirmed)…`).
Fix: run each string through a frontend mapper replacing known codes via `reasonEs` (extend map: `incomplete_rival_set`→`faltan ofertas rivales para calcularla`; `group_membership_unconfirmed`→`sin confirmar si hay empresas del mismo grupo`). Headings `Pendientes (N)` (both) → `Lo que te falta por comprobar (N)`.

**C13 — `Hipótesis` list is jargon (`Conjunto rival sin calificar`, `Coste de empresa sintética`, …).** `ReportTab.tsx:79-86`; strings from `evaluation.py:181-239`.
Fix: `ASSUMPTION_ES` map. Exact: `Precios rivales hipotéticos`→`Precios de rivales inventados por ti para probar`; `Conjunto rival sin calificar`→`Rivales de prueba, sin comprobar`; `Conjunto completo supuesto`→`Das por hecho que estos son todos los rivales`; `Grupos independientes supuestos`→`Das por hecho que ningún rival es del mismo grupo`; `Pertenencia a grupos sin confirmar: anormalidad sin determinar`→`Sin confirmar grupos: aún no se sabe si tu oferta parece sospechosa`; `Coste de empresa sintética`→`Coste inventado para practicar (90.000 €)`; `Sin coste computable: beneficio y margen sin determinar`→`Sin tu coste real no se puede calcular el beneficio`.

**C14 — Saved lists unexplained + raw ID fragments (`a3f9c1d2…`, `Abrir informe {id8}…`).** `ReportTab.tsx:243,265-266,349`.
Fix: subtitle `Cada escenario es un precio que guardaste para comparar.`; buttons → `Abrir escenario «{name||"Sin nombre"}»` + keep `Guardado {date}`; reports → `Abrir informe del {date}` + `(Exp. {external_id})`. Drop `<code>{id.slice(0,8)}…</code>`.

**C15 — `Decisión manual`, `Exportar informe`, `Descargar HTML`, `Vista previa del HTML`.** `ReportTab.tsx:292,325,167-172`. Ref: `qa-desktop-informe.png`.
Fix: `Tu decisión`; `Crear el informe`; `Descargar el informe`; `Ver cómo queda`. (Do NOT promise PDF — the download is `.html`; review §3's "Descargar en PDF" doesn't match reality.)

**C16 — Library: `Cargar ejemplo`, dead `Añadir pliego` (title-tooltip only), CPV search, `PBL neto… Estado observado PUB`.** `LibraryPage.tsx:60-69,80-86,111-116`. Ref: none. (E01 locks `demo-load` testid + `118.336` text, not the label.)
Fix: button → `Empezar con el ejemplo`; visible note under buttons — `De momento solo puedes practicar con el ejemplo.` (replace `title`); search label → `Buscar por título o número de expediente`, placeholder → `Por ejemplo: Tías o 2026/00006554N`; row line → `Presupuesto: 118.336,00 € · Estado: publicada`; first-use `Expediente` instead of `Exp.`.

**C17 — Shared chrome over all audited tabs: `PBL neto…bruto`, demo banner (`semilla…sintéticos`), `Evidencia` tab.** `WorkspacePage.tsx:121-124,129-134`, TABS `:18-24`. Ref: all captures.
Fix: `Presupuesto (sin IGIC) X · (con IGIC) Y`; banner → `Demostración con datos de ejemplo revisados el 25/10/2026. Los precios de rivales y tu coste son inventados para practicar.`; tab `Evidencia`→`Documentos` (test impact: only `qa-visual.spec.ts:66,168` + `helpers.ts:50` type reference the tab name).

**C18 — Bare `Anormalidad` + `Sin presunción bajo estos supuestos`.** `ReportTab.tsx:67-70`, `sources.ts:90-101`.
Fix (align review §3): label → `¿Oferta sospechosamente baja?`; values → `posible_…`=`Sí, quizá tengas que justificar tu precio`; `not_flagged…`=`No, con estos datos`; `not_applicable`=`No aplica`; default=`Aún sin comprobar`.

## POLISH

**P1 — Scenario/report select buttons can be <44px (single line, no savedAt).** `ReportTab.tsx:260-263,344-347`. Fix: add `min-h-[44px]`.
**P2 — Inline links are ~20px targets.** `EvidenceTab.tsx:29`, `EvidenceDrawer.tsx:220-227,232-236`. Fix: append `inline-flex min-h-[44px] items-center`.
**P3 — 12px on must-read text.** `RequirementsTab.tsx:207` (fixed by C5), `:174` (fixed by C1), `EvidenceTab.tsx:23-27` (fixed by C8), `ReportTab.tsx:268,351` (savedAt — bump to `text-sm`).
**P4 — Double loading announcement.** `WorkspacePage.tsx:72-77` (`<p>` + Skeleton with same label). Fix: drop the `<p>`.
**P5 — Tab `<title>` jargon.** `apps/web/index.html:11` (`…decisión de oferta trazable`). Fix: `BidLab — Del pliego a tu decisión de oferta`.
**P6 — Report filename leaks raw UUID.** `ReportTab.tsx:123` (`bidlab-informe-${report.id}.html`). Fix: thread tender id into `ReportDetail`, filename `informe-{external_id con / → -}.html` (e.g. `informe-2026-00006554N.html`).
**P7 — Terse empties.** `EvidenceTab.tsx:18` → `Aún no hay documentos en esta licitación.`; `:51-56` → `Aún no hay fragmentos del pliego vinculados a las cifras.`
**P8 — Report load errors lack a next step.** `ReportTab.tsx:278-282,359-364` (`No se pudo cargar el escenario/el informe.`). Fix: append `Vuelve a intentarlo; si sigue fallando, guarda el escenario de nuevo en la pestaña Precio.`

## ALREADY GOOD (do not touch)
- **Touch sizes:** all `Button` variants incl. `chip` are `min-h/w-44px` (`ui.tsx:8-17`); tabs `min-h-[44px]` (`WorkspacePage.tsx:153`); decision radios `min-h-[44px]` labels (`ReportTab.tsx:295`); range thumb 44px (`styles.css:168-170`).
- **Contrast:** computed exact ratios — primary/white 5.9, muted/white 9.55, error/white 6.57, alert/white 5.43, white/primary 5.9, warn-ink/warn-bg 6.83. All pass WCAG AA. (Review's 7:1 is a stricter phase-4 aspiration, not a failure.)
- **Drawer a11y:** focus trap + Escape + focus return + `aria-modal` (`EvidenceDrawer.tsx:72-107`); e2e-verified (`qa-visual.spec.ts:77-97`). Full-width on mobile. (Ghosting/`Cerrar` cut in captures = mid-transition artifacts, not defects.)
- **Copy already plain:** `La decisión la tomas tú; el informe conserva…` (`ReportTab.tsx:289`); empty Informe guidance (`:244-248`); `ErrorBoundary` card (`ErrorBoundary.tsx:29-44`); error pattern ES-main + raw-code-in-`title` (`errors.ts`, used consistently); `Toast` success line (`ReportTab.tsx:231`); `Página X de 41` (`EvidenceDrawer.tsx:146`); skip links, `lang="es"`, `viewport-fit`, `Skeleton` role=status + reduced-motion-safe (`Skeleton.tsx`, `styles.css:148-165`).
- **No page-level horizontal overflow** on desktop+mobile per T30/e11 guards; tabs wrap 3+2 on 390px (visible in `qa-mobile-resumen.png`); internal table scroll is contained (`overflow-x-auto`).
- **No formulas/English in thresholds' labels** — leaf labels (`interpretation.json:215,226,256`) are decent Spanish; `company_field` codes are never rendered.