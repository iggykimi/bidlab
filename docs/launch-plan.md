# BidLab — launch plan (hackathon submission)

Status: DRAFT. Author reviews, records, and sends everything. No organizer
contact was made by the agent.
Scope: submission + demo video + announcement only. No Product Hunt, no
paid ads, no public deployment (the app is local-only; no localhost URL
is ever presented as public).

Skills applied: `launch` (ORB, phased approach, readiness gate),
`content-strategy` (flagship + distribute), `social` (hooks, atoms),
`cro` (submission-page clarity), `analytics` (decide-first metrics,
UTM discipline), `competitors` (honest positioning).
Source of truth for claims: [submission-draft](submission-draft.md),
[demo-script-180s](demo-script-180s.md),
[verification-log](verification-log.md).

## 1. Readiness gate (launch skill)

Do not announce until all four hold:

- [ ] Demo video recorded from the script (≤180 s, 1280×720) and
      re-checked against the E2E evidence table in the script.
- [ ] Submission form filled from `submission-draft.md` only; every NC
      field resolved against the official rules by the author.
- [ ] Repo public at `https://github.com/iggykimi/bidlab`, main green,
      no secrets (`.env` never tracked), LICENSE decision made by the
      author (currently no LICENSE file — do not invent one).
- [ ] All numbers in posts match `fixtures/demo/expected.json`
      (cost 90000.00; rivals 106502.40 / 110052.48; 5/15/30 % cases).

## 2. Positioning (one thing, concrete)

One-liner (EN): "BidLab turns a real 41-page Spanish tender into a
traceable bid decision: page-cited requirements, price scenarios under
explicit hypotheses, and an exportable report with sources."
One-liner (ES): "BidLab convierte un pliego real de 41 páginas en una
decisión de oferta trazable: requisitos con cita de página, escenarios
de precio bajo hipótesis declaradas e informe exportable con fuentes."

What it is NOT (say it upfront, in the submission and the video):
no win prediction, no rival confidential data, no live extraction in
the demo UI (curated seed labelled "Datos de ejemplo"), one tender modelled,
synthetic company and rivals. Honesty is the differentiator; the
competitors skill rule applies: every claim must survive the rival's
own team reading it.

Proof points to repeat verbatim (never paraphrase numbers):

- Real tender PAI Tías 2026/00006554N, PBL neto 118.336 EUR, 49 price
  points, proportional-inverse rule (PCAP p. 10), anomaly rule
  (PCAP p. 20).
- Deterministic Python engine: money and points in `Decimal`, API
  returns decimal strings, the frontend computes nothing.
- Technical threshold stays "unknown / por verificar" with its quote
  on PCAP p. 6. BidLab does not invent certificates.
- Anomaly verdict is a conditional presumption ("possible
  justification required"), never an automatic exclusion.
- Scenarios immutable (64-hex snapshot hash, survives reload); HTML
  report with decision, note, pendings, hypotheses, sources, rule ids.
- Meta evidence: muse-spark-1.3 smoke PASS, HTTP 200, real inference,
  2026-10-26 (`evidence/meta_smoke_status.json`).
- Verification: 85 Playwright E2E green (incl. E01–E12, CMP-01–05,
  R01–R06, T15/T20 evidence; loopback only, 0 external calls);
  backend 557 + web 252 green; ruff + mypy clean;
  frontend lint/typecheck/build green; npm audit 0 vulns.

## 3. Channels (ORB, adapted to a hackathon)

Owned (everything funnels here):

- The submission itself + repo README. Treat the submission page as
  the landing page (cro): 5-second value prop = one-liner + "real
  tender, traceable decision, no win prediction". One primary CTA:
  watch the demo video. Secondary: read the repo.
- Demo video file (≤180 s). This is the flagship content atom source
  (content-strategy: one exceptional piece, repurposed everywhere).

Rented (pick two, both free, both where judges and devs look):

- X/Twitter: announcement + technical thread (drafts in
  [social-kit](social-kit.md)). No external link in the post body on
  day one if reach matters; link in reply/follow-up.
- LinkedIn: announcement post (ES or EN depending on the author's
  network) + demo clip as native video.

Borrowed (only warm, no cold spam):

- Hackathon showcase/event feed itself (the highest-leverage channel:
  judges already there).
- One community the author already belongs to (e.g. local dev meetup,
  TenderProcurement-adjacent forum, university channel). Provide value
  first: the "how we kept the demo honest" angle, not just the link.

Explicitly out of scope: marketplaces, newsletters, podcasts,
influencer outreach, paid promotion. A hackathon launch has one
conversion event (judges understand the project), not a funnel.

## 4. Timeline (author executes; times are relative to submission)

- T-2 days: record video from `demo-script-180s.md` after author
  review; run `python scripts/demo.py --reset-demo` first; check no
  keys, no non-loopback traffic, badge "Datos de ejemplo" visible.
- T-1 day: author fills submission from `submission-draft.md`;
  second pair of eyes (or fresh re-read) checks every number against
  `fixtures/demo/expected.json`; confirm LICENSE + NC fields.
- T day (submit): submit; push repo tag/commit referenced in the
  form; verify the public repo renders (README, no LFS/originals
  leak per `publication-manifest.json`).
- T+0 hours: post announcement (X + LinkedIn) with the demo video or
  its link. Author sends from their own account.
- T+1 day: post technical thread (X) + demo clip caption (LinkedIn
  native video, 30–60 s cut: the 60–100 s pricing block or the
  100–122 s compare block — show the end result in the first
  3 seconds per the social skill).
- T+3 days: judge-pitch repost only if the event has a public
  voting/gallery phase; otherwise stop. No drip campaign.
- After results: one retrospective post (what held up, what was
  honest-but-incomplete: G3 partial, live extraction pending).
  Then close the launch; further work follows the repo roadmap.

## 5. Content atoms (one video → five posts)

Cut from the single demo recording; each atom standalone-captioned:

1. Full video → announcement post.
2. 00:40–01:00 block → "unknown stays unknown" clip (differentiator).
3. 02:02–02:20 block → hypothesis-change clip (domain credibility).
4. Pricing Lab screenshots → technical thread visuals.
5. Report HTML screenshot (hash, sources) → judge-pitch visual.

All five drafts live in [social-kit](social-kit.md), marked DRAFT.

## 6. Metrics (analytics skill: track for decisions, not data)

The only decision: did judges and peers understand the project?
Minimal manual tracking (no GA4 property needed for a local-only
hackathon app; do not add tracking code to the repo for this):

| Question | Signal | How to read it |
|---|---|---|
| Was the submission understood? | Judges' questions/score | Submission platform feedback + results |
| Did the video hold attention? | Completion/views ratio | Platform-native stats on the hosted video |
| Did the repo get real reads? | Clones + README dwell, not stars | GitHub Insights traffic tab, 14-day window |
| Which message landed? | Replies/quotes per post | Manual count per post, same 7-day window |

Rules: lowercase-hyphen UTMs on every link the author controls
(`utm_source=x|linkedin`, `utm_medium=social`,
`utm_campaign=bidlab-submission`), one link per placement; never
divide full-period effort by partial-period results (match the
7-day window); report each channel's own numbers, no blended totals.
No PII in UTMs. Reconciliation: GitHub referrers vs. UTM-tagged
clicks must roughly agree before quoting any figure.

## 7. Risks and honesty guards

- Claiming live Meta extraction in the demo: forbidden. G3 is
  partial (smoke green, real extraction pending); the frontend
  "live analysis" button truthfully reports E09.
- Showing a localhost URL as a "live demo": forbidden. Submission
  says NC / local-only.
- Paraphrased numbers: forbidden. Copy figures from
  `fixtures/demo/expected.json` and the submission draft.
- Redistributing original PDFs: forbidden. They are research copies
  flagged in `publication-manifest.json`; the report embeds
  citations and links, not full documents.
- AI-tell copy ("it's not X, it's Y", "no X, no Y, no Z",
  engagement bait): forbidden in all posts — see the social-kit
  drafts, already written to the `social` + `copy-style-es` rules
  (tuteo, sentence case, glosario de licitación, sin exclamaciones).
