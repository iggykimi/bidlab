# BidLab — guion demo 180 s

Estado: BORRADOR de guion v5 (29-oct, post issue #4 V3). Literales «» re-verificados contra código/tests @HEAD-V3 (ver Evidencia): spotlight «Guarda dos pruebas…» en carga fresca, duelo editorial tras comparar, banner «Resultado anterior» en malla, proof trail de 4 estados en drawer. Desvíos honestos del storyboard §9 del prompt V3: sensibilidad/malla SÍ entra (bloque 8); bloque técnico NO entra en 180 s —vive en REVIEWER_GUIDE + verification-log—; desconocidos (E06) queda como tag opcional en bloque 7. Footage-oro-20261028.webm anterior al V2: solo metraje base parcial; regrabación pendiente del autor junto al vídeo narrado de 180 s. Nada de aquí se ha enviado.
Caso: licitación real 2026/00006554N (Tías, PLACSP 20777838). UI en español, tuteo.
Regla de honestidad: solo se muestra lo que existe y pasa E2E en Chromium.
Textos entre «» son literales verificados en código o specs E2E.
Texto entre corchetes [NO SE LEE]: notas de cámara, no narración.
Rótulo de grabación (overlay en edición, NO existe en la UI):
«Datos de ejemplo · documento público real · empresa y rivales hipotéticos».

Caso oro del guion (fijado por tests/e2e/compare.spec.ts, CMP-02):
con rebaja del 10 % y del 15 % se obtienen los mismos 49 puntos,
pero el 10 % conserva 5916,80 € más de beneficio.

## Preparación (antes de grabar)

1. `npm run build` en `apps/web` una vez (la API sirve esa compilación).
2. `python scripts/demo.py --reset-demo` (resetea la DB en `BIDLAB_STORAGE_DIR`,
   sirve API + frontal same-origin en `http://127.0.0.1:8000/`).
3. GET capabilities: mode=demo, meta_configured=false, cero llamadas externas.
   (`npm run dev -w apps/web` solo hace falta para desarrollar el frontal.)
4. Ventana 1280×720, zoom 100 %. Tras «Cargar ejemplo», clic en «Precio»
   para comprobar que «Escribe tu rebaja (%)» cabe en el primer pantallazo.
5. Sin .env, claves ni ventanas ajenas en pantalla.
6. Ensaya dos veces desde limpio, una sin Internet [NO SE LEE].

## Bloque 1 — Gancho (0–15s)

Pantalla: Biblioteca `/`. Clic en «Cargar ejemplo».
Narración: «Con el 10 % y con el 15 % de rebaja sacas los mismos 49 puntos.
Pero con el 10 % conservas 5916,80 euros más de beneficio. ¿Te compensa
rebajar de más? Compruébalo.»

## Bloque 2 — Origen real (15–40s)

Pantalla: Resumen `/tenders/tias?tab=resumen`. Spotlight «Guarda dos pruebas para compararlas aquí.» (carga fresca: aún no hay veredicto; el veredicto aparece tras el bloque 6 y se ve en el cierre). Insignia «Datos de ejemplo»,
aviso «Datos de ejemplo. Los precios de los rivales y tu coste son inventados
para que puedas probar.», «Lo esencial»: «Presupuesto de salida» 118.336 €
sin IGIC (126.619,52 € con IGIC), «El precio da hasta 49 puntos.»,
«Datos del 25 de octubre de 2026.», enlace «Ver publicación en Contratación
del Estado» (visible, NO pulsarlo). [NO SE LEE: sobre «Lo esencial» se ve la
barra «Rastro de decisión» (Fuente→Propuesta→Revisión→Cálculo→Decisión) con
«Ejemplo preparado.»; no la narres, es contexto en plano. Plano de la línea «El asistente
de IA no está disponible en esta demo: aquí los datos ya vienen revisados.»;
no muestres ninguna extracción Meta en vivo, no existe en el frontal.]
Narración: «Partimos de una licitación real de Tías: 118.336 euros de
presupuesto y 49 puntos de precio. La insignia dice Datos de ejemplo. Las
cifras vienen de una semilla revisada a mano.»

## Bloque 3 — Revisión (40–60s)

Pantalla: pestaña «Requisitos». Fila «Servicios similares año mayor ejecución
≥ 207.088,00 €»: «Por verificar». Clic en «Ver página 6 en el pliego» →
«Página 6 de 41»: rastro «Fuente · p. 6» + «Revisión · sin uso en fórmula» (esta cita no alimenta la fórmula: el rastro lo dice, no lo inventa). La semilla no trae imagen, así que se ve el aviso
«El documento original no se incluye en este ejemplo. Coteja con el texto de abajo.» y la cita con
207.088 como texto rotulado. «Cerrar» antes del siguiente bloque
[NO SE LEE: el drawer devuelve el foco al botón; no finjas una imagen
que no existe].
Narración: «Este requisito queda pendiente. La empresa no acredita el umbral
y la cita está en la página 6. El rastro dice que no alimenta la fórmula. Sin imagen, BidLab lo dice y enseña el texto
rotulado. No inventa certificados.»

## Bloque 4 — Coste e hipótesis (60–80s)

Pantalla: pestaña «Precio». «¿Cuánto quieres rebajar?» con «Escribe tu rebaja
(%)». Resumen de coste: «Pyme de ejemplo», directos 80.000,00 €, indirectos
10.000,00 €; línea de beneficio: «Es un dato de ejemplo.» (v3: literal nuevo) «Prueba con precios
de rivales»: A 106.502,40 €, B 110.052,48 €, «Tomas estos como todos los
rivales.» [NO SE LEE: muestra el coste declarado; no teclees un coste nuevo
en cámara.]
Narración: «El coste es de una empresa ficticia y los rivales son escenarios
que declaras tú. Sin ofertas reales, no hay predicción posible.»

## Bloque 5 — Resultado al 10 % (80–100s)

Pantalla: «Escribe tu rebaja (%)» a 10. KPIs: «Tu oferta (sin IGIC)» 106.502,40 €,
«Tu beneficio» +16.502,40 €, «Tus puntos por precio» «49,0 de 49»,
«Sacarías 49,0 de 49 puntos por precio.» «¿Cómo sale tu resultado?»:
«Tu precio: 118.336 € menos un 10,0 % = 106.502,40 €.», «La oferta más
barata es 106.502,40 €.», «Tus puntos: 49 puntos máximos × oferta más barata
÷ tu oferta = 49,0.»
Narración: «Con rebaja del 10 %, ofertas 106.502 euros, ganas unos 16.502 y
sacas los 49 puntos. Cada cifra muestra su cálculo.»

## Bloque 6 — Comparar 10 frente a 15 (100–122s)

Pantalla: «¿Guardas esta prueba?» → «Guardar esta prueba» («Prueba
«Demo 10» guardada.»). Rebaja a 15 (precio 100.585,60 €, beneficio
+10.585,60 €, «49,0 de 49»), guardar «Demo 15». Sin salir de «Precio»:
«¿Qué prueba te conviene más?» → marcar ambas → «Comparar»:
«Puedes compararlas: comparten contexto.», delta «-5916,80 €»,
««Demo 10» conserva 5916,80 € más de beneficio con los mismos puntos.»
[NO SE LEE: tras «Comparar» se ve el duelo editorial lado a lado («Demo 10» frente a «Demo 15», mismas cifras de la tabla) y «Frontera de decisión» con «Demo 10» en la frontera y «Demo 15» dominada «con los mismos puntos». Plano del duelo 3 s, sin narración extra; sin animación.]
Narración: «Guardamos ambas pruebas y las comparamos. Mismos supuestos, mismo
contexto. El 10 % conserva 5916,80 euros más con los mismos puntos.»

## Bloque 7 — Cambio de hipótesis (122–140s)

Pantalla: «Escribe tu rebaja (%)» de vuelta a 5. Rival A: 106502.40 →
100585.60 (coma o punto). Puntos: «46,4 de 49» → «43,8 de 49».
«Supuestos declarados» visible. Restaura el rival A al final
(«46,4 de 49»).
Narración: «¿Y si el rival supuesto oferta menos? Tus puntos bajan a 43,8.
La conclusión cambia con la hipótesis. Por eso cada escenario declara las
suyas.»
[NO SE LEE: tag opcional E06 (5 s, quitar del silencio final si falta tiempo): desmarcar «Tomar estos como todos los rivales» → «Sin determinar», remarcar.]

## Bloque 8 — Malla y resultado anterior (140–158s)

Pantalla: «Prueba de resistencia»: rellenar solo «Tu coste sin impuestos»
(80000,00; el resto va por defecto: 81 rebajas, hipótesis «Base»).
«Probar la malla» → «Qué rebajas siguen siendo viables…» + conclusión que
nombra la rebaja que aguanta. Cambiar «Beneficio mínimo» → banner
«Resultado anterior: has cambiado las entradas después de esta malla. Vuelve
a probarla.» antes del título «Resultado anterior: recalcula»; «Aplicar esta
rebaja» queda deshabilitado. [NO SE LEE: no abras la tabla densa en cámara;
si falta tiempo, salta al bloque 9.]
Narración: «Probamos 81 rebajas contra tu hipótesis. Si cambias una entrada,
el resultado viejo se marca y no se deja aplicar hasta recalcular.»

## Bloque 9 — Guarda y cierra (158–180s)

Pantalla: pestaña «Informe». «Paso 1 · Abre una prueba guardada» → «Abrir
prueba Demo 10»: «Copia (SHA-256)» de 64 hex, «Supuestos», «Lo que te falta
por comprobar», «Fuentes». «Paso 2 · Decide y crea tu informe»: «Preparar
oferta», nota, «Crear informe» → «Decisión: Preparar oferta». «Descargar
HTML» (`bidlab-informe-<fecha>.html`). Cierre en «Resumen»: spotlight con
««Demo 10» conserva 5916,80 € más de beneficio con los mismos puntos.» +
insignia «Datos de ejemplo».
Narración: «Abrimos la prueba: valores, copia y fuentes. Tú tomas la decisión
y el informe la conserva con tus notas. Entiende la regla, compara y guarda.»

## Recorrido propio (evidencia local, fuera de los 180 s)

No sale en el vídeo por tiempo. Probado E2E 4/4 (tests/e2e/own-journey.spec.ts,
R05 ×4 incluido recarga-sin-duplicar, en verde el 29-oct
dentro de la suite 77/77): «Nueva licitación» →
«¿Qué licitación quieres dar de alta?» → «¿Quieres añadir el pliego en PDF?»
→ «¿Quién eres en esta licitación?» → pestaña «Revisar» (insignia
«Tus datos»): «¿Pides propuestas automáticas?» → seguidor con «Estado:»
(«En cola» / «En marcha» / «Lista») + «Detalles técnicos» con la clase de
ejecución, «Sin propuestas automáticas; revisa a mano.»,
«Aprobar tu revisión» → «Ya guardamos tu revisión N.» (con número) → «Ir a Precio» → simular,
«Guardar esta prueba» → «Verla en el
informe» → «Crear informe» → «Descargar HTML». Todo offline, sin tocar el
ejemplo. Atajos honestos si algo falta: «Crea tu empresa en Revisar»,
«Revisa tu fórmula».

## Límites que se declaran en el vídeo

- Extracción curada manualmente; integración Meta en vivo pendiente en el
  frontal (G3 parcial: solo smoke real).
- Empresa y rivales sintéticos; sin histórico que entrene ningún predictor.
- Sin probabilidades de ganar ni CTA de «optimizar para ganar».
- La visita guiada existe (?tour=1, fijada por tests/e2e/tour.spec.ts) pero no se usa en la narración; duelo editorial sí existe (lado a lado, sin animación).
- No se muestra instalación, claves ni recuperaciones no medidas.

## Evidencia por bloque (trazabilidad, no se lee en el vídeo)

- Bloque 1–2: carga ejemplo + badge + offline: tests/e2e/e01-e02-e09-demo.spec.ts (E01, E09).
- Bloque 2 (puntos/fecha): mismo spec, «Lo esencial» («hasta 49 puntos», «Datos del 25 de octubre de 2026»).
- Bloque 3: requisito unknown + p. 6 de 41 + cita 207.088: E02.
- Bloque 4–5: hipótesis visibles + rebaja 10 (106.502,40 / +16.502,40 / 49,0 de 49):
  tests/e2e/r06-layout.spec.ts (precio a 10), tests/e2e/compare.spec.ts (CMP-02, 49,0 de 49),
  apps/api/tests/unit/test_compare_logic.py (beneficio 16502.40).
- Bloque 6: guardar dos pruebas + comparar desde Precio: CMP-02 («-5916,80 €»,
  «con los mismos puntos»), R06 («Comparar R06 diez/quince» desde Precio),
  backend apps/api/tests/integration/test_compare.py::test_golden_compare_10_vs_15
  (49.000000000000 en ambas, deltas 5916.80, indicator higher_profit_same_score).
- Bloque 7: rival A → 43,8 de 49, sin probabilidades: E04.
- Bloque 8: conjunto incompleto, cifras intactas: E06.
- Bloque 9: hash 64 hex idéntico tras recargar + informe HTML sin secretos: E07, E08.
- Recorrido propio: tests/e2e/own-journey.spec.ts (4/4, R05 ×4) + R01–R04
  (tests/e2e/r01-r04-state.spec.ts: deep link ?prueba=, borrador de coste
  obsoleto, listado tras guardar, aviso «Tu borrador no se guardó en este
  navegador.»).
- Números esperados 5/15/30 %: fixtures/demo/expected.json (90000.00 =
  80000 + 10000 de company.json «Pyme de ejemplo»; casos 5/15/30 %;
  anomalía a 30 %); caso 10 % fijado por CMP-02 + R06 + backend, no por expected.json.
- Puertas globales: suite 98/98 (2 pasadas) + backend 565 + web 259 en verde
  el 29-oct (código @c179813; ver docs/verification-log.md, post-issue #4);
  re-ejecutar `python scripts/verify.py` tras cualquier cambio posterior
  antes de grabar.
