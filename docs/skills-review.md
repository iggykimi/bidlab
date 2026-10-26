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
- [ ] agent-browser, skill-creator, brainstorming, systematic-debugging
- [ ] writing-plans, executing-plans, test-driven-development
- [ ] requesting-code-review, subagent-driven-development
- [ ] verification-before-completion, dispatching-parallel-agents
- [ ] using-git-worktrees, finishing-a-development-branch, browser-use
- [ ] ralph-tui-prd, ralph-tui-create-beads, ralph-tui-create-json
- [ ] ralph-wiggum, ralph-loop-workflow

## Testing (3)
- [ ] webapp-testing, playwright-best-practices, playwright-cli

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
