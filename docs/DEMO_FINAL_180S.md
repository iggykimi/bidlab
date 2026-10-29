# Demo final 180 s · planes A/B/C (29-oct-2026, RC @4b44ec9)

Estado: PLAN, sin grabar. El guion detallado bloque a bloque
sigue en `demo-script-180s.md` v3. Este documento solo fija
qué grabar según lo que funcione el día de la grabación y
los checkpoints de honestidad.

## Reglas comunes (los 3 planes)

- Offline total: sin llamadas Meta en el frontal; el vídeo
  lo declara («Datos de ejemplo», sin predicción).
- Nada grabado antes de `python scripts/verify.py` en verde
  sobre el checkout exacto de la grabación.
- Si algo falla en directo, se dice en voz alta y se sigue
  con el plan de abajo. Nada de re-grabar para esconderlo.

## Plan A (ideal): recorrido oro en vivo

1. Biblioteca → «Ver ejemplo» (Tías, Datos de ejemplo).
2. Resumen: Lo esencial + «Sigue estos tres pasos».
3. Requisitos: bandas por criterio, «basta con cumplir una».
4. Precio: presets 10 % → guardar → 15 % → guardar →
   hero del comparador («conserva 5916,80 € más de
   beneficio con los mismos puntos»).
5. Citas: drawer con tarjeta «De dónde sale esta cita».
6. Informe: abrir prueba, decisión, crear informe,
   descargar HTML. Cierre en Resumen.
- Checkpoints: 118.336 €, 49,0 de 49, «5916,80»,
  «No pudimos mostrar la imagen», presunción art. 149.

## Plan B (si algo falla en vivo)

- Mismo recorrido con capturas `docs/demo/01-10` como
  apoyo + narración sobre la app real en los pasos que
  sí funcionen. Se declara qué parte es captura fija.

## Plan C (si la app no arranca)

- Solo capturas 01-10 + `demo_story` (4 escenarios, 4
  HTML, comparación) + narración. Se declara que la
  app no arrancó y se enseña el log, no un éxito.

## Evidencia mínima a conservar

- Commit exacto grabado, salida de verify.py, fecha,
  plan usado (A/B/C) y desviaciones declaradas.
