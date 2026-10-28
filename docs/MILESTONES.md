# Plan de desarrollo y presupuesto
Ventana de trabajo prevista:26oct–4nov2026; fecha pública de entrega4nov21:00ET = **5nov03:00 Europe/Madrid**. Objetivo interno: **4nov18:00CET**, nueve horas de margen. Confirmar bases aceptadas, hora de inicio válida y modificaciones antes de presentar.

Baseline estimado: **58 h de tareas P0 +10 h de contingencia =68 h de trabajo efectivo**. P1 añade8,5h y se descarta si amenaza el ensayo. Son estimaciones de ingeniería con asistencia de agentes, no horas garantizadas ni tiempo autónomo ilimitado. examples/tasks.csv contiene38tareas de0,5–3h, dependencias y aceptación. El tiempo de llamadas de agentes no elimina revisión, integración ni derechos.

> Nota 2026-10-28: este plan es el calendario histórico de la ventana 26oct–4nov (`examples/tasks.csv` verificado: 38 tareas); la aplicación ya existe en HEAD 4f1cc61 (API + web + E2E implementados). El plan no se reescribe; el estado real de verificación vive en `docs/verification-log.md` y `docs/task-board.md` (del lead).

## Días y gates
| Fecha | Resultado verificable |
|---|---|
|26oct |T01–T05: G0 documentado, G3smoke si hay clave, repo y locks. Copiar investigación ya hecha, no repetirla como app. |
|27oct |T06–T09: workspace real y semilla; motor dinero; primera ruta visual biblioteca→datos auténticos. |
|28oct |T10–T13: inversa, anormalidad y AND/OR con oráculos; API evaluate independiente de Meta. |
|29oct |T14–T16: PDFs, citas y extracción Meta real si acceso disponible. |
|30oct |T17–T20: jobs/revisiones y shell UI. Fin del día: recorrido básico integrado, aunque visual todavía sencillo. |
|31oct |T21–T24: requisitos, Pricing Lab, rivales, traza y fuentes. |
|1nov |T25–T27: guardar/exportar y seguridad. Decisión de recorte; nada P1 sin P0 sólido. |
|2nov |T28–T30: integración/E2E/QA; congelar funcionalidades al terminar el día. |
|3nov |T31–T33: instalación limpia, ensayo y vídeo; solo correcciones de demo. |
|4nov |T34 y contingencia; comprobar links/reglas y entregar con margen por el autor. |

T02/G0 depende del participante, no del código. Reglas públicas y Credit Terms ya se leyeron; queda comprobar aceptación individual, versión aplicable y claim/saldo. Mientras está pendiente se puede implementar localmente; no enviar candidatura ni declarar elegibilidad. T03/G3 depende de clave/cuenta; si se bloquea, seguir las tareas independientes y dejar adapter live sin falsa evidencia. El DoD de integración Meta real no es sustituible por un fixture.

## Delegación en Muse Code
Usar lead +máximo2helpers concurrentes cuando el build permita subagentes/workflows. Es una instrucción para el futuro desarrollo, no una afirmación de ejecución en esta investigación.
- Lead: contrato, DB/migraciones, integración, gates y decisiones.
- Helper dominio: domain/ y tests unitarios; no modifica esquema API sin acuerdo del lead.
- Helper frontend: apps/web/ contra OpenAPI aprobado; no introduce calculadora JS diferente.
- Verificador: revisión de solo lectura o segundo pase tras integrar, sin agente escritor permanente extra.

Contrato y semilla se estabilizan antes de escrituras paralelas. Cada escritor usa worktree desde commit base, ownership claro y commit propio. Lead integra uno por uno y ejecuta regresión. Si workflows no aparece o Windows impide mensajería, helpers acotados disponibles o ejecución secuencial; no perder horas reconstruyendo la herramienta de orquestación.

## Dependencias críticas
G1 datos/PCAP resueltos en investigación →T06/T07/T14.
G4 base y fórmula→T09–T12→T22/T23→T24/T25.
G3 acceso→T16/T17, no bloquea motor/UI offline.
Revisión/citas→T18/T21→export.
Ruta completa→E2E→vídeo→envío.

## DoD por bloque
- Datos: ningún hash inventado; dos imports mismos conteos; scope/lotes correctos; no PII irrelevante.
- Motor: vectores externos y fronteras legales verdes, unknown seguro, cero float autoritativo.
- Meta: una llamada real registrada, esquema válido y citas revisadas; métricas reales, no porcentaje inventado.
- UI: navegación completa, KPIs backend consistentes y explícitamente condicionales, sin spinner infinito.
- Export: escenario inmutable reproducible y fuentes; no desaparecen pendientes.
- Entrega: build/lint/types/E2E y offline; vídeo≤180s según restricción conservadora, fuentes/licencias y repo revisado. Publicación/envío por el autor.

## Presupuesto Model API
Tarifas estándar consultadas26oct: input1,25USD/M, cached0,15, output4,25. Fórmula:
C=(I-I_cached)×1.25/10^6 + I_cached×0.15/10^6 + O×4.25/10^6.
No contar cached dos veces. Estimaciones siguientes conservadoras sin descuento de cache; tokens de razonamiento facturados se incluyen según usage real. PDF/visión y retries pueden alterar consumo: medir, no estimar a partir de páginas como si fueran tokens exactos.

| Escenario app | Llamadas | Input total | Output total | Coste calculado |
|---|---:|---:|---:|---:|
|Pequeño |30×(10k/1,5k) |0,30M |0,045M |0,56625USD |
|Normal |100×(25k/4k) |2,50M |0,40M |4,825USD |
|Intenso |200×(40k/6k) |8,00M |1,20M |15,10USD |

Son escenarios presupuestarios, no medidas de esta sesión ni garantía de calidad. Se entregan datos reproducibles en examples/token_budget.json.

Muse Code puede consumir mucho más que la app. A tarifa Spark estándar,20Minput+1Moutput≈29,25USD;40M+2M≈58,50;80M+4M≈117. Muse Wonder usa otra tarifa:4USD/Minput y20output en la página consultada; no presupuestar un CLI con modelo distinto como si usara Spark.

Plan si realmente se confirman150USD de crédito aplicable: techo app20USD, desarrollo CLI90USD, reserva40USD. Las bases y Credit Terms anuncian150USD tras claim válido; **no está comprobado** que el saldo se haya aplicado a esta cuenta, que cubra ambas credenciales o que una suscripción CLI lo consuma. El PDF regula cobro posterior al agotamiento, por lo que los límites de gasto deben comprobarse en la cuenta real. La suscripción de Muse Code no autoriza usar su credencial en la app; claves extra son pay-as-you-go. Ajustar a saldo real sin activar cobros extra automáticamente.

Controles: ledger de uso app, reserva por intento y settled según usage; tope20USD configurable, aviso al50/80%, detener antes de superar reserva estimada. Reintentos tras timeout se marcan coste incierto y conservan reserva. Una cuota local no sustituye un límite del proveedor. En CLI consultar /usage y dashboard tras hitos, alertas30/60/90USD estimados y pausar /goal si se llega al techo; no inventar un flag CLI de “hard dollar cap” sin documentación.

Por llamada de extracción: máx6000completion tokens, input segmentado≤25kcaracteres/10páginas;3intentos de transporte y1reparación estructural como máximo por lote, ambos contabilizados. No ejecutar extracción completa en cada CI ni por cada slider.

## Señales de recorte y alternativas
| Bloqueo/señal | Acción |
|---|---|
|Sin admisión o bases incompatibles |Continuar como proyecto personal solo si el autor lo decide; no enviar alegando cumplimiento. |
|Sin API al terminar27oct |Demo curada honesta y adapter/test preparados; priorizar resolver acceso. No declarar uso Meta real ni proyecto completo para hackathon. |
|PDF sin texto/table compleja |Marcar revisión, permitir edición con evidencia; seleccionar Tías para demo; no montar OCR masivo. |
|Histórico sin20comparables |Tabla y panel insuficiente; cero predicción, cero histograma ficticio. |
|Fórmula no soportada |Bloquear puntos y permitir coste/precio; no aproximar con fórmula “parecida”. |
|No hay aprobación redistribución PDF |Descargador manual/manifiesto y datos fácticos; revisar uso en vídeo. No meter original en repo público. |
|UI se retrasa al31oct |Una sola licitación, un escenario editable y guardado, sin búsqueda/filtros avanzados; conservar fuentes y export. |
|E2E inestable al2nov |Eliminar P1; reducir componentes/animaciones; depurar ruta demo con prioridad a motor/citas. |
|Coste/latencia |Menos lotes repetidos por cache; usar texto, un helper; no bajar validación o enviar privado a Contributor por ahorro. |
|Windowsworkflow no disponible |Secuencial, scripts Python y coordinación del lead. No bloquear por capacidades opcionales. |

Orden de recorte: histórico avanzado→casos adicionales→traducción UI→animaciones/filtros→complejidad de upload. No recortar exactitud/citas, distinción de hipótesis, demo offline ni export reproducible.

## Cierre del trabajo autónomo
No loop infinito. Tras dos intentos fallidos de resolver el mismo bloqueo externo, registrar causa/experimento/alternativa, continuar tareas independientes y comunicar bloqueos. Fallos de código se corrigen con evidencia; si la tarea termina parcialmente, reportar PARTIAL con tabla de criterios, no cambiar la definición de terminado.


## Ajuste a la rúbrica oficial verificada
Impacto30%: requisito pendiente y relación coste/puntos concreta. Herramientas Meta25%: extracción estructurada real con evidencia y tratamiento de ambigüedades; no basta haber usado Muse para programar. Ejecución20%: motor, contratos y pruebas. Demo25%: recorrido estable de180s. No son puntuaciones obtenidas por BidLab.

G3 es un gate de la arquitectura elegida, no una regla que obligue a todo participante a usar Model API. Los Credit Terms permiten competir con modelos Meta de pesos abiertos sin cuenta API. Cambiar a esa vía exigiría verificar un modelo/proveedor concreto, extracción estructurada y recursos mediante otro smoke; no se incluye una integración alternativa no probada ni se implementan dos proveedores preventivamente.
