# BidLab — social kit (submission)

Status: DRAFT. The author reviews, adapts, and sends every post from
their own account. Nothing here has been published. Numbers copied
from `docs/submission-draft.md` and `fixtures/demo/expected.json`;
re-check before sending. Video link is still NC (no video recorded).
Links: add UTMs per `docs/launch-plan.md`
(`utm_source=x|linkedin&utm_medium=social&utm_campaign=bidlab-submission`).

Voice rules applied (`social` skill + `docs/copy-style-es.md`): no
contrast reveals ("it's not X, it's Y"), no negation lists, no
broetry, no engagement bait, no em dashes in posts, no emoji bullets.
ES posts use tuteo, sentence case, and the licitación glossary
(pliego, baja, oferta, puntuación, anormalidad, escenario, informe,
cita, hipótesis, pendiente, empresa sintética).

Story line (all posts): Understand the rule. Compare the trade-off.
Keep the decision. / Entiende la regla. Compara. Guarda.

---

## 1. Announcement (X/LinkedIn, with demo video)

EN (DRAFT):

> We built BidLab for the hackathon: a real 41-page Spanish tender
> (PAI Tías 2026/00006554N, net budget 118,336 EUR, 49 price points)
> turned into a traceable bid decision.
>
> Understand the rule. Compare the trade-off. Keep the decision.
> Demo (3-minute target, once recorded): [video link]
>
> Repo: https://github.com/iggykimi/bidlab

ES (DRAFT):

> Para el hackathon construimos BidLab: un pliego real de 41 páginas
> (PAI de Tías 2026/00006554N, PBL neto 118.336 euros, 49 puntos de
> precio) convertido en una decisión trazable.
>
> Entiende la regla. Compara. Guarda. Demo (objetivo 3 minutos,
> pendiente de grabar): [enlace al vídeo]
>
> Repo: https://github.com/iggykimi/bidlab

## 2. Demo clip caption (native video, 30–60 s cut)

Suggested cut: script block 5–6 (discount 5 → 15 %: price
100,585.60, profit 10,585.60, 49.0000 points; gap of 11,833.60 vs
5 %). Show the end result in the first 3 seconds. Add subtitles;
most views are silent.

EN (DRAFT):

> One slider, full trace. Moving the discount from 5 % to 15 %
> reaches 49.0000 points at 100,585.60 EUR, and costs 11,833.60 EUR
> of estimated profit. Every figure shows its formula and assumptions.
>
> Full demo (once recorded): [video link]

ES (DRAFT):

> Un deslizador, traza completa. Al pasar la baja del 5 % al 15 %,
> llegas a 49,0000 puntos con 100.585,60 euros, y cedes 11.833,60
> euros de beneficio estimado. Cada cifra muestra su cálculo.
>
> Demo completa (pendiente de grabar): [enlace al vídeo]

## 3. Technical thread (X, 6 posts)

EN (DRAFT):

1. How BidLab keeps a tender demo honest, technically. A short
   thread on our hackathon submission.
2. Money and points live in Python `Decimal`. The API returns
   decimal strings. The frontend renders and computes nothing.
3. Requirements carry verdicts: met, not met, or unknown. The
   technical threshold stays unknown with its quote on PCAP p. 6.
4. The anomaly check outputs a conditional presumption ("possible
   justification required" at 30 % discount), never an exclusion.
5. Scenarios are immutable: save, reload, identical values and
   64-hex snapshot hash. The HTML report keeps decision, note,
   pendings, hypotheses, and sources. No secrets inside.
6. Tested: 229 backend tests, 109 web unit, 27 Playwright E2E on a
   real local API plus web, loopback only. Repo:
   https://github.com/iggykimi/bidlab

ES (DRAFT):

1. Cómo mantiene BidLab la honestidad de una demo de licitación,
   en lo técnico. Hilo corto sobre nuestro proyecto.
2. Dinero y puntos viven en `Decimal` en Python. La API devuelve
   cadenas decimales. El frontal pinta y no calcula nada.
3. Los requisitos tienen veredicto: cumple, no cumple o por
   verificar. El umbral técnico queda por verificar con su cita
   en PCAP p. 6.
4. El control de anormalidad devuelve una presunción condicional
   («posible necesidad de justificación» con baja del 30 %),
   nunca una exclusión.
5. Los escenarios son inmutables: guarda, recarga, valores y hash
   idénticos. El informe HTML conserva decisión, nota, pendientes,
   hipótesis y fuentes. Sin secretos dentro.
6. Probado: 229 tests de backend, 109 unit de web, 27 E2E
   Playwright sobre API y web locales reales, solo loopback.
   Repo: https://github.com/iggykimi/bidlab

## 4. Judge pitch (submission gallery / short post)

EN (DRAFT):

> BidLab: understand the rule, compare the trade-off, keep the
> decision. We modelled the actual PAI Tías tender (118,336 EUR
> net, 49 price points): page-cited requirements, price scenarios
> under explicit hypotheses, and an exportable HTML report.
> Unknowns stay unknown. No win prediction anywhere.
> Demo (once recorded): [video link]

ES (DRAFT):

> BidLab: entiende la regla, compara y guarda. Modelamos la
> licitación real del PAI de Tías (118.336 euros netos, 49 puntos
> de precio): requisitos con cita, escenarios bajo hipótesis
> declaradas e informe HTML exportable. Lo pendiente queda
> pendiente. Sin predicción de adjudicación. Demo (pendiente
> de grabar): [enlace al vídeo]

## 5. Author bio note (profile / submission "team" field)

EN (DRAFT):

> [Name] built BidLab for [hackathon name]: a decision lab that
> turns a real Spanish tender into page-cited requirements and
> deterministic price scenarios. One developer, one real
> 41-page pliego, zero invented certificates.

ES (DRAFT):

> [Nombre] construyó BidLab para [nombre del hackathon]: un
> laboratorio que convierte una licitación real en requisitos
> con cita y escenarios de precio deterministas. Una persona,
> un pliego real de 41 páginas, cero certificados inventados.
