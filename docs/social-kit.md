# BidLab — social kit (submission)

Status: DRAFT. The author reviews, adapts, and sends every post from
their own account. Nothing here has been published. Numbers copied
from `docs/submission-draft.md` and `fixtures/demo/expected.json`;
re-check before sending. Links: add UTMs per `docs/launch-plan.md`
(`utm_source=x|linkedin&utm_medium=social&utm_campaign=bidlab-submission`).

Voice rules applied (`social` skill + `docs/copy-style-es.md`): no
contrast reveals ("it's not X, it's Y"), no negation lists, no
broetry, no engagement bait, no em dashes in posts, no emoji bullets.
ES posts use tuteo, sentence case, and the licitación glossary
(pliego, baja, oferta, puntuación, anormalidad, escenario, informe,
cita, hipótesis, pendiente, empresa sintética).

---

## 1. Announcement (X/LinkedIn, with demo video)

EN (DRAFT):

> We built BidLab for the hackathon: a real 41-page Spanish tender
> (PAI Tías 2026/00006554N, net budget 118,336 EUR, 49 price points)
> turned into a traceable bid decision.
>
> Page-cited requirements, a deterministic pricing engine, and an
> exportable report with sources. The demo runs 3 minutes:
> [video link]
>
> Repo: https://github.com/iggykimi/bidlab

ES (DRAFT):

> Para el hackathon construimos BidLab: un pliego real de 41 páginas
> (PAI de Tías 2026/00006554N, PBL neto 118.336 euros, 49 puntos de
> precio) convertido en una decisión de oferta trazable.
>
> Requisitos con cita de página, motor de precio determinista e
> informe exportable con fuentes. La demo dura 3 minutos:
> [enlace al vídeo]
>
> Repo: https://github.com/iggykimi/bidlab

## 2. Demo clip caption (native video, 30–60 s cut)

Suggested cut: script block 60–85 s (discount 5 → 15 %: price
100,585.60, profit 10,585.60, 49.0000 points) or 105–130 s (30 %
discount → "possible justification required"). Show the end result
in the first 3 seconds. Add subtitles; most views are silent.

EN (DRAFT):

> One slider, full trace. Moving the discount from 5 % to 15 %
> reprices the bid to 100,585.60 EUR and 49.0000 points, and every
> figure shows its formula, best offer, and declared assumptions.
>
> Full 3-minute demo: [video link]

ES (DRAFT):

> Un deslizador, traza completa. Al pasar la baja del 5 % al 15 %,
> la oferta queda en 100.585,60 euros y 49,0000 puntos, y cada cifra
> muestra su fórmula, la mejor oferta y los supuestos declarados.
>
> Demo completa de 3 minutos: [enlace al vídeo]

## 3. Technical thread (X, 6 posts)

EN (DRAFT):

1. How BidLab keeps a tender demo honest, technically. A short
   thread on the architecture behind our hackathon submission.
2. Money and points live in Python `Decimal`. The API returns
   decimal strings. The frontend renders and computes nothing, so
   the number on screen is the number the engine produced.
3. Requirements carry verdicts: met, not met, or unknown. The
   technical threshold stays unknown with its quote on PCAP p. 6.
   The system says what it cannot verify.
4. The anomaly check outputs a conditional presumption ("possible
   justification required" at 30 % discount), never an automatic
   exclusion. Presumption is the domain-correct semantics.
5. Scenarios are immutable: save, reload, identical values and
   64-hex snapshot hash. The HTML report keeps decision, note,
   pendings, hypotheses, sources, and rule ids. No secrets inside.
6. Tested: 14 Playwright E2E specs on a real local API plus web,
   loopback only, zero external calls. Repo:
   https://github.com/iggykimi/bidlab

ES (DRAFT):

1. Cómo mantiene BidLab la honestidad de una demo de licitación,
   en lo técnico. Hilo corto sobre la arquitectura de nuestro
   proyecto para el hackathon.
2. Dinero y puntos viven en `Decimal` en Python. La API devuelve
   cadenas decimales. El frontal pinta y no calcula nada, así que
   la cifra en pantalla es la que produjo el motor.
3. Los requisitos tienen veredicto: cumple, no cumple o por
   verificar. El umbral técnico queda por verificar con su cita
   en PCAP p. 6. El sistema dice lo que no puede comprobar.
4. El control de anormalidad devuelve una presunción condicional
   («posible necesidad de justificación» con baja del 30 %),
   nunca una exclusión automática. La presunción es la semántica
   correcta del dominio.
5. Los escenarios son inmutables: guarda, recarga, valores y hash
   de instantánea de 64 hex idénticos. El informe HTML conserva
   decisión, nota, pendientes, hipótesis, fuentes y reglas.
   Sin secretos dentro.
6. Probado: 14 specs E2E Playwright sobre API y web locales
   reales, solo loopback, cero llamadas externas. Repo:
   https://github.com/iggykimi/bidlab

## 4. Judge pitch (submission gallery / short post)

EN (DRAFT):

> BidLab: from a real tender document to a traceable bid decision.
> We modelled the actual PAI Tías tender (118,336 EUR net, 49 price
> points): page-cited requirements, price scenarios under explicit
> hypotheses with a deterministic scoring engine, and an exportable
> HTML report with sources. Unknowns stay unknown, rivals are
> declared scenarios, and there is no win prediction anywhere.
> 3-minute demo: [video link]

ES (DRAFT):

> BidLab: del pliego real a una decisión de oferta trazable.
> Modelamos la licitación real del PAI de Tías (118.336 euros
> netos, 49 puntos de precio): requisitos con cita de página,
> escenarios de precio bajo hipótesis declaradas con motor de
> puntuación determinista e informe HTML exportable con fuentes.
> Lo pendiente queda pendiente, los rivales son escenarios
> declarados y no hay predicción de adjudicación en ningún punto.
> Demo de 3 minutos: [enlace al vídeo]

## 5. Author bio note (profile / submission "team" field)

EN (DRAFT):

> [Name] built BidLab for [hackathon name]: a decision lab that
> turns a real Spanish tender into page-cited requirements and
> deterministic price scenarios. One developer, one real
> 41-page pliego, zero invented certificates.

ES (DRAFT):

> [Nombre] construyó BidLab para [nombre del hackathon]: un
> laboratorio de decisión que convierte una licitación española
> real en requisitos con cita de página y escenarios de precio
> deterministas. Una persona, un pliego real de 41 páginas,
> cero certificados inventados.
