# BidLab — instrucciones para Muse Code

## Objetivo y autoridad
Implementa el producto decidido, sin reabrir ideación. Lee íntegros README y docs/SOURCE_AUDIT.md, DATA_FEASIBILITY.md, PRD.md, ARCHITECTURE.md, DATA_MODELS.md, RULE_ENGINE.md, TEST_STRATEGY.md, MILESTONES.md, DEMO_SUBMISSION.md, MUSE_GOAL.md y API_CONTRACT.yaml. Todos esos archivos, salvo README, están en docs/.

Este repo contiene diseño, evidencia de investigación Y la aplicación implementada (API + web + E2E). Alcance P0: ejemplo revisado (Tías, caso oro 10/15) + recorrido propio completo offline (alta + PDF + empresa + análisis + revisión manual + simular + comparar + exportar). Precedencia: PRD para alcance; RULE_ENGINE para matemática y estados; API_CONTRACT para transporte; DATA_MODELS/SQL para persistencia; SOURCE_AUDIT para hechos verificados. Ante conflicto, registra una decisión y corrige los documentos relacionados antes de codificar.

## Primeras acciones
Inspecciona git status, entorno, muse --version y capacidades/modelo/saldo accesibles, sin mostrar secretos. No ejecutes muse init sobre este archivo. Crea docs/environment.md, task-board.md y blockers.md. No marques G0 ni G3 como resueltos por leer documentación.

G1/G2 ya tienen pruebas locales de descarga: comprueba hashes, no repitas descargas masivas. Caso P0: Tías 2026/00006554N, neto 118336.00, 24 meses, 49 puntos, PCAP p.10 y p.20. Adapta la investigación a una semilla con revisión identificada. La extracción Meta real está pendiente de clave; no presentes un fixture como ejecución live.

## Límites no negociables

- No chatbot RAG como producto principal, vector DB, predictor de ganar ni recopilación de precios confidenciales actuales.
- El LLM propone estructura y citas; aritmética, elegibilidad y anormalidad viven en dominio Python puro.
- Dinero, ratios y puntos en Decimal; API con strings; importes persistidos en céntimos. El frontend no tiene otra fórmula autoritativa.
- No eval, exec ni código del LLM. Solo plantillas y AST con whitelist y límites. La propia oferta participa en mejor precio y medias según la política.
- Cita localizada y revisión semántica son estados distintos. Regla o scope pendientes bloquean puntos. Unknown usa null, nunca cero.
- Anormalidad es presunción condicional o posible justificación; nunca exclusión automática por ese motivo. No aplicar art.85 universalmente ni mezclar variantes de PCAP.
- Sin todas las ofertas reales, los escenarios son hipótesis declaradas. No presentar adjudicaciones como distribución de rivales. No fabricar muestras o métricas.
- Preservar documento, fuente, versión, hash y página. Sin crawler del portal: recursos oficiales expresamente publicados o upload local.
- No secretos en frontend, logs o fixtures; no documentos privados en Contributor. MODEL_API_KEY pertenece a la app y META_API_KEY al CLI.
- Demo offline rotulada Datos de ejemplo (Tus datos en licitaciones propias). Sin animaciones o registros ficticios de API. Tokens null para fixture/manual.
- Sin Meta en vivo en el frontal (solo smoke backend); empresa y rivales sintéticos; sin predicción.
- No publicar originales, repo, hosting ni enviar candidatura sin autorización final del autor. Sin CI remota ni push sin su autorización explícita. Preparar antes todo lo revisable. No contactar organizadores o terceros por cuenta propia.

## Implementación y autonomía
Sigue ARCHITECTURE y OpenAPI. Resuelve versiones compatibles y fija uv.lock/package-lock al principio; no cambies latest cada día. Un proceso Uvicorn y SQLite WAL, sin cloud inicial. Scripts Python multiplataforma; Docker no obligatorio.

Trabaja por tareas de 0,5–3 h. Prioriza el vertical slice completo y la demo desde el primer día. Se permiten commits locales claros cuando el prompt de arranque los autorice; no amend/reset destructivo de trabajo ajeno. Cambios pequeños vinculados a criterios, sin funciones P2 para cubrir casos raros.

No hagas entrevistas sobre preferencias inferibles. Pregunta solo por acceso o secretos imposibles de verificar y decisiones irreversibles/finales no autorizadas. Ante bloqueo externo, documenta y continúa tareas independientes. Dos intentos acotados; ningún bucle infinito.

## Agentes y workflows
Se autoriza usar helpers y workflows de Muse Code si están habilitados en esta instalación. Máximo lead más dos helpers activos; presupuesto compartido. El lead controla contrato, DB e integración. Helper de dominio y helper de frontend con áreas aisladas; verificador de lectura o segundo pase tras integrar.

No inventes funciones de workflow JS ni comandos de plugin. Descubre documentación y capacidades reales del build. Si no hay workflows, usa subagentes disponibles o ejecución secuencial. En Windows puede faltar session messaging; no lo conviertas en dependencia. Cada escritor usa un worktree desde commit conocido, con ownership sin colisiones; lectores pueden compartir copia. Integra y verifica secuencialmente.

El lead revisa pruebas, no acepta un PASS de otro agente sin evidencia. No cerrar /goal por autoveredicto: comprobar requisito por requisito.

## Pruebas y evidencia
Implementa los scripts de TEST_STRATEGY. Ejecuta checks pertinentes por bloque y suite final completa. Mantén docs/verification-log.md con fecha, comando, exit code, commit y evidencia. Corrige FAIL; BLOCKED/SKIPPED no son PASS. No cambies oráculos o tests para ocultar bugs.

Cubrir U01–U26, I01–I14 y E01–E12; build, lint, tipos, pytest y Chromium; inspección visual de escritorio y móvil; dos ensayos limpios offline. Smoke Meta opt-in con clave y consumo acotado. No atribuir prueba Windows a una ejecución Linux.

## Presupuesto y terminación
Techos propuestos: app 20 USD y desarrollo 90 USD, solo si el autor confirma saldo aplicable; en otro caso, limitar al saldo real. No habilitar pagos extra o Contributor para evitar un bloqueo. Registrar consumo real y reintentos inciertos; consultar /usage/dashboard después de cada ronda de agentes. Pausar antes del techo.

P0 completo solo si US01–US13 y DoD se verifican, G3 real acredita la integración Meta, la demo offline es estable y el informe conserva fuentes. Falta de admisión, bases, derechos o clave se declara como bloqueo externo, nunca como cumplimiento. Entrega final: tabla PASS/FAIL/BLOCKED, comandos reales, limitaciones, README desde limpio, guion de 180 s y borrador de candidatura. Un vídeo solo existe cuando realmente se ha grabado.

