# BidLab — guion demo 180 s

Estado: BORRADOR de guion. Sin vídeo grabado. Nada de aquí se ha enviado.
Caso: licitación real 2026/00006554N (Tías, PLACSP 20777838). UI en español.
Regla de honestidad: solo se muestra lo que existe y pasa E2E en Chromium.
En pantalla siempre: «Datos de ejemplo · documento público real · empresa y rivales hipotéticos».
Lo que está entre corchetes [NO SE LEE]: son notas de cámara, no narración.

## Preparación (antes de grabar)

1. `python scripts/demo.py --reset-demo` (DB demo separada, API en loopback).
2. GET capabilities: mode=demo, meta_configured=false, cero llamadas externas.
3. Ventana 1280×720, zoom 100 %. Coste y rivales iniciales visibles arriba.
4. Sin .env, claves ni ventanas ajenas en pantalla.
5. Ensaya dos veces desde limpio, una sin Internet [NO SE LEE].

## Bloque 1 — Gancho (0–15s)

Pantalla: Biblioteca `/`. Clic en «Cargar ejemplo».
Narración: «Una rebaja mayor te da más puntos, pero te cuesta beneficio. Al pasar del 5 % al 15 %, ganas puntos y pierdes 11.833,60 euros de beneficio estimado. ¿Te compensa? Compruébalo.»

## Bloque 2 — Origen real (15–40s)

Pantalla: Resumen `/tenders/:id?tab=resumen`. Insignia «Datos de ejemplo», PBL neto 118.336, bruto 126.619,52, 49 puntos, snapshot 25/10, enlace «Ver publicación en Contratación del Estado». [NO SE LEE: no muestres ninguna extracción Meta en vivo; no existe en el frontal.]
Narración: «Partimos de una licitación real de Tías: neto 118.336 euros y 49 puntos de precio. La insignia dice Datos de ejemplo. Las cifras vienen de una semilla revisada a mano.»

## Bloque 3 — Revisión (40–60s)

Pantalla: pestaña Requisitos. Fila de solvencia técnica: «Por verificar». Clic en «Ver página 6» → drawer «Página 6 de 41», cita con 207.088.
Narración: «Este requisito queda pendiente. La empresa no acredita el umbral y la cita está en la página 6. BidLab lo marca Por verificar. No inventa certificados.»

## Bloque 4 — Coste e hipótesis (60–80s)

Pantalla: pestaña Precio. «Prueba con precios de rivales»: A 106.502,40, B 110.052,48. Coste de empresa 90.000 visible y rotulado como de ejemplo. Nota «empresa de ejemplo». [NO SE LEE: muestra el coste declarado; no teclees un coste nuevo en cámara.]
Narración: «El coste es de una empresa ficticia y los rivales son escenarios. Declaramos cada hipótesis en pantalla. Sin ofertas reales, no hay predicción posible.»

## Bloque 5 — Resultado al 15 % (80–100s)

Pantalla: campo Rebaja a 15. KPIs: precio 100.585,60, beneficio 10.585,60, puntos 49,0000. «¿Cómo sale tu resultado?»: regla, revisión, mejor oferta incluyendo la propia.
Narración: «Con rebaja del 15 %, el precio queda en 100.585 euros y los puntos llegan a 49. Pero el beneficio cae a 10.585. Cada cifra muestra su cálculo.»

## Bloque 6 — Comparación 5 frente a 15 (100–120s)

Pantalla: «¿Qué prueba te conviene más?» → «Comparar»: guarda la prueba al 15 %, vuelve a rebaja 5 (precio 112.419,20, beneficio 22.419,20, puntos 46,4211), guarda también. Informe: ambas alternativas lado a lado con la diferencia de 11.833,60. [NO SE LEE: la comparación vive en pruebas guardadas e informe; no hay vista animada lado a lado.]
Narración: «Guardamos ambas alternativas y las comparamos. Los mismos supuestos, los dos resultados. La diferencia es clara y queda guardada.»

## Bloque 7 — Cambio de hipótesis (120–138s)

Pantalla: rival A: 106.502,40 → 100.585,60. Puntos al 5 %: 46,4211 → 43,8421. «Supuestos declarados» visible. Restaura el rival A al final.
Narración: «¿Y si el rival supuesto oferta menos? Tus puntos bajan a 43,84. La conclusión cambia con la hipótesis. Por eso cada escenario declara las suyas.»

## Bloque 8 — Desconocidos (138–160s)

Pantalla: rivales sin especificar → puntuación «Sin determinar». Precio propio y beneficio estimado intactos. [NO SE LEE: bloque opcional; si falta tiempo, salta al bloque 9.]
Narración: «Si no definimos rivales, no inventamos sus ofertas. La puntuación queda sin determinar. Tu precio y tu beneficio siguen visibles.»

## Bloque 9 — Guarda y cierra (160–180s)

Pantalla: prueba guardada → «Verla en el informe». Informe: detalle, hash snapshot de 64 hex, hipótesis, pendientes, fuentes. Decisión manual «Preparar oferta», nota, «Crear informe», «Descargar HTML». Cierre en Resumen con insignia Datos de ejemplo.
Narración: «Guardamos el escenario: valores y hash idénticos tras recargar. Tú tomas la decisión y el informe conserva fuentes y pendientes. Entiende la regla, compara y guarda.»

## Límites que se declaran en el vídeo

- Extracción curada manualmente; integración Meta en vivo pendiente en el frontal (G3 parcial: solo smoke real).
- Empresa y rivales sintéticos; sin histórico que entrene ningún predictor.
- Sin probabilidades de ganar ni CTA de «optimizar para ganar».
- Sin tour guiado ni comparación animada: son propuestas, no existen en la app.
- No se muestra instalación, claves ni recuperaciones no medidas.

## Evidencia por bloque (trazabilidad, no se lee en el vídeo)

- Bloque 1–2: carga ejemplo + badge + offline: tests/e2e/e01-e02-e09-demo.spec.ts (E01).
- Bloque 3: requisito unknown + p. 6 de 41 + cita 207.088: E02.
- Bloque 4–5: hipótesis visibles + rebaja 15, precio/beneficio/puntos/traza: tests/e2e/e03-e06-pricing.spec.ts (E03).
- Bloque 6: guardar dos escenarios + informe: tests/e2e/e07-e08-scenarios-report.spec.ts (E07, E08).
- Bloque 7: rival A → 43,8421, sin probabilidades: E04.
- Bloque 8: unknown rivales/grupos, cifras intactas: E06.
- Bloque 9: recargar → hash idéntico + informe HTML sin secretos: E07, E08.
- Números esperados: fixtures/demo/expected.json (90000.00, 106502.40, 110052.48; 5/15/30 %).
- Puertas globales: scripts/verify.py ALL CHECKS PASSED 27-oct, oleada UX (docs/verification-log.md); ronda judge-fix pendiente de verde final (TBD).
