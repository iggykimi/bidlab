# Pack de demo para revisores (humanos o modelos)

BidLab ayuda a una pyme a decidir si pujar a una licitación: lee el
pliego, extrae requisitos con citas por página y simula precios con un
motor determinista. Caso real: licitación 2026/00006554N del
Ayuntamiento de Tías (Lanzarote).

## Ver en 2 minutos (sin instalar nada)

Capturas 01–10 regeneradas el 29-oct-2026 (post-V3, issue #4) con
`npx playwright test -c scripts/demo-shots/playwright.shots.config.ts shots.spec`
(base separada de la suite E2E, nombres legibles, UI asentada):
01/03/06/07/10 cambiaron con la UI V3 (spotlight, meseta, duelo,
proof trail, banner de malla); 02/04/05/08/09 salieron byte-idénticas.
El estado pre-V3 se conserva en [v3-before/](v3-before/)
(copiado antes de regenerar, sin retocar).

| Pantalla | Qué demuestra |
|---|---|
| [01-resumen.png](01-resumen.png) | Resumen: plazo, presupuesto, qué puntúa |
| [02-precio.png](02-precio.png) | Precio: conclusión, puntos, anormalidad |
| [03-curva.png](03-curva.png) | Curva precio→puntos con rivales supuestos |
| [04-citas.png](04-citas.png) | Citas verificables contra el pliego |
| [05-requisitos.png](05-requisitos.png) | Matriz de requisitos (cumple / no / sin datos) |
| [06-informe.png](06-informe.png) | Informe exportable con fuentes y pendientes |
| [07-evidencia-drawer.png](07-evidencia-drawer.png) | Panel de evidencia con página del pliego |
| [08-movil.png](08-movil.png) | Móvil: no rompe (desktop-first, sin diseño móvil dedicado) |
| [09-radar.png](09-radar.png) | Revisar: radar sin pares + ejemplo sintético rotulado (T20) |
| [10-techo.png](10-techo.png) | Malla: techo de coste con disclaimers (T21) |

![Resumen](01-resumen.png)
![Precio](02-precio.png)

Capturas V5 jurado (29-oct-2026, offline, con SHA en
[FINAL_HEAD_VALIDATION](../FINAL_HEAD_VALIDATION.md)): 2 UI
([u1](../../evidence/jury/u1-expert-state.png),
[u2](../../evidence/jury/u2-compare-10v15.png)) + 4 renders del corpus
sintético (S04/S07/S08/S12 en [evidence/jury/](../../evidence/jury/)).
Ninguna finge una extracción Meta live.

## Matriz V3 (§8): 8 escenas × 5 anchos

Capturada el 29-oct-2026 con
`npx playwright test -c scripts/demo-shots/playwright.shots.config.ts v3-shots`
(misma semilla demo, almacenamiento fresco por ejecución, nombres por ancho).
Cada escena se asienta (fuentes, red, toasts) antes de capturar; la fila
«Gráfica y Pareto» del prompt se desdobla en s4/s5 para no recortar.

| Escena | 1440 | 1024 | 768 | 390 | 320 | Qué demuestra |
|---|---|---|---|---|---|---|
| s1 biblioteca/CTA | [png](v3/1440/s1-lib.png) | [png](v3/1024/s1-lib.png) | [png](v3/768/s1-lib.png) | [png](v3/390/s1-lib.png) | [png](v3/320/s1-lib.png) | Primer CTA sin scroll; estado vacío honesto |
| s2 hero | [png](v3/1440/s2-hero.png) | [png](v3/1024/s2-hero.png) | [png](v3/768/s2-hero.png) | [png](v3/390/s2-hero.png) | [png](v3/320/s2-hero.png) | Veredicto spotlight con la pareja oro |
| s3 precio | [png](v3/1440/s3-pricing.png) | [png](v3/1024/s3-pricing.png) | [png](v3/768/s3-pricing.png) | [png](v3/390/s3-pricing.png) | [png](v3/320/s3-pricing.png) | Simulador + hero comparador + duelo |
| s4 curva | [png](v3/1440/s4-curva.png) | [png](v3/1024/s4-curva.png) | [png](v3/768/s4-curva.png) | [png](v3/390/s4-curva.png) | [png](v3/320/s4-curva.png) | Meseta, leyenda HTML, sin solapes |
| s5 frontera | [png](v3/1440/s5-frontera.png) | [png](v3/1024/s5-frontera.png) | [png](v3/768/s5-frontera.png) | [png](v3/390/s5-frontera.png) | [png](v3/320/s5-frontera.png) | Pareto con motivos exactos |
| s6 malla | [png](v3/1440/s6-malla.png) | [png](v3/1024/s6-malla.png) | [png](v3/768/s6-malla.png) | [png](v3/390/s6-malla.png) | [png](v3/320/s6-malla.png) | Banner «resultado anterior» antes de la conclusión |
| s7 evidencia | [png](v3/1440/s7-evidencia.png) | [png](v3/1024/s7-evidencia.png) | [png](v3/768/s7-evidencia.png) | [png](v3/390/s7-evidencia.png) | [png](v3/320/s7-evidencia.png) | Drawer + proof trail de 4 estados |
| s8 estado | [png](v3/1440/s8-estado.png) | [png](v3/1024/s8-estado.png) | [png](v3/768/s8-estado.png) | [png](v3/390/s8-estado.png) | [png](v3/320/s8-estado.png) | Error honesto (coste vacío bloquea la malla) |

Revisadas a ojo: sin colisiones de etiquetas, sin scroll horizontal global
(fijado además por E2E en 320/390/640/1280), drawer usable a 320.
El zoom 200% se equivale a 640 CSS px (ver `tests/e2e/curve-v3.spec.ts`).
Vacío/carga además del error: cubiertos por E2E, no por foto.

## Probar en 5 minutos

```sh
uv sync --all-packages && npm install
python scripts/demo.py --reset-demo   # API + semilla demo
npm run dev -w apps/web               # web en 127.0.0.1:5173
```

Abrir <http://127.0.0.1:5173/>, botón demo → workspace `/tenders/tias`.
Sin claves ni red: la demo es 100 % offline (los E2E abortan cualquier
petición no-loopback). Guion de 180 s: [demo-script-180s](../demo-script-180s.md).
Caso oro: rebajas del 10 % y del 15 % dan los mismos 49 puntos, pero el
10 % conserva 5916,80 € más de beneficio (fijado por CMP-02).
Recorrido propio offline: «Nueva licitación» → alta + PDF + empresa +
análisis + revisión manual + simular + comparar + exportar
(fijado por tests/e2e/own-journey.spec.ts).

## Dónde mirar el código

- Motor determinista (precio, puntos, presunción de anormalidad 18.5):
  `apps/api/bidlab/domain/` + `services/evaluation.py`
- Contratos API: `docs/API_CONTRACT.yaml`
- Frontend (React, español claro, guía de voz): `apps/web/src/`,
  textos centralizados en `lib/` + [voice-guide](../voice-guide-es.md)
- Tests (contados el 29-oct-2026 en este árbol, ver
  [verification-log](../verification-log.md), código @`c179813`):
  backend 565 passed + 1 skipped + 1 deselected (live opt-in),
  web 259 en 33 ficheros (`npm run test:unit`),
  E2E 98 herméticos (Chromium, loopback; 2 pasadas verdes).
- V5 (29-oct-2026, ver [verification-log](../verification-log.md) §V5):
  backend 588 passed + 1 skipped, web 260 en 33 ficheros,
  E2E 98 (incl. qa-visual/axe 6/6), verify.py 10/10 exit 0.
  Puertas completas en verde el 29-oct
  (`python scripts/verify.py`, 10/10, exit 0) + dos ensayos
  limpios R1+R2 (V2).

## Evidencia de calidad

- Puertas locales (sin CI remota, por decisión del autor):
  `uv run python scripts/verify.py` → 10 puertas (deps, pytest unit,
  pytest integración+contratos, eslint, tsc, build, vitest, ruff,
  mypy, Playwright): ALL CHECKS PASSED, exit 0, el 29-oct
  (tour + malla + contrato stress incluidos).
- Log de verificación con evidencia real: [verification-log](../verification-log.md).
- Auditoría UX externa aplicada: [ux-review](../ux-review.md).

## Límites honestos (no fingimos más)

- Un tender real (Tías); precios de rivales y costes, sintéticos y rotulados.
- Sin todas las ofertas reales no hay predicción de adjudicación.
- `unknown` es `null`, nunca cero; la anormalidad es presunción, no exclusión.
- Sin Meta en vivo en el frontal (solo smoke backend); empresa y rivales
  sintéticos; sin predicción.
- Histórico P1 aparcado; móvil solo "no rompe"; sin `LICENSE` aún (T32).
- Footage real sin narración ([footage-oro-20261028.webm](footage-oro-20261028.webm), flujo oro, regrabado post-paquete con UI actual); vídeo narrado pendiente; sin envío (pendiente del autor).

## Qué feedback nos sirve

1. ¿La conclusión de cada pantalla se entiende en 5 segundos?
2. ¿Algún número sin redondear, jerga sin explicar o contraste pobre?
3. ¿El motor de precio/anormalidad tiene algún caso borde mal tratado?
4. ¿Qué quitarías para simplificar (menos es más)?
