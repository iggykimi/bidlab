# BidLab · CHANGELOG de implementación V3 (issue #4)

Base: `c1befab` (docs post-V2 issue #3). Rama: `main`. Fecha: 2026-10-29.
Árbol limpio tras cada push. Decisiones con tradeoffs:
[DECISION_LOG_V3](DECISION_LOG_V3.md).
Prompt: `BIDLAB_V3_VISUAL_Y_EVALUADORES_2026-10-29.zip` (4 MD, sin MANIFEST;
integridad = hash SHA-256 `20E1D5DF…` + lectura íntegra: prompt 682 líneas
§§0–19 + 3 anexos `COMO_USAR`, `PRIMER_PANTALLAZO`, `REVIEWER_GUIDE_DRAFT`).

Estados: `IMPLEMENTADO` / `PARCIAL` / `YA_EXISTIA` / `BLOQUEADO` / `DESCARTADO`.

| ID | Estado | Qué se hizo / por qué no | Archivos / commits |
|---|---|---|---|
| P0-01 | IMPLEMENTADO | `EXECUTIVE_AUDIT.md` histórico archivado byte-idéntico (`docs/archive/EXECUTIVE_AUDIT_2026-10-26.md`, verificado programáticamente) + auditoría viva con estado real y límites honestos. | `EXECUTIVE_AUDIT.md`, `docs/archive/` · `04828fb` |
| P0-05 | IMPLEMENTADO | `AGENTS.md` recortado a guía de mantenimiento; `llms.txt` factual (2 pantallas); `ARCHITECTURE.md` con sección CURRENT IMPLEMENTATION (lo construido manda). | `AGENTS.md`, `llms.txt`, `docs/ARCHITECTURE.md` · `04828fb` |
| P0-02 | IMPLEMENTADO | Portada README EN con claim 49/49 +5.916,80 € + transparencia IA; capturas 01/02 actuales (regeneradas post-V3 en P1-04). | `README.md` · `c361ebe` |
| P0-03 | IMPLEMENTADO | `docs/REVIEWER_GUIDE.md` nuevo: problema, resultado demo, qué inspeccionar, run, limitaciones + índice de evidencia con enlaces validados. | `docs/REVIEWER_GUIDE.md` · `c361ebe` |
| P0-04 | IMPLEMENTADO | `DecisionSpotlight`: veredicto = `indicator_motivo` backend sobre las 2 últimas comparables (`created_at,id`); sin hero sin 2 comparables; pendiente honesto («Guarda dos pruebas…») + distinción sin-sesión. E2E demo + propia. | `DecisionSpotlight.tsx`, `SummaryTab.tsx`, `styles.css`, `compare.spec.ts`, `own-journey.spec.ts`, `e01-demo` · `956dcbe` |
| P1-01 | IMPLEMENTADO | Duelo editorial 2 pruebas (mismas cifras de tabla) + guarda de empate `ds==0&&dp==0` + «Requiere revisión» solo presentación + motivo «dominada» exacto por dimensión (espejo `_supera`; el ejemplo del contrato exhibía el bug y se corrigió). E2E duelo visible/ausente + CMP-05 exacto. | `compare.py`, `decision_frontier.py`, `test_compare_verdicts.py`, `test_decision_frontier.py`, `CompareSection.tsx`, `DecisionFrontier.tsx`, `compare.spec.ts`, contrato (ejemplo) · `def2793`, `0ec778d` |
| P1-03 | IMPLEMENTADO | BL-FIX-02: `hypothesis_index` en contrato (regen exact-repro, diffs aditivos) + repro E2E primero (2→1 rojo). Banner «Resultado anterior» antes del título + bloquea Aplicar; minimapa 3 + expansor; leyenda con texto; lookup O(1); «(supuesto)» junto a etiquetas. E2E 7/7. | `build_contract.py`, `API_CONTRACT.yaml`, generados, `stress.py`, `StressSection.tsx`, `stress.spec.ts`, `test_stress.py` · `ad69683` |
| P1-02 | IMPLEMENTADO | Meseta por lookup (racha 2+ anclada, título neutral si no); anillo + leyenda + aria. «Máx»/«Equilibrio» a leyenda HTML; offsets de dibujo (alto/bordes). Zoom 200% ≡ 640 CSS px (medido artefacto CSS-zoom). E2E 7/7 (meseta/neutral/tooltip/teclado/320/extremos/zoom). | `CurveChart.tsx`, `curveFlags.test.ts` (+6), `styles.css`, `curve-v3.spec.ts` · `66adb86` |
| P1-05 | IMPLEMENTADO | Proof trail de 4 estados exactos por cita (fuente/revisión/regla/decisión; propuesta IA por cita no existe en contrato y el prompt la marca opcional) + ancla `#tu-calculo` + cierre al navegar. Drawer 1 columna (decisión documentada). E2E 8/8 + unit vacíos honestos. | `EvidenceDrawer.tsx`, `CurveSection.tsx`, `styles.css`, `EvidenceDrawer.test.tsx`, `t15-evidence.spec.ts` · `6d6028e` |
| P1-04 | IMPLEMENTADO | Matriz 8 escenas × 5 anchos (40 PNG) + regen 01–10 (5 cambiaron, 5 byte-idénticas) + `v3-before/` archiva el antes. Test alto contenido: malla 81×9 = 729 celdas. axe serious+ 0 en 5 pestañas × 2 viewports (medido `qa-visual` 6/6). Incidente: pasada compartida contaminó nombres + tocó `v2-shots`; restaurado de git y repetido aislado. | `v3-shots.spec.ts`, `docs/demo/`, `test_stress.py` · `c179813` |
| P1-06 | IMPLEMENTADO | Guion v5 consistente (literales V3, bloque 8 = malla/stale, duelo/trail/veredicto en cámara, tag E06 opcional, desvíos §9 declarados) + este changelog + gates + auditoría §§0–19 + cierre #4. | `demo-script-180s.md`, este fichero, cifras auditadas · `f780bb7` |
| P2-01 | DESCARTADO | Sin SVG decorativos: flujo en HTML por a11y; datos ya SVG (curva, hatch, anillo). Ver D-V3-8. | — |
| P2-02 | IMPLEMENTADO | `docs/DECISION_LOG_V3.md`: 10 decisiones + deudas + descartes, con tests y limitaciones. | `docs/DECISION_LOG_V3.md` · `c179813` |
| P2-03 | PARCIAL | axe medido y publicado (0 serious+, puerta `qa-visual`). Lighthouse NO medido (sin toolchain ni presupuestos): no se publica ningún número. Ver D-V3-9. | `qa-visual.spec.ts` (puerta existente) |
| §6 biblio | YA_EXISTIA | Biblioteca con CTA inequívocas («Cargar ejemplo» / «Nueva licitación»), primer CTA sin scroll a 1440×900 (s1), tour existente no duplicado, badge demo único. Verificado en matriz s1. | `LibraryPage.tsx` (existente) |
| §7 microcopy | IMPLEMENTADO | «Beneficio hipotético», «hipótesis de rivales», «(supuesto)», «Resultado anterior: recalcula», «presunción/no exclusión» verificados en UI; sin «AI-powered» ni % fiabilidad. | Varios (ver diff por tarea) |
| Meta live | BLOQUEADO | Sin clave/admisión/saldo; 0 llamadas. Smoke 26-oct no es extracción. Frontal sin Meta en vivo (fijado por E2E offline-guard). | — |
| Vídeo 180s | BLOQUEADO | Lo graba el autor con ejecución real; el repo aporta guion v5 + storyboard + capturas. | `demo-script-180s.md` |

## Puertas finales (29-oct, post-V3)

- `python scripts/verify.py` @`c179813`: ALL CHECKS PASSED 10/10, exit 0, 29-oct.
- Backend offline: 565 passed, 1 skipped (symlink, preexistente), 1 deselected (live opt-in).
- Vitest: 259 passed (33 ficheros). ESLint: 0. tsc: limpio. ruff check/format: limpio. mypy: limpio.
- E2E Chromium completa: 98/98 en DOS pasadas (85 base + 13 V3), exit 0.
- axe serious+: 0 violaciones (5 pestañas × 1440/390, `qa-visual` 6/6).
- Nota honesta: una primera pasada verify dio exit 1 con la cola truncada por el pipe
  (detalle perdido); el rerun + una E2E independiente salieron verdes. Ver verification-log.

## Capturas

- `docs/demo/01–10.png`: regeneradas post-V3 (01/03/06/07/10 con UI V3).
- `docs/demo/v3-before/`: estado pre-V3, copiado antes de regenerar.
- `docs/demo/v3/{1440,1024,768,390,320}/s1–s8.png`: matriz §8 (40).
- `docs/v2-shots/`: intacto (evidencia histórica V2; restaurado tras incidente P1-04).
