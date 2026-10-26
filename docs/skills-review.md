# Skills super-review — registro

91 skills repo-local (`.agents/skills/`) + equivalencias user-level.
Flujo por skill: LEER completa → encaje BidLab? → APLICAR (subagente) o N/A motivado → DESINSTALAR del repo.
Al final: purga dead code + refactorización.

Leyenda: [ ] pendiente · [R] leída · [A] aplicada · [N] N/A · [X] desinstalada

## Emil Kowalski (15)
- [R] review-animations — auditada 26-oct: BLOCK a CurveChart (line-draw 1500ms por tick → borrar)
- [R] break-ui — leída completa propia + auditada 26-oct (F8 NaN, F10 overflow, F14 empty states)
- [R] apple-design — leída completa propia + auditada 26-oct (contraste, reduced-motion, system-ui OK)
- [R] pick-ui-library — leída completa propia + auditada 26-oct (cva+clsx, base-ui Dialog, sonner, keep recharts)
- [R] prototype — auditada 26-oct
- [R] mobile-native — auditada 26-oct (F3 targets, F4 16px, viewport-fit, safe-area)
- [R] ask-sonner — auditada 26-oct (F7: Toaster + toast.success en export)
- [R] animate — leída completa propia + auditada por subagente
- [R] animate-expo — leída completa propia (N/A funcional: sin app Expo/RN)
- [R] animation-performance — leída completa propia
- [R] animation-vocabulary — leída completa propia
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

## React (3 nuevas; resto dup)
- [R] tailwind-design-system — leída propia (refuerza F2 @theme/tokens)
- [R] shadcn — leída propia (reglas estilos/composición como checklist review; sin adopción full)
- [R] typescript-advanced-types — leída propia (disciplina TS; ver FE10)

## Plan wave (9)
- [R] writing-openapi-specs — auditada 26-oct (O1-O10)
- [R] extract-openapi-from-code — auditada 26-oct (O1-O10)
- [R] fastapi — auditada 26-oct (O8, tags routers)
- [R] security-audit — guidance mode 26-oct (sin vulns; S1-S6)
- [R] code-review — leída 26-oct (sin run CLI; cubierto por gates)
- [R] copywriting (marketingskills) — aplicada 26-oct (docs/copy-style-es.md)
- [ ] receiving-code-review
- [ ] validate-evaluator, write-judge-prompt

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
APLICADO backend 26-oct (commit 87f2ea6, 205 tests, ruff/mypy verde): C1+C2+C3+C5+C6+C7+C15+C16+C17 + dead (repositories, shims, to_dict, OpName). Verificado por lead incl. oráculo RULE_ENGINE:110 (rglcap fail-closed). Pendiente: C4/C8-C14 (frontend/E2E, tras agente UI).
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
### OpenAPI (26-oct, auditor solo-lectura, 3 skills)
- O1 3 ops sin implementar con métodos muertos en SDKs → DECISIÓN: BORRAR del contrato + regen (verdad > compat con nada).
- O2 operationIds camelCase vs snake del skill + drift con auto-IDs app → renombrar contrato a snake + `operation_id=` explícitos en routers.
- O3 sin tags/summary/descriptions/examples (24/24) → tags por router + summary+description+examples.
- O4 ~250 bloques error idénticos, `Error.code` string libre → enum/literal + `components/responses` (corta el YAML a la mitad).
- O5 Money/Decimal/ID inlinados (113 clases, 6 money RootModel) → `components/schemas` + discriminator en oneOf + `components/parameters` para headers.
- O6 review acepta Idempotency-Key no declarado → declarar opcional.
- O7 CORS bloquea PUT companies (latente) → añadir PUT (ver S1).
- O8 health/capabilities sin response_model → tipar (ver py-9).
- O9 sin gate conformidad contrato↔app + versiones difieren (1.0.0 vs 0.1.0) → test conformidad + unificar versión.
- O10 sync OK + nits (page_size sin máximo, media_type PDF).
### Seguridad (26-oct, guidance mode, 2 skills): SIN vulnerabilidades confirmadas
- S1 CORS omite PUT (= O7) → añadir + verificar.
- S2 walkers árbol requisitos sin cota profundidad → MAX_TREE_DEPTH + 422 + test 500-deep.
- S3 precondiciones T14 (jail blob_path, handler PdfError→422/413/415, límite body upload).
- S4 CSP + nosniff en report HTML FileResponse.
- S5 nota deploy (bind real lo posee CLI uvicorn, no settings).
- S6 hmac.compare_digest en hashes idempotencia (higiene).
### Copy ES (26-oct, docs/copy-style-es.md): tú en UI, impersonal en backend, ERROR_ES map, 57 cambios (A12+B5+C36+D4). Ojo: C3 renombra pestaña → actualizar E2E; A-items pueden romper asertos exactos de tests → actualizar tests en el mismo diff.
