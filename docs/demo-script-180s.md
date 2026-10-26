# BidLab — guion demo 180 s (T33)

Estado: BORRADOR de guion. Sin vídeo grabado.
Caso: licitación real 2026/00006554N (Tías, PLACSP 20777838). UI en español.
Regla de honestidad: solo se muestra lo que existe y pasa E2E en Chromium.
En pantalla siempre: «Demo curada · documento público real · empresa y rivales hipotéticos».

## Preparación (antes de grabar)

1. `python scripts/demo.py --reset-demo` (DB demo separada, API en loopback).
2. GET capabilities: mode=demo, meta_configured=false, cero llamadas externas.
3. Ventana 1280×720, zoom 100 %. Coste y rivales iniciales visibles arriba.
4. Sin .env, claves ni ventanas ajenas en pantalla.

## Guion segundo a segundo

| Tiempo | Pantalla y acción | Narración (ES) |
|---|---|---|
| 00–12s | Biblioteca `/`. Clic en «Cargar ejemplo». | «Una pyme recibe un pliego de 41 páginas. BidLab convierte ese pliego real en una decisión revisable: requisitos con evidencia, precio bajo hipótesis y un informe con fuentes.» |
| 12–25s | Resumen `/tenders/:id?tab=resumen`. Badge «Demo curada», PBL neto 118.336, bruto 126.619,52, 49 puntos, snapshot 25/10, enlace «Ver publicación en Contratación del Estado». | «Licitación real de Tías: neto 118.336 euros, 49 puntos de precio. La insignia dice Demo curada: cifras de semilla revisada, no extracción en vivo.» |
| 25–45s | Pestaña Requisitos. Fila de solvencia técnica: «Por verificar · unknown». Clic en «p. 6» → drawer «Página 6 de 41», cita con 207.088. | «Este requisito queda pendiente: la empresa no acredita el umbral y la cita está en la página 6. BidLab dice unknown; no inventa certificados.» |
| 45–60s | Pestaña Pricing Lab. KPIs: precio 112.419,20, beneficio 22.419,20, puntos 46,4211 de 49. Panel «Hipótesis de rivales»: A 106.502,40, B 110.052,48. Nota «empresa sintética». | «El coste es de una empresa ficticia y los rivales son escenarios. Con baja del 5 %, precio 112.419 y 46,42 puntos bajo estas hipótesis.» |
| 60–85s | Campo Baja: 5 → 15. KPIs: precio 100.585,60, beneficio 10.585,60, puntos 49,0000. «Ver cálculo»: regla, revisión, mejor oferta incluyendo la propia. | «Al 15 %, el precio baja a 100.585 y los puntos suben a 49. Pero el beneficio cae a 10.585. Más baja no siempre compensa.» |
| 85–105s | Baja de vuelta a 5. Rival A: 106.502,40 → 100.585,60. Puntos: 46,4211 → 43,8421. «Supuestos declarados» visible. | «Si el escenario cambia, la puntuación cambia: 43,84 puntos. Es condicional a las hipótesis, no una predicción de ganar.» |
| 105–130s | Restaurar rival A. Baja a 30. KPI anormalidad: «Posible necesidad de justificación». Subtítulo: «presunción condicional, no exclusión automática». | «Con baja del 30 %, el motor marca posible necesidad de justificación según la regla de Tías. Es una presunción, nunca una exclusión.» |
| 130–150s | «Ver cálculo»: traza paso a paso, regla proportional_inverse rev., motor, empresa rev. «Supuestos declarados» y curva precio-puntos. | «Cada cifra muestra su cálculo: fórmula, mejor oferta incluyendo la propia y supuestos. Sin otra llamada de IA.» |
| 150–170s | «Comparar escenarios»: nombre, «Guardar escenario» → «Abrir en Informe». Informe: detalle, hash snapshot de 64 hex, hipótesis, pendientes, fuentes. Decisión manual «Preparar oferta», nota, «Exportar informe». | «Guardamos el escenario: valores y hash idénticos tras recargar. La decisión la toma la persona; el informe conserva fuentes y pendientes.» |
| 170–180s | «Descargar HTML». Cierre en Resumen con badge Demo curada. | «Del documento a una decisión trazable: requisitos, precio y alerta, con páginas y cálculos. La empresa decide.» |

## Límites que se declaran en el vídeo

- Extracción curada manualmente; integración Meta en vivo pendiente en el frontal (G3 parcial: solo smoke real).
- Empresa y rivales sintéticos; historic no entrena ningún predictor.
- Sin probabilidades de ganar ni CTA de «optimizar para ganar».
- No se muestra instalación, claves ni recuperaciones no medidas.

## Evidencia por bloque (trazabilidad, no se lee en el vídeo)

- Carga ejemplo + badge + offline: tests/e2e/e01-e02-e09-demo.spec.ts (E01).
- Requisito unknown + p. 6 de 41 + cita 207.088: E02.
- Baja 5→15, precio/beneficio/puntos/traza: tests/e2e/e03-e06-pricing.spec.ts (E03).
- Rival A → 43,8421, sin probabilidades: E04.
- Baja 30 % → presunción, sin «excluida»: E05.
- Unknown rivales/grupos, cifras intactas: E06 (reserva si sobra tiempo).
- Guardar → recargar → hash idéntico + empresa rev. 1: tests/e2e/e07-e08-scenarios-report.spec.ts (E07).
- Informe HTML con regla, snapshot, sintéticas, pendientes, sin secretos: E08.
- Números esperados: fixtures/demo/expected.json (90000.00, 106502.40, 110052.48; 5/15/30 %).
