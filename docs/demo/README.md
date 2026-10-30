# BidLab in screenshots

Real captures of the running app (offline demo, 1280×720 unless noted), regenerated with
`npx playwright test -c scripts/demo-shots/playwright.shots.config.ts demo-shots/shots.spec`.
The example tender is real (Ayuntamiento de Tías, expediente 2026/00006554N); the company
costs and rival bids are synthetic and labelled «Datos de ejemplo» on every screen.

| Screen | What it shows |
|---|---|
| [01-resumen.png](01-resumen.png) | Summary: deadline, budget, what scores, and the decision trail |
| [02-precio.png](02-precio.png) | Pricing lab: discount slider, price, profit, points, abnormal-offer check |
| [03-curva.png](03-curva.png) | Price-to-points curve with the plateau where extra discount stops paying |
| [04-citas.png](04-citas.png) | Every extracted figure with its page and exact quote |
| [05-requisitos.png](05-requisitos.png) | Eligibility matrix: met, not met or «Por verificar», never a guess |
| [06-informe.png](06-informe.png) | Decision record with note, pending checks and sources |
| [07-evidencia-drawer.png](07-evidencia-drawer.png) | Evidence panel: source → review → rule → decision |
| [08-movil.png](08-movil.png) | Phone layout (390 px): the rebate field stays in the first screen |
| [09-radar.png](09-radar.png) | Inconsistency radar on your own tender, with a labelled synthetic example |
| [10-techo.png](10-techo.png) | Cost ceiling: the highest cost that still meets your points and profit targets |

Renders of the synthetic adversarial corpus used for the live Muse Spark evaluation
(lots, long partial document, prompt injection, ambiguous formula) are in
[`evidence/jury/`](../../evidence/jury/). None of these images pretends to be a live run.

## Video

The 180-second demo is built as code in [`video/`](../../video/): Playwright captures the real
app at 1920×1080 and Remotion composes the camera moves and captions. Narration script and
recording steps: [`video/README.md`](../../video/README.md).

## Try it in five minutes

```sh
uv sync --all-packages && npm install && npm run build
python scripts/demo.py --reset-demo        # http://127.0.0.1:8000/ → «Cargar ejemplo»
```

The demo runs fully offline; the E2E suite aborts any non-loopback request.
