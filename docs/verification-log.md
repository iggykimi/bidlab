# Registro de verificación del paquete de arquitectura
Fecha: 2026-10-26T16:43:39.524028+00:00. Entorno: Linux, Python3.12; sin repositorio de producto ni commit de aplicación. Todos los resultados siguientes son de investigación/especificación, no del producto futuro.

## Ejecuciones reales
| Check | Comando | Resultado |
|---|---|---|
| Descarga pública | python tools/fetch_evidence.py <manifest> | Feed, ZIP y documentos con HTTP200 y hashes registrados. Se usaron manifests de investigación, no URLs inventadas. |
| Feed | python tools/probe_placsp.py <placsp.atom> --out evidence/feed_probe | Exit0:68entradas/68IDs,33resultados,22candidatos estructurales. |
| ZIP | python tools/probe_placsp.py <placsp_2012.zip> --out <research/zip_probe> | Exit0:38miembros,19000entradas/11262IDs,7738versiones adicionales. |
| Lectura PDF | pypdf y PyMuPDF para investigación | CincoPCAPyunPPTabiertos; fórmulas visualizadas en p.10Tías,p.9Alfresco,p.15Marketing; tabla de Tías p.8 comprobada visualmente. |
| Reglas hackathon | Lectura de JSON público serializado en HTML oficial y PDF enlazado de CreditTerms | Texto recuperado y leído; hash y método en hackathon_rules_probe.json. No aceptación ni claim en cuenta. |
| Generación contrato | python tools/build_contract.py | Exit0:22paths,24operaciones,51schemas. |
| Validación integrada | python tools/validate_blueprint.py | Exit0; salida debajo. Se instalaron dependencias de validación en directorio temporal, no como lock de app. |
| Smoke Meta | python tools/meta_smoke.py --out evidence/meta_smoke_status.json | Exit2 BLOCKED:MODEL_API_KEY ausente;0solicitudes enviadas. |

Los comandos de sondas se ejecutaron desde el workspace usando rutas al paquete; los nombres anteriores son equivalentes desde su raíz. La validación se ejecutó con PYTHONPATH apuntando a dependencias temporales de validación. Para reproducir en una venv, instalar tools/requirements-validation.txt y ejecutar desde raíz sin esa variable.

## Salida real del validador
~~~text
PASS: 12 required deliverables; OpenAPI 3.1, 22 paths / 24 operations
PASS: standalone extraction schema and typed example payloads
PASS: SQLite DDL; tables 17
PASS: 6 original PDF download hashes and parser readability
PASS: 25 annotated citations located in exact PDF pages; semantic accuracy not statistically measured
PASS: recent probe counts reconcile; structural candidates are NOT a validated statistical corpus
PASS: scoring vectors, demo money/margins and exact boundary oracles; app not tested
PASS: task estimates/dependencies and P0 total 58 hours
PASS: publication flags and honest Meta BLOCKED state
DESIGN VALIDATION COMPLETE. No app pytest/Playwright/build/live Meta run claimed.
~~~

## No ejecutado / no afirmado
pytest, integración de app, Playwright, frontendbuild, arranque de demo, benchmark de extracción Meta, consumo real de tokens, pruebaWindows, vídeo y envío. Son criterios de TEST_STRATEGY para la implementación. No hay estadísticas predictivas ni tasas de precisión obtenidas.

La localización de25citas no valida por sí sola todas las interpretaciones jurídicas. Los25hechos son gold inicial manual y no una muestra representativa. Las cuatro parejas de adjudicación revisadas no forman un mercado homogéneo. Derechos de publicación de originales siguen por fichero en publication-manifest.

Última ampliación: contrato51schemas, ejemplos Tender/Company/EvaluationResult validados y snapshot Atom original incluido con hash. Las copias de investigación (seisPDFyunAtom) permanecen con publicación desactivada. El script de recuperación de reglas reprodujo21817caracteres, SHA2568213d68a63cee86d31828cba34ec453669cd49be9185ada5640395407ca0888d.

## Producto T05 — scaffold y gates vacíos (Windows)

Fecha: 2026-10-26. Commit: 6a2ca69. Entorno: Windows, Python 3.14.7,
Node v26.3.0, npm 12.0.2, uv 0.12.5, Chromium (playwright install).

`python scripts/verify.py` → exit 0, ALL CHECKS PASSED:
deps-python, pytest-unit (1 passed), pytest-integration-contracts (2 passed,
1 skipped honesto), npm lint/typecheck/build, npm test:unit (2 passed),
ruff, mypy (7 ficheros), playwright-e2e (1 passed, API real vía webServer).

Incidencias resueltas durante T05 (no ocultadas): `uv sync` por defecto no
instala el miembro apps/api (se usa --all-packages); hatchling exigió
packages=["bidlab"] explícito; npm 12 bloqueó postinstall de esbuild hasta
`npm install-scripts approve esbuild`; typecheck exigió @types/react(y -dom).
Health/Capabilities se alinearon al contrato (schema_version, limits,
additionalProperties). Lint cubre código de producto; tools/ (sondas de
investigación) excluido y documentado en pyproject.

## Producto T03 — smoke Meta real (Windows)

Fecha: 2026-10-26T19:05:43Z. Resultado en evidence/meta_smoke_status.json.
Comando: loader `.env` + `tools/meta_smoke.py --out evidence/meta_smoke_status.json`
→ exit 0, status PASS, executed_inference true, model muse-spark-1.3,
HTTP 200, usage 14 prompt + 236 completion (222 reasoning, 0 cached),
total 250 tokens, 1647 ms. Coste estimado ~0.001 USD. Sin secretos en salida.
G3-smoke verde; la extracción documental real (T16) queda pendiente.

Incidencia honesta: la clave del autor venía como `MUSE_API` (48 chars), no
`MODEL_API_KEY`; dos intentos PowerShell de añadir la línea pegaron/mezclaron
contenido por manejo de arrays/saltos de línea. Se verificó por longitudes y
mitades idénticas, y se reescribió el fichero byte-exacto con Python: dos
líneas de 48 chars. La clave original quedó intacta (smoke PASS con ella).
