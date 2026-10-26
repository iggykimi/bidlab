# Skills super-review — registro

91 skills repo-local (`.agents/skills/`) + equivalencias user-level.
Flujo por skill: LEER completa → encaje BidLab? → APLICAR (subagente) o N/A motivado → DESINSTALAR del repo.
Al final: purga dead code + refactorización.

Leyenda: [ ] pendiente · [R] leída · [A] aplicada · [N] N/A · [X] desinstalada

## Emil Kowalski (15)
- [R] review-animations — auditada 26-oct: BLOCK a CurveChart (line-draw 1500ms por tick → borrar)
- [R] break-ui — auditada 26-oct (F8 NaN, F10 overflow, F14 empty states)
- [R] apple-design — auditada 26-oct (contraste, reduced-motion, system-ui OK)
- [R] pick-ui-library — auditada 26-oct (cva+clsx, base-ui Dialog, sonner, keep recharts)
- [R] prototype — auditada 26-oct
- [R] mobile-native — auditada 26-oct (F3 targets, F4 16px, viewport-fit, safe-area)
- [R] ask-sonner — auditada 26-oct (F7: Toaster + toast.success en export)
- [R] animate — leída completa propia + auditada por subagente
- [R] animate-expo — auditada por subagente (lectura propia pendiente)
- [R] animation-performance — auditada por subagente (lectura propia pendiente)
- [R] animation-vocabulary — auditada por subagente (lectura propia pendiente)
- [ ] apple-design
- [ ] ask-sonner
- [ ] break-ui
- [R] emil-design-eng — leída completa (674 líneas)
- [R] find-animation-opportunities — leída completa
- [R] improve-animations — leída completa
- [ ] mobile-native
- [ ] pick-ui-library
- [ ] prototype
- [N] write-swift — sin target Swift en el repo

## Diseño (repo-local)
- [R] vercel-composition-patterns — auditada 26-oct (F15: variant components, no boolean props)
- [R] ui-ux-pro-max — auditada 26-oct (F3 44px, F5 listas indistinguibles, F6 tabs APG)
- [R] sleek-design-mobile-apps — auditada 26-oct
- [R] canvas-design — auditada 26-oct (N/A funcional: charts son SVG/recharts, no canvas)
- [R] extract-design-system — auditada 26-oct (F2: 164 hexos raw, tokens sin usar)
- [ ] frontend-design (vercel-labs/agent-eval)
- [R] frontend-ui-engineering (addyosmani) — auditada 26-oct
- [R] premium-frontend-ui — auditada 26-oct (veredicto: NO aplicar restyle inmersivo)
- [ ] design-taste-frontend-v1 — N/A pendiente confirmar (slug inexistente, cubierto por user)
- [ ] design-taste-frontend-v2-experimental — N/A pendiente confirmar (slug inexistente)

## Diseño (user-level, ya disponibles)
- [R] frontend-design (anthropics) — leída completa 26-oct
- [ ] design-taste-frontend
- [ ] high-end-visual-design
- [ ] web-design-guidelines
- [ ] impeccable (cubre polish/critique/bolder/delight/distill/quieter)
- [ ] copywriting

## Workflows (19)
- [ ] agent-browser, skill-creator, brainstorming
- [R] systematic-debugging — auditada 26-oct (C1: fix en origen, unificar dispatch)
- [ ] writing-plans, executing-plans
- [R] test-driven-development — auditada 26-oct (C15 change-detector → borrar)
- [R] requesting-code-review — auditada 26-oct (calibración fortalezas/debilidades)
- [ ] subagent-driven-development
- [R] verification-before-completion — auditada 26-oct (gaps E2E: console-errors, ramas API)
- [ ] dispatching-parallel-agents
- [ ] using-git-worktrees, finishing-a-development-branch, browser-use
- [ ] ralph-tui-prd, ralph-tui-create-beads, ralph-tui-create-json
- [ ] ralph-wiggum, ralph-loop-workflow

## Testing (3)
- [R] webapp-testing — auditada 26-oct (suite: behavior sí, oráculos independientes sí)
- [R] playwright-best-practices — auditada 26-oct (selectores/wait OK; falta console-error fail, E10 anotar)
- [ ] playwright-cli

## Next.js (5)
- [ ] vercel-react-best-practices, deploy-to-vercel, turborepo, ai-sdk
- [ ] next-cache-components-adoption
- [N] next-best-practices — repo movido a vercel/next.js, slug inexistente

## Mobile (5)
- [ ] vercel-react-native-skills, expo-native-ui, expo-data-fetching
- [ ] expo-upgrade
- [N] expo-tailwind-setup — slug inexistente en expo/skills

## Databases (13)
- [ ] supabase-postgres-best-practices, supabase, firebase-basics
- [ ] firebase-auth-basics, firebase-firestore, convex-quickstart
- [ ] convex-auth, neon-postgres, postgres, mysql, turso-db
- [ ] query (duckdb), drizzle, drizzle-migrations

## Marketing (20)
- [ ] seo-audit, copywriting, marketing-psychology, content-strategy
- [ ] programmatic-seo, social, pricing, cro, launch, schema, emails
- [ ] ads, competitors, analytics, paywalls, popups, ai-seo, cold-email
- [ ] ad-creative, churn-prevention, lead-magnets

## Imagen (2)
- [ ] imagegen-frontend-web, imagegen-frontend-mobile

## Hallazgos super-review (handoff a escritores)
### Motion (26-oct, auditor solo-lectura)
- BLOCK: `CurveChart` recharts `isAnimationActive` (line-draw 1500ms por tick slider) → `false` + gate reduced-motion.
- O1 drawer `EvidenceDrawer` @starting-style translateX(100%)→0, 250ms drawer-curve + opacity 200ms (salida mismo borde; reduced: solo fade).
- O2 botones primarios `:active scale(0.97)`, 120ms ease-out (reduced: solo color).
- O3 KPIs crossfade opacity 150ms en keyed span (sin movimiento; compatible aria-live/E2E).
- O4 `<details>` grid-rows 0fr→1fr + opacity 200ms.
- O5 tabs fade 150ms (débil, descartable).
- Rechazado: mantener animación chart, number-tickers en KPIs.
### Diseño (26-oct, auditor solo-lectura, 14 skills)
- F1 drawer: bug stale-state (page no resync) + falsa modal (sin trap/scrim/lock) → key by id + base-ui Dialog o trap propio.
- F2 sistema: 164 hexos raw, 5 tokens sin usar, card/botón/error copiados ~20/6/14× → @theme + primitivas cva+clsx.
- F3 targets táctiles <44px (chips 22px, tabs 36px) + viewport sin fit=cover/theme-color.
- F4 inputs 14px → zoom iOS; pasar a 16px (7 sitios).
- F5 listas guardadas indistinguibles (id 8 chars) → nombre/fecha al guardar.
- F6 tabs sin ARIA APG (presentation, controls, roving).
- F7 export silencioso → sonner Toaster + toast.success.
- F8 format* renderiza NaN → guard → "—".
- F9 chart sin escape reduced-motion (ver Motion BLOCK).
- F10 overflow tokens largos (3 celdas) → break-all/anywhere.
- F11 cero feedback press/hover → :active scale + hover utilities.
- F12 thead sticky en tablas con scroll.
- F13 aria-live charla en scrub → estrechar región o aria-busy.
- F14 empty states en 2 tablas. F15 PricingLab 832 líneas (descomponer al tocar). F16 menores a11y/URL.
- NO tocar: dark mode/restyle, recharts/react-query, motion libs, toasts de error, copy honesta, user-scalable=no.
### Código/tests (26-oct, auditor solo-lectura, 7 skills)
- C1 DIVERGENCIA: producción (`evaluation.py:227`) vs dispatch muerto (`evaluate_anomaly`, 0 callers) en rglcap85 cierre-25 y unsupported. DECISIÓN LEAD: gana producción (RULE_ENGINE/T22 verificado: rglcap SIN cierre25, unsupported→not_applicable); unificar dispatch a producción, corregir test_anomaly:126-129, añadir integración rglcap por POST /scenarios/evaluate.
- C2 `eligibility._decimal` acepta Infinity→met / NaN→not_met engañoso → reutilizar `money.parse_decimal` + regresión.
- C3 idempotencia check→store con carrera → capturar conflicto en store, devolver respuesta ganadora + test concurrencia.
- C4 KPIs stale con input inválido → limpiar/marcar (frontend).
- C5 contrato anuncia createTender/uploadDocument/getHistory sin implementar → anotar unimplemented-by-design o implementar.
- C6 budget-exhaust no persiste traza (rollback) → decidir persist-then-raise + test.
- C7 html_path sin validar forma uuid-hex → validar.
- C8 list_tenders N+1 + paginación en Python → SQL al llegar 2º tender.
- C9 E2E storage compartido workers:1 → documentar o aislar por worker.
- C10 E2E sin console/page-error fail → añadir listener.
- C11 E10 waitForTimeout justificado → anotar como intencional.
- C12 recharts en bundle inicial → lazy CurveChart + Suspense.
- C13 añadir eslint-plugin-react-hooks.
- C14 E2E no pasa VITE_API_URL → pasar o asertar default.
- C15 borrar test_placeholder change-detector (versión ya pineada en test_health).
- C16 fixture DB copiada en 7 ficheros → conftest.py.
- C17 nits (OpName, depth, pyc stale, precisión curva 28→34).
- Suite: behavior sí, oráculos independientes sí, selectores/wait OK.
- DEAD: repositories.py, schemas/* shims, to_dict duplicados, OpName, evaluate_anomaly (tras C1), extract_pages sin cablear (tras C5), HistoricalAward, clamp sin caller; deps: openai, pdfplumber, python-multipart, pdfjs-dist, react-hook-form; exports: getTender, getHealth+Health, 4 type-alias, clearSession, scoreStatusEs, rateToDiscountPercent, scenarioNameInputSchema, RivalPrice.
- NO borrar aún: traces computadas (exponer o quitar — decisión), helpers dominio testeados (superficie pública intencional?), AuditEvent write-only (auditoría real), run_job retry (inaccesible sin ruta — decidir).
