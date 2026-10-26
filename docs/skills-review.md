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
- [R] prototype — APPLY solo bajo invocación explícita (variantes contested)
- [R] mobile-native — APPLY polish bajo (snippet baseline + safe-area; verificar en hardware)
- [R] ask-sonner — leída completa propia + APPLY (ref autoridad F7 sonner)
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
- [R] sleek-design-mobile-apps — N/A (API móvil ajena)
- [R] canvas-design — N/A (arte .png, opuesto a UI densa)
- [R] extract-design-system — auditada + N/A on-demand (solo si seed desde referencia)
- [R] frontend-design (vercel-labs/agent-eval) — APPLY subset (tokens/type/restraint; no maximalismo)
- [R] frontend-ui-engineering (addyosmani) — APPLY como build gate (mejor encaje BidLab)
- [R] premium-frontend-ui — APPLY subset perf (transform/opacity, reduced-motion, clamp)
- [ ] design-taste-frontend-v1 — N/A pendiente confirmar (slug inexistente, cubierto por user)
- [ ] design-taste-frontend-v2-experimental — N/A pendiente confirmar (slug inexistente)

## Diseño (user-level, ya disponibles)
- [R] frontend-design (anthropics) — leída completa 26-oct
- [R] design-taste-frontend — N/A bulk (landing-only, exige dark) / APPLY subset a11y (contraste, labels, skeletons, active)
- [R] high-end-visual-design — N/A estilos / APPLY subset perf (transform/opacity, dvh, blur solo fixed)
- [R] web-design-guidelines — APPLY como review gate (fetch reglas frescas)
- [R] impeccable — APPLY modo Operate (scanability, harden errores/i18n, audit acotado)
- [ ] copywriting

## Workflows (19)
- [R] agent-browser, skill-creator, browser-use — SKIP (tool/meta, sin cambio workflow)
- [R] brainstorming — ADOPT (hard-gate diseño pre-plan)
- [R] systematic-debugging — auditada 26-oct (C1: fix en origen, unificar dispatch)
- [R] writing-plans — ADOPT (plan contract: header+Interfaces+TDD+Review Focus)
- [R] executing-plans — SKIP (contradice subagentes acotados)
- [R] test-driven-development — auditada 26-oct (C15 change-detector → borrar)
- [R] requesting-code-review — auditada 26-oct (calibración fortalezas/debilidades)
- [R] subagent-driven-development — ALREADY (es nuestro workflow)
- [R] verification-before-completion — auditada 26-oct (gaps E2E)
- [R] dispatching-parallel-agents — ADOPT (paralelo solo en investigaciones/fixes independientes)
- [R] using-git-worktrees — ADOPT (step-0 isolation detect)
- [R] finishing-a-development-branch — ADOPT (exit gate)
- [R] ralph-tui-prd, ralph-tui-create-beads, ralph-tui-create-json, ralph-wiggum, ralph-loop-workflow — SKIP (trackers ajenos / loops sin gates)

## Testing (3)
- [R] webapp-testing — auditada 26-oct (suite: behavior sí, oráculos independientes sí)
- [R] playwright-best-practices — auditada 26-oct (selectores/wait OK; falta console-error fail, E10 anotar)
- [R] playwright-cli — APPLY (debug loop interactivo + locators + repros grabadas)

## Next.js (5)
- [R] vercel-react-best-practices — FIT parcial (subset React genérico para SPA; ya auditada)
- [R] deploy-to-vercel, turborepo, ai-sdk, next-cache-components-adoption — N/A (sin Next/Vercel/TS-AI)
- [N] next-best-practices — repo movido a vercel/next.js, slug inexistente

## Mobile (5)
- [R] vercel-react-native-skills, expo-native-ui, expo-data-fetching, expo-upgrade — N/A (sin app móvil). Robos: loading/error/empty/content por pantalla, isLoading-vs-isFetching, doctor-gate tras cambios deps.
- [N] expo-tailwind-setup — slug inexistente en expo/skills

## Databases (13)
- [R] TODAS analizadas 26-oct: N/A funcional (SQLite+SQLAlchemy loopback). Robos: partial-index+EXPLAIN discipline, no unbounded collect (paginate/take), cursor>OFFSET, batch inserts, migration-first Alembic+drift-check CI, FK-index+transactions-for-multistep.

## Marketing (20)
- [R] launch, social, content-strategy, page-cro(cro), analytics, competitors — aplicadas 26-oct (docs/launch-plan.md + docs/social-kit.md)
- [R] copywriting (marketingskills) — aplicada 26-oct (docs/copy-style-es.md)
- [R] seo-audit — APPLY light (title/meta/H1 en demo+README)
- [R] marketing-psychology — APPLY (pitch JTBD+contraste+peak-end)
- [R] programmatic-seo, pricing, emails, ads, paywalls, popups, cold-email, ad-creative, churn-prevention, lead-magnets — N/A (robos: no-AI-tells, PAS/BAB, peer-voice, feedback-form, one-pager)
- [R] schema — APPLY light (JSON-LD SoftwareApplication @graph)
- [R] ai-seo — APPLY (llms.txt + extractabilidad docs)

## Imagen (2)
- [R] imagegen-frontend-web — N/A producto (prohíbe single-image); póster vía image-gen plano + prompt tight
- [R] imagegen-frontend-mobile — N/A (solo apps móvil)

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
- [R] receiving-code-review — ADOPT (disciplina veredicto reviewer)
- [R] validate-evaluator, write-judge-prompt — FIT (solo si hay judge LLM futuro; infra rechazada P0)

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
### FE wave A review (26-oct): PASS. Pendientes post-BoN: O4 details (fix ::details-content o drop claim), O1 exit drawer (delayed unmount), PricingLab:429 → <Alert>, tokens (CurveChart hexes, #fff sticky), 3 comentarios stale, axe-core ausente (integrar), flags=OK (noUncheckedIndexedAccess presente).
NOTA E2E: no correr 2 suites Playwright a la vez (mismos puertos/storage) — causó 6 fallos espurios 26-oct; aislar o serializar.
