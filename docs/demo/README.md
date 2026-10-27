# Pack de demo para revisores (jueces, humanos o modelos)

BidLab ayuda a una pyme a decidir si pujar a una licitación: lee el
pliego, extrae requisitos con citas por página y simula precios con un
motor determinista. Caso real: licitación 2026/00006554N del
Ayuntamiento de Tías (Lanzarote).

## Ver en 2 minutos (sin instalar nada)

| Pantalla | Qué demuestra |
|---|---|
| [01-resumen.png](01-resumen.png) | Resumen: plazo, presupuesto, qué puntúa |
| [02-precio.png](02-precio.png) | Pricing Lab: conclusión, puntos, anormalidad |
| [03-curva.png](03-curva.png) | Curva precio→puntos con rivales supuestos |
| [04-citas.png](04-citas.png) | Citas verificables contra el pliego |
| [05-requisitos.png](05-requisitos.png) | Matriz de requisitos (cumple / no / sin datos) |
| [06-informe.png](06-informe.png) | Informe exportable con fuentes y pendientes |
| [07-evidencia-drawer.png](07-evidencia-drawer.png) | Panel de evidencia con página del pliego |
| [08-movil.png](08-movil.png) | Móvil: no rompe (desktop-first, sin diseño móvil dedicado) |

![Resumen](01-resumen.png)
![Precio](02-precio.png)

## Probar en 5 minutos

```sh
uv sync --all-packages && npm install
python scripts/demo.py --reset-demo   # API + semilla demo
npm run dev -w apps/web               # web en 127.0.0.1:5173
```

Abrir <http://127.0.0.1:5173/>, botón demo → workspace `/tenders/tias`.
Sin claves ni red: la demo es 100 % offline (los E2E abortan cualquier
petición no-loopback). Guion de 180 s: [demo-script-180s](../demo-script-180s.md).

## Dónde mirar el código

- Motor determinista (precio, puntos, presunción de anormalidad 18.5):
  `apps/api/bidlab/domain/` + `services/evaluation.py`
- Contratos API: `docs/API_CONTRACT.yaml`
- Frontend (React, español claro, guía de voz): `apps/web/src/`,
  textos centralizados en `lib/` + [voice-guide](../voice-guide-es.md)
- Tests: `apps/api/tests/` (229), `apps/web/src/**/*.test.ts` (109),
  `tests/e2e/` (27 Playwright herméticos)

## Evidencia de calidad

- CI verde en GitHub Actions (18 pasos: pytest, lint, typecheck,
  build, vitest, ruff, mypy, Playwright): badge en el README.
- `python scripts/verify.py` → 10/10 puertas, exit 0.
- Log de verificación con evidencia real: [verification-log](../verification-log.md).
- Auditoría UX externa aplicada + 4 jueces ≥ 9.5/10: [ux-review](../ux-review.md).

## Límites honestos (no fingimos más)

- Un tender real (Tías); precios de rivales y costes, sintéticos y rotulados.
- Sin todas las ofertas reales no hay predicción de adjudicación.
- `unknown` es `null`, nunca cero; la anormalidad es presunción, no exclusión.
- Histórico P1 aparcado; móvil solo "no rompe"; sin `LICENSE` aún (T32).

## Qué feedback nos sirve

1. ¿La conclusión de cada pantalla se entiende en 5 segundos?
2. ¿Algún número sin redondear, jerga sin explicar o contraste pobre?
3. ¿El motor de precio/anormalidad tiene algún caso borde mal tratado?
4. ¿Qué quitarías para simplificar (menos es más)?
