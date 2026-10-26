# PRD — BidLab
## Problema y resultado
Una pyme debe decidir si puede participar y qué relación precio/coste/puntos acepta. El pliego reparte información entre cláusulas y anexos; las fórmulas dependen con frecuencia de ofertas todavía desconocidas. BidLab convierte esa información en una decisión revisable: requisitos con evidencia, hipótesis visibles, simulación determinista y un informe reproducible.

Usuario inicial: responsable técnico/comercial de pyme que conoce su coste y puede revisar el PCAP. Uso individual en ordenador local. Sin colaboración, presentación de ofertas ni dictamen jurídico automático.

Éxito P0: en menos de tres minutos de recorrido, el usuario identifica un requisito pendiente, compara dos precios y dos escenarios, entiende una alerta condicional y exporta las fuentes y cálculos. El tiempo de procesamiento inicial de un PDF no forma parte de esos tres minutos; la demo declara los datos ya revisados.

## Alcance y prioridades
| Nivel | Funciones |
|---|---|
| P0, obligatorio | Biblioteca local con Tías auténtica; carga PDF; extracción Meta real en modo live y demo curada honesta; evidencias de página; revisión de scope/reglas; perfil sintético editable; elegibilidad con AND/OR/unknown; Pricing Lab; dos escenarios manuales; cálculo desplegable; guardar escenario; informe HTML/print; panel de calidad; persistencia local; E2E y arranque offline. |
| P1, tras P0 estable | Importación ZIP local genérica; cuatro pares de adjudicación revisados y tabla; histograma solo con gate estadístico; segundo PCAP manejado como caso bloqueado; versión inglesa del guion; soporte de plantillas lineal/log tras revisión. |
| P2, fuera del evento salvo holgura excepcional | Búsqueda nacional, OCR general, TED integrado, multiusuario, cloud, predicción, rankings de probabilidad, generación de memorias y presentación real de ofertas. |

P0 del motor implementa proporcional inversa y validación del DSL; los vectores de lineal/log son investigación y regresión de la gramática, no una promesa de cobertura jurídica de todos los pliegos.

## Reglas de información y lenguaje
Tres etiquetas persistentes: **Fuente oficial** (metadato/documento), **Hipótesis** (precios rivales, costes o cualitativos del usuario) y **Calculado** (resultado del motor). La revisión es un estado aparte: Propuesto / Cita localizada / Revisado / Bloqueado. No usar “verificado por IA” para significado jurídico.

La biblioteca muestra fecha del snapshot y estado observado. Una extracción no encontrada es “No localizado”; no equivale a requisito inexistente. El resultado de empresa puede ser cumple/no cumple/por verificar únicamente respecto de un requisito revisado. La conclusión global expresa qué grupos se han evaluado y cuáles faltan; no “empresa apta” por completar dos filas.

Todo precio P0 está en EUR sin impuestos para el scope/horizonte indicado. Mostrar IGIC cuando corresponde. El precio total con impuesto no se mezcla con margen o puntos. Mostrar “Puntos de precio bajo este escenario / 49”; los otros 51 puntos no se inventan.

## Historias y criterios verificables
| ID | Historia | Aceptación observable |
|---|---|---|
| US01 | Abrir ejemplo real | Desde instalación limpia, Cargar ejemplo crea una copia de sesión y abre 2026/00006554N con 118.336 neto, 126.619,52 bruto, 49 puntos y snapshot 25/10; enlace oficial y badge Demo curada visibles. No llama Meta. |
| US02 | Revisar un hallazgo | Clic en solvencia técnica abre PCAP p.6, cita y hash. Si la cita falla, se marca no localizada y se impide aprobar el hallazgo sin corrección con motivo. Cambios crean revisión y auditoría. |
| US03 | Entender requisitos alternativos | Solvencia económica de Tías se modela como OR de tres medios; ausencia de cuentas no produce no cumple si hay un medio alternativo acreditado. Sin evidencias válidas de ninguno => por verificar. |
| US04 | Estudiar precios | Slider 5%→15% actualiza precio 112.419,20→100.585,60 y beneficio con coste sintético 90.000: 22.419,20→10.585,60. Bajo rivales 106.502,40 y 110.052,48, puntos 46,4211→49,0000. |
| US05 | Cambiar hipótesis | Precio propio al 5%, rival más bajo cambia de 106.502,40 a 100.585,60: puntos pasan 46,4211→43,8421. Etiqueta condicional se mantiene. Rivales omitidos/incompletos => score unknown con variable faltante; precio y margen siguen disponibles. |
| US06 | Ver presunción de anormalidad | Con reglas de Tías aprobadas, tres grupos independientes supuestos y baja propia 30%, devuelve posible necesidad de justificación; nunca exclusión automática. Con grupos desconocidos, anomaly unknown. |
| US07 | Comprender cálculo | “Ver cálculo” incluye regla/revisión, 49, mejor oferta incluyendo la propia, fórmula y sustitución; todos los valores proceden del backend y son los mismos que se exportan. |
| US08 | Guardar y recuperar | Guardar crea escenario inmutable con regla, documento, empresa e hipótesis versionadas. Recargar navegador mantiene escenarios. Editar costes crea otra revisión; no modifica informes anteriores. |
| US09 | Exportar decisión | Exportación HTML imprime snapshot, campos pendientes, precios, costes sintéticos, puntos condicionados, presunción, fórmula, páginas y enlaces. Un campo pendiente no desaparece en export. Sin claves o documentos privados completos embebidos. |
| US10 | Analizar PDF nuevo con Meta | Botón explica qué documentos se enviarán. Con confirmación de procesamiento remoto y clave configurada, crea job, poll y salida estructurada con citas comprobadas; modo/modelo y uso real registrados. Sin clave ofrece revisión manual o demo, nunca éxito simulado. |
| US11 | Manejar límite documental | PDF escaneado/página vacía muestra requiere revisión; fórmula no soportada deja score unknown. Documento reemplazado invalida revisiones dependientes y muestra nuevo hash. |
| US12 | Contexto histórico honesto | Panel identifica 68 expedientes y 33 resultados de la sonda como cobertura del archivo. Para histórico del CPV de Tías sin grupo suficiente dice insuficiente; no muestra gráfica sintética de mercado. |
| US13 | Uso local seguro | Frontend no contiene clave; app se sirve en 127.0.0.1. Subida no PDF, >20 MiB o >120 páginas rechazada; export trata texto del pliego como datos, no HTML. |

## Pantallas y comportamiento
### Biblioteca /
Cabecera BidLab, “De un pliego a una decisión de oferta”, Cargar ejemplo y Añadir pliego. Lista pequeña con órgano, CPV, presupuesto neto, estado observado y fecha snapshot. No buscador nacional ficticio. Buscador local por título/CPV. Marketing aparece solo como caso de límites P1, nunca como oportunidad vigente certificada.

### Workspace /tenders/:id
Encabezado con scope y fuente. Pestañas Resumen, Requisitos, Pricing Lab, Evidencia e Informe. Resumen muestra hechos pendientes y checklist de preparación; no burbuja de chat. Revisión de reglas accesible con texto fuente y precondiciones. Un banner identifica demo curada o análisis live y fecha.

### Requisitos
Tabla de grupo, condición, evidencia empresa, resultado y referencia PCAP. Filtros pendientes/no cumple. El grupo OR abre sus alternativas. En la demo, experiencia técnica anual 207.088 EUR queda pendiente por falta de certificados; no inventar que una empresa sintética los tiene.

### Pricing Lab
A 1440 px: columna principal de 8/12 y panel de supuestos 4/12; fila superior cuatro KPIs: precio, beneficio/margen, puntos de precio y presunción. Curva precio-puntos y coste/umbral de margen visibles; no usar doble eje sin etiquetas claras. Dos gráficos alineados comparten precio. Color de riesgo acompañado de texto.

Slider de baja 0–40%, paso 0,1 puntos porcentuales, entrada numérica alternativa; límites de UI no son umbrales legales. Rival A/B: etiquetas “Hipótesis A/B”, precio neto y grupos supuestos, confirmación de conjunto completo hipotético. Opción “Sin escenario rival” produce score unknown. No inferir cantidades desde el número de ofertas histórico.
  
Backend autoritativo; debounce 150 ms, AbortController y contador de petición. Nunca mostrar resultado anterior como actual; mientras calcula, indicar actualización. Interacción/animación no llama LLM. Guardar es explícito para evitar cientos de escenarios por mover el control.

“Margen mínimo” es objetivo del usuario, no criterio de solvencia o adjudicación. Coste sintético se anuncia junto al KPI. Evitar CTA “optimizar para ganar”; CTA “Comparar escenarios”.

### Evidencia
Drawer accesible: documento, página física PDF desde 1, etiqueta impresa si existe, cita y revisión. PDF.js con assets locales; enlace Ver documento original y descarga. Zoom, siguiente/anterior y vuelta al hallazgo. Texto alternativo si render falla. No usar iframe al portal PLACSP.

### Informe
Página imprimible con los mismos datos de un escenario guardado. Decisión manual “Seguir estudiando / Preparar oferta / Descartar”, comentario y pendientes; no decisión asignada por IA. No incluye precios reales de competidores no públicos ni promesa de ganar.

## Diseño y accesibilidad
D: fondo #F6F7FB, superficie blanca, texto #172033, primario #3159D9, alerta #9A5B00 y error #B42318. Tipografía system-ui local; números tabulares; radio 10 px; escala de espacio 4/8/12/16/24/32. Nada de logotipos oficiales como marca del producto, gradientes decorativos o métricas de confianza inventadas.

Validar contraste WCAG AA con comprobador, foco visible, controles con nombre, navegación por teclado, aria-live polite para resultado, no depender del color. A 1280×720 ningún KPI o CTA principal queda oculto; a 390×844 panel de hipótesis debajo, tablas con scroll delimitado. Mensajes en español y datos formateados es-ES; protocolo JSON siempre decimal con punto.

## Objetivos no funcionales (metas, aún no medidas)
Cálculo único <100 ms p95 backend local en 100 repeticiones; curva ≤201 puntos <250 ms p95; cambio de control a pintado <400 ms p95 con red local. Semilla demo <3 s con DB vacía, arranque <60 s después de instalar dependencias. Cero peticiones externas durante demo/E2E offline. Registrar hardware y mediciones; si no se cumplen, no afirmar cumplimiento.

DoD P0: US01–US13 verificadas, G3 real o bloqueo visible (bloqueo no convierte integración Meta en completa), no discrepancia entre UI/API/export, oráculos numéricos, build y Chromium E2E verdes, instalación documentada y ensayo de 180 s.

