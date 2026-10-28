# BidLab — guion demo 180 s

Estado: BORRADOR de guion v2 (28-oct, post PKG-T15). Literales «» re-verificados contra código/tests @4e0b37d: 40+ citas vigentes, ver notas al pie de cada bloque tocado. Footage-oro-20261028.webm ANTERIOR a T09–T15 (drawer, tracker, vocabulario): NO reutilizar como metraje final, regrabar desde limpio. Vídeo narrado de 180 s pendiente de grabar por el autor. Nada de aquí se ha enviado.
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

1. `python scripts/demo.py --reset-demo` (DB demo separada, API en loopback).
2. GET capabilities: mode=demo, meta_configured=false, cero llamadas externas.
3. `npm run dev -w apps/web` (el paso 1 NO arranca el frontal).
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

Pantalla: Resumen `/tenders/tias?tab=resumen`. Insignia «Datos de ejemplo»,
aviso «Datos de ejemplo. Los precios de los rivales y tu coste son inventados
para que puedas probar.», «Lo esencial»: «Presupuesto de salida» 118.336 €
sin IGIC (126.619,52 € con IGIC), «El precio da hasta 49 puntos.»,
«Datos del 25 de octubre de 2026.», enlace «Ver publicación en Contratación
del Estado» (visible, NO pulsarlo). [NO SE LEE: plano de la línea «El asistente
de IA no está disponible en esta demo: aquí los datos ya vienen revisados.»;
no muestres ninguna extracción Meta en vivo, no existe en el frontal.]
Narración: «Partimos de una licitación real de Tías: 118.336 euros de
presupuesto y 49 puntos de precio. La insignia dice Datos de ejemplo. Las
cifras vienen de una semilla revisada a mano.»

## Bloque 3 — Revisión (40–60s)

Pantalla: pestaña «Requisitos». Fila «Servicios similares año mayor ejecución
≥ 207.088,00 €»: «Por verificar». Clic en «Ver página 6 en el pliego» →
«Página 6 de 41»: la semilla no trae imagen, así que se ve el aviso
«Esta página no tiene imagen. Coteja con el texto de abajo.» y la cita con
207.088 como texto rotulado. «Cerrar» antes del siguiente bloque
[NO SE LEE: el drawer devuelve el foco al botón; no finjas una imagen
que no existe].
Narración: «Este requisito queda pendiente. La empresa no acredita el umbral
y la cita está en la página 6. Sin imagen, BidLab lo dice y enseña el texto
rotulado. No inventa certificados.»

## Bloque 4 — Coste e hipótesis (60–80s)

Pantalla: pestaña «Precio». «¿Cuánto quieres rebajar?» con «Escribe tu rebaja
(%)». Resumen de coste: «Pyme de ejemplo», directos 80.000,00 €, indirectos
10.000,00 €; línea de beneficio: «Es un dato inventado.» «Prueba con precios
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
[NO SE LEE: la comparación vive en la bandeja «Comparar pruebas», también
disponible en «Informe»; no hay vista animada lado a lado.]
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

## Bloque 8 — Desconocidos (140–158s)

Pantalla: desmarcar «Tomar estos como todos los rivales» → «Tus puntos por
precio» «Sin determinar». «Tu oferta» y «Tu beneficio» intactos. Volver a
marcar al final. [NO SE LEE: bloque opcional; si falta tiempo, salta al
bloque 9.]
Narración: «Si no declaras todos los rivales, no inventamos sus ofertas. Los
puntos quedan sin determinar. Tu precio y tu beneficio siguen visibles.»

## Bloque 9 — Guarda y cierra (158–180s)

Pantalla: pestaña «Informe». «Paso 1 · Abre una prueba guardada» → «Abrir
prueba Demo 10»: «Copia (SHA-256)» de 64 hex, «Supuestos», «Lo que te falta
por comprobar», «Fuentes». «Paso 2 · Decide y crea tu informe»: «Preparar
oferta», nota, «Crear informe» → «Decisión: Preparar oferta». «Descargar
HTML» (`bidlab-informe-<fecha>.html`). Cierre en «Resumen» con insignia
«Datos de ejemplo».
Narración: «Abrimos la prueba: valores, copia y fuentes. Tú tomas la decisión
y el informe la conserva con tus notas. Entiende la regla, compara y guarda.»

## Recorrido propio (evidencia local, fuera de los 180 s)

No sale en el vídeo por tiempo. Probado E2E 4/4 (tests/e2e/own-journey.spec.ts,
R05 ×4 incluido recarga-sin-duplicar, re-ejecutado en verde el 28-oct
dentro de la suite 70/70): «Nueva licitación» →
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
- La visita guiada existe (?tour=1, fijada por tests/e2e/tour.spec.ts) pero no se usa en la narración; sin comparación animada: es propuesta, no existe en la app.
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
- Recorrido propio: tests/e2e/own-journey.spec.ts (3/3) + R01–R04
  (tests/e2e/r01-r04-state.spec.ts: deep link ?prueba=, borrador de coste
  obsoleto, listado tras guardar, aviso «Tu borrador no se guardó en este
  navegador.»).
- Números esperados 5/15/30 %: fixtures/demo/expected.json (90000.00 =
  80000 + 10000 de company.json «Pyme de ejemplo»; casos 5/15/30 %;
  anomalía a 30 %); caso 10 % fijado por CMP-02 + R06 + backend, no por expected.json.
- Puertas globales: suite 70/70 + backend 458 + web 212 en verde
  el 28-oct (@a870598; ver docs/verification-log.md PKG-T15);
  re-ejecutar `python scripts/verify.py` tras el merge de PKG-T11
  antes de grabar (el 10/10 anterior es anterior al paquete).
