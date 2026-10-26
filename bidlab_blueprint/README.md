# BidLab — paquete de investigación y especificación
**Corte de investigación: 26 de octubre de 2026.** Destino: repositorio nuevo para Muse Code. Este paquete contiene diseño, muestras y sondas de investigación; **no contiene una aplicación implementada**, un vídeo grabado ni una extracción ejecutada con Meta.

## Dictamen
**Viable con alcance acotado.** Construir primero una licitación real, revisión documental trazable y Pricing Lab determinista. La muestra oficial permite metadatos y algunos resultados, pero no identifica una distribución completa de ofertas rivales. No desarrollar predicción de adjudicación. Mantener el histórico descriptivo como P1 condicionado a comparabilidad y tamaño.

Caso P0 elegido: **2026/00006554N**, asistencia técnica del PAI de Tías, fuente PLACSP 20777838. PBL neto 118.336 EUR; PBL con IGIC 126.619,52 EUR; duración inicial dos años; VEC 295.840 EUR; precio 49 puntos. Regla proporcional inversa en PCAP página PDF 10 y regla de anormalidad en página PDF 20. Véase docs/RULE_ENGINE.md.

## Cómo utilizarlo
1. Leer docs/SOURCE_AUDIT.md y docs/DATA_FEASIBILITY.md: contienen resultados ejecutados y límites.
2. Copiar este árbol en la raíz de un repositorio nuevo. AGENTS.md ya existe: no sobrescribirlo con muse init.
3. Leer docs/MUSE_GOAL.md y resolver admisión/bases aceptadas y acceso API en el entorno del participante. La implementación offline puede avanzar mientras se resuelven.
4. Usar los doce entregables normativos de la tabla. El primer agente implementador genera el lockfile y el esqueleto, no reinventa los contratos.
5. Mantener evidence/originals fuera del repositorio público hasta completar la revisión por documento descrita en docs/DEMO_SUBMISSION.md. Son copias de investigación, no una licencia concedida por BidLab.

| Entregable | Propósito |
|---|---|
| docs/SOURCE_AUDIT.md | Fuentes, correcciones y gates |
| docs/DATA_FEASIBILITY.md | Descargas reales, estructura y calidad |
| docs/PRD.md | Alcance, UX e historias con aceptación |
| docs/ARCHITECTURE.md | Stack, módulos, seguridad y flujos |
| docs/API_CONTRACT.yaml | OpenAPI 3.1 canónica |
| docs/DATA_MODELS.md | Persistencia, estados y contratos |
| docs/RULE_ENGINE.md | Matemáticas, reglas y DSL |
| docs/TEST_STRATEGY.md | Pruebas y métricas |
| docs/MILESTONES.md | Tareas, presupuesto y recortes |
| docs/DEMO_SUBMISSION.md | Ensayo, vídeo y entrega |
| AGENTS.md | Reglas del agente de programación |
| docs/MUSE_GOAL.md | /goal y coordinación de agentes |

## Evidencia entregada
- Feed Atom real: snapshot original privado y 68 expedientes en CSV/JSON de metadatos, resultados y documentos en evidence/feed_probe/.
- ZIP oficial 2012: 16.008.909 bytes; 38 miembros Atom; 19.000 entradas, 11.262 IDs distintos y 7.738 versiones adicionales. Se incluye resumen, no el ZIP completo ni sus 246 MB descomprimidos.
- Cinco PCAP y un PPT descargados; hashes y URLs exactas en evidence/download_manifest.json; los tres casos de fórmula fueron inspeccionados también visualmente.
- examples/: vectores numéricos, contratos de ejemplo, gold documental inicial y XML minimizado.
- schemas/: SQL y esquemas auxiliares. tools/: sondas y verificaciones del diseño.
- docs/verification-log.md distingue verificaciones hechas ahora de pruebas de producto pendientes.

La muestra reciente es de conveniencia y el ZIP es histórico; **ninguna constituye un conjunto validado para entrenar un predictor**. Las ofertas de los escenarios y los costes de empresa son sintéticos y deben rotularse siempre.

## Comprobación del paquete
Python 3.12. Dependencias de investigación: lxml, pypdf; para validar contratos: PyYAML, jsonschema, openapi-spec-validator 0.7.2. Consultar tools/requirements-validation.txt. Ejecutar python tools/validate_blueprint.py desde esta raíz. Es una comprobación del diseño; pytest y Playwright del futuro producto son otra fase.

No hay acceso a claves Meta en esta sesión. No se ha instalado/ejecutado Muse Code. Las capacidades del CLI son comprobación documental, no prueba en el ordenador del participante.

