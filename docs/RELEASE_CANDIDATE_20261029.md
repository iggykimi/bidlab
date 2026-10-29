# Release Candidate · 29-oct-2026 (issue #2)

Estado: RC local. Código @4b44ec9 (U1/U2/U3/U6 sobre 7af9417);
este documento + DEMO_FINAL_180S + capturas regen en el commit RC.

## Qué entra (P0 del prompt maestro, verificado)

- U1 cabecera compacta (`3e2172b`): volver + órgano/modo en una
  fila; meta a una línea (expediente + ámbito + PBL corto);
  resto en «Más detalles del expediente». h1, testids y
  literales pineados intactos. E2E e01/r06/qa-visual 16/16.
- U2 hero comparador (`fb0ea17`): bandeja tras KPIs (comparar
  antes que detalles); hero `decision-comparison-hero` con
  `indicator_motivo` del backend verbatim. CMP-03 nuevo:
  10/15 en Precio, 5916,80 + mismos puntos. Nota: el motivo
  usa formato 5916,80 (backend), no 5.916,80 (§24 erró aquí).
- U3 drawer variante B (`73340fc`): tarjeta
  `evidence-provenance` según modo, aditiva; aviso honesto
  de imagen intacto. T15 3/3.
- U6-parcial (`4b44ec9`): `selectionReasonEs` mapea los 2
  motivos de la malla a español; contrato backend intacto
  (pineado en test_stress.py). Vitest 237.

## Qué NO entra (aparcado/BLOCKED, con motivo)

- G0/M1/T1 (Meta live + segunda pasada): BLOCKED externo.
  Sin MODEL_API_KEY/META_API_URL en el entorno de
  integración, sin admisión verificable, sin saldo. Todo lo
  demás ejecutable sin Meta está hecho; híbrido sigue
  `provider_not_configured` honesto.
- U4 (curva móvil mediana): aparcado P1. La curva actual
  pasa R06/e11 sin overflow; reordenar ejes es riesgo
  visual sin evidencia de problema.
- U5 (requisitos móvil): cubierto en lo esencial. Los
  grupos OR ya muestran «basta con cumplir una» y el
  móvil 390 no desborda (verificado -15). Sin cambios.
- D1 (coverage visible): aparcado P1. Requiere endpoint o
  manifiesto nuevo; beneficio marginal frente a riesgo.
- U7/W1/Pareto/techo móvil: aparcado P2/P1. Sin evidencia
  de problema en E2E ni en inspección.
- B1 (render diferido): NO CHANGE por defecto del propio
  prompt (sin medición de beneficio no se toca).
- D2 (segunda pasada extracción): P2, requiere live.
- R1 (vídeo + candidatura): autor-only. Guion v3 listo;
  vídeo sin grabar; candidatura sin enviar.

## Reglas del paquete que NO se aplicaron (decisión)

- D-ISSUE2-1: la regla 4 («no hacer push») entra en
  conflicto con la orden vigente del autor («siempre
  commit y push», D28-2). Prevalece la orden del autor:
  commits U1/U2/U3/U6 pusheados por separado + este RC.
- El prompt pedía aparcar U6 salvo el microcopy: aplicado
  solo el string inglés del techo (motivo de la malla).

## Gates RC (Windows, exit 0 observado)

- `verify.py --skip-e2e`: ALL CHECKS PASSED (backend,
  lint, tsc, build, vitest 237, ruff, mypy 109).
- Backend: 548 passed + 2 skipped (sin cambios desde
  7af9417; live opt-in + symlink Windows).
- E2E completa: 78/78 (77 + CMP-03).
- demo-shots 4/4; 9 PNG regen (cabecera nueva en todas);
  02 + 07 inspeccionadas.
- demo_story: 8/8 MATCH contra ejecucion-1/2 del ZIP#1.
- Visual: workhead plegado/desplegado, hero, drawer,
  móvil 390. Capturas /tmp: u1-*, u2-hero, u3-drawer.

## Riesgos abiertos

- La auditoría (issue #2) se hizo por lectura web, sin
  ejecutar nada: varias afirmaciones son de fiar con
  pinzas (ej. formato 5.916,80 del §24, falso).
- Sin Meta live no hay ablation real ni segunda pasada.
