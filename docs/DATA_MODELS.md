# Modelos de datos y contrato de información
Autoridad de transporte: API_CONTRACT.yaml (OpenAPI 3.1). Autoridad de persistencia inicial: schemas/schema.sql. No utilizar los CSV de investigación como modelo de producto.

## Granularidad e identidad
| Entidad | Clave / cardinalidad | Responsabilidad |
|---|---|---|
| Tender | id local; unique(feed_id, atom_id) | Expediente, no oferta ni lote. ContractFolderID es referencia de presentación. |
| NoticeVersion | tender + updated UTC + hash | Snapshot original/versionado, provenance y conflicto. |
| Scope | tender + lot_key | Ámbito completo (__whole__) o lote explícito. Un Tender tiene 1..N scopes. |
| Document | tender + sha256 + kind | Bytes originales, fuente, páginas y derechos. No sobrescribir bytes. |
| DocumentPage | document + page_number | Texto crudo/normalizado y extractor, página física 1-indexada. |
| Citation | documento/hash/página/cita | Localización de evidencia, distinta de revisión semántica. |
| InterpretationRevision | tender + revision | Propuesta estructurada, hallazgos, requisitos y revisión. Append-only. |
| PricingRuleRevision | rule_id + revision | Scope, plantilla, AST derivado, anormalidad y aprobación. |
| CompanyRevision | company_id + revision | Costes y evidencias con horizonte. No modifica escenarios previos. |
| HistoricalAward | snapshot + result_index (tabla eliminada por migración 0003; la clase persiste en `db/models.py` sin lectores) | Resultado observado, ligado a scope cuando es resoluble. |
| Scenario | id inmutable | Inputs y resultado con versiones y hashes exactos. |
| Report | id inmutable | Escenario y decisión humana, pendientes y HTML imprimible. |
| Job | id + lease | Trabajo asíncrono persistido y recuperable. |
| ModelInvocation | id/job | Origen live/fixture/manual; tokens y coste solo cuando reales. |
| AuditEvent | id, actor, motivo | Revisión o edición, valores previo/nuevo y fecha. |
| StressTest | id inmutable | Malla declarada descuentos×hipótesis con request/resultado y sha. |
| ModelSpendAccount | fila única id=1 | Totales held/spent en micro-USD del ledger atómico (techo `BIDLAB_META_BUDGET_USD`). |
| ModelSpendReservation | clave de intento | Reserva por intento live: reserved/sent/uncertain/settled/released. |

Un lote puede tener más de un resultado histórico por versiones o contratos; no suponer un único ganador. El MVP excluye adjudicación parcial no resoluble de estadísticas. No almacenar propuestas confidenciales de competidores como histórico.

## Convenciones obligatorias
- IDs internos opacos, 1–80 caracteres alfanuméricos/_/-. IDs Atom y URLs de origen son strings separados.
- Fechas con instante conocido: UTC ISO 8601; conservar literal y zona original. Sin zona: deadline_at=null y deadline_literal presente. No convertir un plazo de Canarias a Europe/Madrid sin indicación de la fuente; Tías dice “Hora peninsular”, que sí permite hacerlo.
- Dinero en API: strings como "118336.00". En DB, enteros de céntimos para importes monetarios totales; el texto bruto se conserva en propuesta/snapshot. Ratios y puntuaciones son Decimal serializado, jamás REAL de SQLite para autoridad aritmética.
- Money no negativo en schemas; dominio exige B>0 y P>0 cuando puntúa. Beneficio/margen pueden ser negativos. Tolerancia y redondeo en RULE_ENGINE.
- currency EUR en P0; otras monedas se conservan como metadata/import warning y no se evalúan. Unidad, scope y periodo son obligatorios antes de aprobar PriceBasis.
- Metadatos no presentes son null, no 0 ni cadena vacía. Not_found no implica no existe. Confidence high/medium/low es autoestimación del modelo, no probabilidad calibrada.
- Perfil synthetic=true y todos los resultados relacionados muestran carácter hipotético. Costes reales del cliente nunca se deducen del PBL.

## Estados que no se deben colapsar
1. ExtractionProposal.status: proposed / not_found / ambiguous / unsupported.
2. Citation.match_status: exact / normalized_match / missing / manual_visual. La revisión visual exige actor y motivo y no se autoasigna por el LLM.
3. Revisión semántica: pending / approved / blocked.
4. Elegibilidad: met / not_met / unknown, con reason_codes y evidencias.
5. Score: defined / unknown / unsupported; value=null salvo defined.
6. Anormalidad: unknown / not_applicable / possible_justification_required / not_flagged_under_assumptions.
7. Comparabilidad histórica: unreviewed / comparable / excluded, con causas y revisor.
8. Job: queued / running / succeeded / needs_review / failed / cancelled.
9. Origen del análisis: live / fixture / manual; la UI usa “Demo curada” cuando el dato fue revisado sin invocación live en esa sesión.

Invariantes cruzados que JSON Schema no expresa por sí solo:
- Campo propuesto no-null necesita ≥1 cita válida antes de aprobarlo.
- No aprobar fórmula/scope con evidencia missing o base incompatible.
- Rule.expression debe coincidir con AST canónico de template_id; backend lo reconstruye y compara, no acepta un AST arbitrario del navegador.
- Regla approved siempre con actor/motivo, hash documental y revisión del scope aprobada.
- Si documento cambia, futuras evaluaciones requieren nueva revisión; informes existentes conservan documento original/snapshot.
- complete=true en rival scenario significa conjunto hipotético completo indicado por el usuario, nunca conocimiento del concurso futuro.
- Score desconocido no borra precio, coste o margen que sí son calculables.
- Un fallo de HTTP/DB no se persiste como “regla jurídica unknown”.

## Propuesta de extracción
schemas/extraction.schema.json es un JSON Schema independiente. Se envía al proveedor la misma forma, adaptando únicamente restricciones incompatibles demostradas por el smoke, sin cambiar el contrato local.

Cada ClaimProposal: key, raw_value, normalized_value (string nullable), unit, citas, confidence, status y notes. Todas las claves presentes; no valores inventados para evitar null. Requisitos propuestos incluyen categoría, grupo/logic_hint y condición textual. El modelo propone lógica; el revisor confirma el árbol ejecutable.

FormulaProposal: literal, template_hint, max_points nullable, variables, citas y ambiguities. No ejecuta Python ni devuelve autoridad de revisión. Anomaly_text se extrae aparte con citas. unread_pages debe declarar páginas sin lectura útil.

La extracción gold inicial son hechos etiquetados manualmente desde tres PCAP, no una respuesta previa de Meta. Se entrega examples/gold_claims.json; no llamarlo dataset de entrenamiento ni evaluación estadística representativa. El gold de pruebas fuera de esos documentos debe ampliarse manualmente durante desarrollo.

## Pydantic y TypeScript: patrones a implementar
~~~python
MoneyText = Annotated[str, Field(pattern=r"^\d{1,12}\.\d{2}$")]
DecimalText = Annotated[str, Field(pattern=r"^-?\d{1,12}(\.\d{1,12})?$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class CitationProposal(StrictModel):
    document_id: str
    page_number: Annotated[int, Field(ge=1)]
    verbatim_excerpt: Annotated[str, Field(max_length=600)]
~~~
Los modelos completos se generan/implementan siguiendo OpenAPI, no duplicando enums a mano. Validadores de dominio convierten strings a Decimal bajo contexto local; no convierten float recibido a Decimal porque ya perdió precisión.

~~~typescript
// generado por openapi-typescript; ejemplo de uso
type EvaluationRequest =
  components["schemas"]["EvaluationRequest"];
type EvaluationResult =
  components["schemas"]["EvaluationResult"];
// number solo para coordenada de gráfico; Money muestra el string de respuesta.
~~~

## Base económica P0 de Tías
scope_id=tias-whole; unidad lump_sum; periodo inicial=24 meses; currency EUR; budget_net=118336.00; ceiling_net=118336.00; scoring_reference_net=118336.00; reference_kind=pbl; tax_kind=IGIC. Presupuesto bruto126619.52 y VEC295840.00 se muestran en campos separados.

Procedencia: neto desde XML original; bruto/duración/VEC desde XML y PCAP p.8–9; precio 49 y proporcional inversa p.10; anormalidad p.20. No afirmar que la cita textual del neto aparece en el texto plano de p.8 si solo se pudo leer en tabla/imagen. Para aprobar esa base, incorporar evidencia XML con path/hash y revisión visual del documento cuando proceda.

Empresa inicial: “Pyme de ejemplo”, synthetic=true; scope tias-whole; 24 meses; direct_cost=80000.00 y overhead=10000.00; min margin rate=0.10. No son costes reales del servicio ni recomendación económica. Perfil sin certificados de experiencia => requisito técnico unknown. El ejemplo puede añadir evidencia sintética expresamente etiquetada para demostrar el resultado met, sin presentarla como documento auténtico.

## Árbol de requisitos
Un nodo group usa AND/OR y children; un leaf usa company_field, operator, threshold, unit, review_status y evidence_ids. Límites implementados: `MAX_TREE_DEPTH=32` en `domain/eligibility.py` (compartido por los walkers; `tests/unit/test_tree_depth.py`), `children` máx 20 por grupo y `requirements` máx 80 nodos de nivel superior en contrato. El «profundidad máxima 5» del diseño previo no se implementó. Comparación automática solo con campo y periodo/unidad revisados; manual produce unknown hasta anotación sustentada.

Tías solvencia económica, PCAP p.5–6: OR(turnover≥295840, seguro profesional≥295840, patrimonio/alternativa del apartado c revisada). El texto de c menciona patrimonio o ratio: si no puede formalizarse en la unidad correcta, leaf manual. No simplificarlo a “necesita facturar 295.840” ni interpretar ratio como euros.
Solvencia técnica p.6: importe anual acumulado en año de mayor ejecución de últimos tres años ≥207088, con naturaleza similar y acreditación. La condición de similaridad requiere revisión; no basta coincidencia de CPV o cifra.
Perfiles/experiencia p.6–7: mantener condiciones separadas y certificados pendientes; no evaluar solo una cifra global.

## API: semántica adicional
API_CONTRACT contiene 28 paths / 30 operaciones (contado 2026-10-28 con regex sobre `docs/API_CONTRACT.yaml`; el «22/24» del diseño previo está desactualizado), con respuestas concretas y errores. capabilities es /api/v1/capabilities (se sustituye la ruta preliminar /meta/capabilities del dossier). Evaluate no persiste y no invoca Meta; saveScenario reevalúa y persiste. Sobre el diseño previo el contrato añade: jobs, stress-tests, scenarios/compare, eligibility/check, page image y ready. `Workspace` incluye `consistency: ConsistencyReport` (radar PKG-T20) y `StressByDiscount` incluye `price_net` y `max_cost_net` (techo `money.cost_ceiling`).

Idempotency-Key requerido para crear analysis/scenario/report/demo session. Guardar clave+hash de cuerpo+resultado 24 h: misma clave y cuerpo devuelve el mismo recurso; distinto cuerpo =>409. expected_revision evita lost updates. Con nueva revisión incompatible =>409 stale_revision, nunca recalcular un informe antiguo silenciosamente.

ReviewRequest admite propuesta corregida y árboles; el servidor valida cada cambio según su objetivo, recalcula AST y añade auditoría. Campos id/revision/review_status aportados por cliente no sustituyen la secuencia/actor del servidor. Regla unsupported puede persistirse bloqueada y verse, no ejecutarse.

Histórico (P1, no implementado 2026-10-28: ningún path `historical-*` existe en el contrato): cuando exista, `GET historical-awards` retornará availability=disabled/insufficient/descriptive, siendo disabled respuesta válida P0. Ninguna respuesta usa “win_probability”. El endpoint PDF entrega Content-Disposition attachment por defecto; el visor recibe texto por `GET /documents/{id}/pages/{n}` e imagen PNG por `.../image` (render `bidlab-render-1`), sin PDF.js en `apps/web`.

## Persistencia y migraciones
schemas/schema.sql es DDL inicial ejecutable en SQLite y refleja las relaciones esenciales. Alembic genera migración equivalente y verifica roundtrip en DB vacía. JSON guarda snapshots tipados, no un almacén sin validación. Alembic no ejecuta schema.sql adicionalmente sobre las mismas tablas.

Cadena implementada (`apps/api/migrations/versions/`, 0001→0006): 0001 esquema inicial equivalente a `schema.sql` (17 tablas); 0002 índices `ix_citation_document`, `ix_rule_revision_scope`; 0003 elimina `historical_award`; 0004 crea `stress_test`; 0005 crea `model_spend_account` + `model_spend_reservation` (PKG-T02); 0006 añade `job.generation` (PKG-T03). Esquema migrado efectivo: 19 tablas; `db/models.py` declara 20 clases (incluye `HistoricalAward` residual).

Cada copia demo tiene DB/ruta separada. Bloqueo de publicación por fichero en publication-manifest; no arrastrar storage/.sqlite ni .env a git. Guardar fixture curado permite arrancar desde cero sin reimportar toda España.


## Evidencia de metadatos XML frente a citas PDF
MetadataEvidence incluye key, source_url, snapshot_sha256, field_path XPath, raw_value y source_updated_at. Tender y PriceBasis incorporan metadata_evidence; las citas PDF conservan documento/página por separado. Un dato de Atom no se fuerza a una página PDF inexistente. Para aprobar una base se exige al menos evidencia XML verificable o evidencia documental localizada/revisada, y compatibilidad semántica de ámbito/periodo.

En Tías p.8 se inspeccionó además la tabla visual: neto anual59168 por cada uno de los dos años iniciales; suma118336, corroborando el neto Atom. El neto inicial no figura como una cita literal118336 en el texto plano: registrar la derivación y la revisión visual, sin inventar un fragmento.

Ejemplos tipados: examples/tias_tender.json y company_profile.json conservan origen real/perfil sintético; el scope está pending. evaluation_request.json se empareja con evaluation_response.json como oráculo con curve=null; evaluation_curve_request.json muestra la petición de101puntos. La respuesta es referencia numérica, no ejecución de API ni aprobación real de reglas.

Costes y objetivo de margen de CompanyWrite admiten null. Si falta cualquier componente del coste total, cost/profit/margin son null, no se imputa cero; precio y puntos pueden seguir calculándose. En DB los céntimos son nullable por la misma razón. Cero coste explícito es distinto de coste desconocido. Un perfil con cualquier evidencia sintética debe mantener synthetic=true.
