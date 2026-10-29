# BidLab · Decision log V3 (issue #4)

Formato heredado de [DECISION_LOG_V2](DECISION_LOG_V2.md):
decisión + motivo + dónde se fija con tests. Detalle por tarea en
[CHANGELOG_IMPLEMENTACION_V3](CHANGELOG_IMPLEMENTACION_V3.md).

## Decisiones técnicas

- D-V3-1 Comparador: guarda de empate `ds==0 && dp==0`
  (`same_price_score`) en `compare.py`; duelo editorial solo con
  exactamente 2 pruebas (con 3 manda la tabla). Fijado por
  `apps/api/tests/unit/test_compare_verdicts.py` y
  `tests/e2e/compare.spec.ts` (duelo visible / ausente con 3).
- D-V3-2 Frontera: motivo «dominada» por dimensión (`_dominada`,
  espejo de `compare._supera`): dimensiones iguales se nombran
  como iguales, nunca como menos. El propio ejemplo del contrato
  exhibía el bug (49/49 con «menos puntos»); ejemplo corregido y
  YAML regenerado (solo ejemplo, sin cambio de schema). Fijado por
  `test_decision_frontier.py` (3 casos) y CMP-05
  («con los mismos puntos»).
- D-V3-3 Stress: `hypothesis_index` en el contrato (regen
  exact-repro: builder + datamodel-codegen 0.86.0 +
  openapi-typescript 7.13.0, diffs aditivos verificados) en vez de
  heurística posicional en el frontal. Banner «Resultado anterior»
  antes del título (bloquea Aplicar, ya lo hacía); minimapa de 3 +
  expansor; lookup por `Map` (O(1) por celda, sin cifras de
  rendimiento inventadas). Repro E2E primero (2→1, rojo), luego
  verde. Fijado por `test_stress.py` (índices, malla 729) y
  `stress.spec.ts` (7/7).
- D-V3-4 Curva: meseta por lookup sobre puntos backend (racha
  inicial 2+ en el máximo, anclada al precio menor); sin meseta,
  título neutral. «Máx» y «Equilibrio» salen del SVG a la leyenda
  HTML (precedente BL-V2-03); offsets solo de dibujo (offset 24 en
  banda alta, dx ±28 en bordes). Fijado por `curveFlags.test.ts`
  (6 casos meseta) y `curve-v3.spec.ts` (7/7: meseta/neutral,
  tooltip sin shift, teclado, 320, extremos, zoom-equivalente).
- D-V3-5 Zoom 200%: equivalencia honestada a 640 CSS px (1280 al
  200 %). Playwright no tiene API de zoom de navegador y el `zoom`
  CSS no refluye breakpoints (medido: 182 px de artefacto). El
  layout bajo zoom real computa igual que el viewport reducido.
- D-V3-6 Evidencia: trail de 4 estados, no 5 (la propuesta IA por
  cita no existe en el contrato — `CitationProposal` no lleva id —
  y el ASCII del prompt la marca opcional; las propuestas viven en
  Revisar, destino del trail). Drawer en 1 columna: 672 px no dan
  para 2 columnas legibles; foco/Escape/trampa y móvil secuencial
  con CTA fija ya conformes. Fijado por `EvidenceDrawer.test.tsx`
  (vacíos honestos) y `t15-evidence.spec.ts` (8/8).
- D-V3-7 Capturas: matriz 8×5 con almacenamiento propio por
  ejecución. Incidente registrado: la primera pasada compartió
  storage con `v2-shots` (nombres V2 en el hero) y regeneró
  `docs/v2-shots`; se restauró de git intacto y se repitió
  aislado. 01–10 regen: 5 cambiaron (UI V3), 5 byte-idénticas;
  `v3-before/` archiva el antes.
- D-V3-8 P2-01 SVG: sin SVG decorativos nuevos. El flujo vive en
  HTML por accesibilidad (trace bar, proof trail); los gráficos de
  datos ya son SVG (curva recharts, hatch de anormalidad, anillo
  de meseta). Un diagrama de flujo duplicaría el rastro sin añadir
  comprensión.
- D-V3-9 P2-03 a11y: axe serious+ medido por la puerta
  `qa-visual` (5 pestañas × 2 viewports, 0 violaciones; ver
  verification-log). Lighthouse no medido: sin toolchain en el
  repo y sin presupuestos; no se publica ningún número.
- D-V3-10 Push por oleada: igual que D-V2-8 (la orden vigente del
  autor —siempre commit y push— prevalece sobre la regla del
  prompt V3 que pedía autorización).

## Deudas

- Etiquetas SVG dependientes de datos: la regla offset/dx cubre
  demo + E2E (defecto, 0 %, 40 %, 320/640/1280); combinaciones
  extremas de rivales no exploradas exhaustivamente.
- `feasible_count` sigue en contrato (heredado V2; renombrarlo
  rompería clientes).
- Lighthouse sin medir (D-V3-9).
- Vídeo 180 s y candidatura: del autor (el repo aporta guion
  consistente + storyboard + 5 capturas actuales).
- Meta live: bloqueo externo (sin clave/admisión/saldo; 0 llamadas).

## Descarte con motivo

- Drawer en 2 columnas (ver D-V3-6).
- Scatterplot Pareto: con 2–3 opciones, el layout estático +
  tabla es más claro; el prompt lo permite decidir con capturas.
- Highlight hover/focus de líneas secundarias: recharts no lo
  soporta en ReferenceLines sin SVG a medida; atenuación fija
  (opacidad 0,55) + leyenda + tabla como detalle por teclado.
- Cambio de framework, librería de charts, predictor, RAG,
  animación Meta, despliegue público: prohibidos por prompt/AGENTS.
