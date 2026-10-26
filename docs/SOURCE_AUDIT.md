# Auditoría de fuentes y viabilidad
Fecha de consulta: **2026-10-26, Europe/Madrid**. El dossier adjunto es la hipótesis inicial; este paquete lo sustituye en las decisiones técnicas que concreta. Verificado documentalmente no significa probado con cuenta propia.

## Estados
- **VD**: contenido oficial leído y contrastado.
- **VE**: experimento ejecutado; evidencia local y hash.
- **D**: decisión de arquitectura, no hecho atribuido a una fuente.
- **NC**: no comprobado o inaccesible. Requiere experimento/confirmación, nunca se convierte automáticamente en PASS.
- **I**: inferencia limitada, expresamente indicada.

## Fuentes y conclusiones
| ID | Fuente oficial / enlace específico | Evidencia y estado |
|---|---|---|
| H01 | [Meta evento](https://dev.meta.ai/events/global-hackathon) | VD: evento virtual, dos tracks; Indie valora creatividad, ambición técnica y funcionamiento; una categoría por proyecto. No equivale a bases legales completas. |
| H02 | [Cerebral Valley](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) | VD: comienzo 26 oct, entrega 4 nov 21:00 ET, hasta 20.000 admitidos; inscripción cerraba 25 oct 23:59 ET. |
| H03 | [Official Rules / Waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) | VD/VE: texto recuperado del JSON público serializado en el HTML, aunque el lector textual solo mostraba Loading. Indie hasta cuatro personas; criterios 30% impacto, 25% herramientas Meta, 20% ejecución y 25% demo. No acredita aceptación individual. |
| H04 | Reglas H03 y [portal de envío](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) | VD: originalidad, licencias de terceros y derechos amplios concedidos al organizador. NC: repo público, 180 s y ventana exacta de nueva autoría no aparecen en el texto recuperado; se conservan como restricciones del dossier. |
| H05 | Credit Terms, PDF de tres páginas enlazado desde H03 | VE: 150 USD tras claim válido, una concesión por cuenta; condiciones de uso/cobro y vigencia en PDF. Saldo/claim de esta cuenta NC. Hash/URL exactos en download_manifest. |
| D01 | [Hacienda catálogo](https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/licitaciones_plataforma_contratacion.aspx) | VD: seis conjuntos; cinco de sindicación y un XLSX de órganos. Menores en conjunto propio desde 2018; agregadas desde 2016. |
| D02 | [Feed alojadas](https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesContratante.aspx) | VD/VE: Atom paginado, hasta 500 entradas por fichero; ZIP anual/mensual enlazado; cobertura desigual entre órganos. Descargados feed y ZIP 2012. |
| D03 | [Atom descargado](https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom) | VE: 68 entradas y 68 IDs; actualizado en origen 25/10/2026. No es una fotografía de todas las licitaciones del país. |
| D04 | [ZIP 2012 descargado](https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3_2012.zip) | VE: 38 Atom; 19.000 entradas, 11.262 IDs; campos muy incompletos según época. El nombre del archivo no sustituye a las fechas del expediente. |
| D05 | [Resumen oficial, 21/12/2023](https://contrataciondelsectorpublico.gob.es/datosabiertos/DGPE_PLACSP_ResumenDatosAbiertos.pdf) | VD/VE: tabla de campos por feed; disponibilidad histórica de campos cambia por fecha de actualización. No todos los feeds incluyen presupuestos de lote. |
| D06 | [Especificación sindicación](https://contrataciondelsectorpublico.gob.es/datosabiertos/especificacion-sindicacion.pdf) | VE: descargada, 2.359.604 bytes. Se verificaron rutas CODICE en XML real; no fijar versión por el nombre de un prefijo. |
| D07 | [Robots portal](https://contrataciondelsectorpublico.gob.es/robots.txt) | VE: User-agent: * / Disallow: /. Se descarta crawler HTML. Descargas puntuales de recursos expresamente publicados por Hacienda; robots no constituye una licencia ni garantiza límites de consumo. |
| D08 | [Aviso Hacienda](https://www.hacienda.gob.es/es-es/paginas/avisolegal.aspx) | VD: reutilización de información bajo condiciones, atribución, fecha y no sugerir respaldo; logos/diseño tienen condiciones distintas. No extender automáticamente esta autorización a todo anexo de terceros. |
| D09 | [TED Search API](https://docs.ted.europa.eu/api/latest/search.html) | VD: alternativa oficial de búsqueda sin autenticación; endpoint POST /v3/notices/search. No se ejecutó consulta ni se integra en P0. |
| L01 | [LCSP, arts. 145 y 146](https://www.boe.es/buscar/act.php?id=BOE-A-2017-12902) | VD: ponderaciones y aplicación de criterios dependen del expediente; no existe una fórmula económica universal. Última actualización consolidada mostrada: 09/04/2026. |
| L02 | [LCSP, art. 149](https://www.boe.es/buscar/act.php?id=BOE-A-2017-12902) | VD: parámetros PCAP; supletoriedad reglamentaria en precio único en los supuestos de 149.2.a; pluralidad conforme a pliego; empresas del mismo grupo; trámite de justificación antes de exclusión por anormalidad. |
| L03 | [RGLCAP art. 85](https://www.boe.es/buscar/act.php?id=BOE-A-2001-19995#a85) | VD: ramas 1, 2, 3, ≥4 licitadores; excepciones, reducción motivada y consideración de solvencia. Solo activar una variante cuya aplicabilidad y parámetros estén revisados. |
| L04 | [LCSP art. 63](https://www.boe.es/buscar/act.php?id=BOE-A-2017-12902) | VD: publicidad del perfil y documentación de adjudicación no implica que el Atom contenga una tabla completa de ofertas. Actas pueden aportar datos adicionales; acceso/cobertura no probados exhaustivamente. |
| L05 | [Consulta JCCPE 119/18](https://www.hacienda.gob.es/Documentacion/Publico/D.G.%20PATRIMONIO/Junta%20Consultiva/informes/Informes2019/2018-119%20Ofertasanormales.pdf) | VD documental: interpretación administrativa sobre anormalidad con varios criterios. No convierte el art.85 en default para todas las licitaciones. No se ha hecho una revisión jurisprudencial exhaustiva. |
| M01 | [Modelos](https://dev.meta.ai/docs/models) | VD: muse-spark-1.3 recomendado para nuevo trabajo; contexto 1.048.576 tokens; multimodal. Acceso de esta cuenta NC. |
| M02 | [Quickstart](https://dev.meta.ai/docs/cookbook/quickstart-chat-completions) | VD: base_url https://api.meta.ai/v1 y OpenAI SDK, clave MODEL_API_KEY pasada explícitamente. No asumir compatibilidad total con cualquier parámetro OpenAI. |
| M03 | [Structured output](https://dev.meta.ai/docs/cookbook/structured-output) | VD: response_format json_schema y parse Pydantic documentados. Conformidad de esquema no valida significado ni citas. |
| M04 | [File handling](https://dev.meta.ai/docs/file-handling) | VD: inline PDF en Chat y Responses; 50 MB inline; Files hasta 1 GiB. Texto solo primeras 100 páginas, imágenes primeras 50; subir un PDF largo no garantiza lectura completa. |
| M05 | [Tarifas y cuotas](https://dev.meta.ai/docs/pricing-rate-limits) | VD: Spark estándar 1,25 USD/M input, 0,15 cached, 4,25 output; contributor 0,10 / 0,002 / 0,20. Cuotas publicadas por equipo y modelo; el saldo/acceso real se comprueba en dashboard. |
| C01 | [Muse Code](https://dev.meta.ai/docs/muse-code) | VD: Windows/macOS/Linux; instalador Windows publicado; documentación señala modelo inicial 1.2. Elegir modelo real con /models. CLI no ejecutado en esta sesión. |
| C02 | [Interacción y /goal](https://dev.meta.ai/docs/muse-code/interactive) | VD: goal, edit, pause, resume y clear; continúa trabajo pendiente y audita requisitos al cerrar. No constituye una garantía externa de corrección. |
| C03 | [Workflows](https://dev.meta.ai/docs/muse-code/workflows) | VD mediante descarga HTTP local: depende de build y rollout; límite efectivo de agentes depende de CPU. Falló recuperación textual por buscador, pero HTML original se recuperó y leyó. |
| C04 | [Configuración](https://dev.meta.ai/docs/muse-code/configuration) | VD: init escribe AGENTS.md, no sobrescribirlo; confianza del workspace y precedencia de instrucciones. No inventar formato de workflow JS sin validar en CLI instalado. |
| C05 | [Auth](https://dev.meta.ai/docs/muse-code/auth) | VD: META_API_KEY para CLI; prioridad sobre sesión de navegador. Es variable distinta de MODEL_API_KEY de la app. |
| C06 | [Suscripciones](https://dev.meta.ai/docs/muse-code/subscriptions) | VD: credencial de suscripción para Muse Code solamente; otras claves de la cuenta son pay-as-you-go. Suscripciones empiezan en Contributor, desactivable. |
| C07 | [Session messaging](https://dev.meta.ai/docs/muse-code/session-messaging) | VD: sesiones escritoras con worktrees. Documentación del overview dice que messaging no está disponible en Windows; comprobar build en destino. No depender de ello. |

Las páginas web se consultaron por navegación y las descargas se registraron con URL, respuesta HTTP, bytes y SHA-256 en evidence/download_manifest.json. Las páginas que cambien deberán revalidarse el día de envío. Un error de un canal de recuperación no se interpreta como que el recurso no existe: los PCAP se descargaron por HTTP aunque el buscador no pudo abrir sus URLs.

## Correcciones y precisiones respecto al dossier
1. Se sustituyen las hipótesis de G1/G2 por las medidas reales de DATA_FEASIBILITY. Ya existen cinco PCAP y un PPT descargados; no existen treinta.
2. Hay ReceivedTenderQuantity, LowerTenderAmount y HigherTenderAmount en algunos resultados. No son una lista completa de ofertas. Tampoco todos los TenderResult son adjudicaciones.
3. Multitud de versiones y varios resultados por expediente requieren dos granos distintos. Un precio adjudicado de un proveedor no se divide por el presupuesto completo cuando hay adjudicación parcial sin lote resoluble.
4. El pliego de marketing usa VEC y un anexo con prórroga. No reemplazarlo por PBL para que encaje. Su ficha además muestra un gross no reconciliado. Este caso queda bloqueado para demo comercial.
5. El PCAP Alfresco página 9 imprime un denominador con glifo 0, mientras el texto define O como oferta. Conservar literal e imagen; interpretación propuesta no aprobada automáticamente. Su regla de tres licitadores tampoco reproduce el cierre de baja >25% del reglamento.
6. La API PDF tiene límites de páginas concretos. Se adopta extracción local por página y lotes limitados; el contexto 1M no elimina esos límites.
7. Muse Code, API de producto y suscripción no comparten necesariamente saldo o credencial de uso. No prometer que 150 USD cubran todo.
8. Máximo de cuatro integrantes Indie y rúbrica ponderada quedan verificados en H03. Repositorio público, tres minutos y ventana exacta de nueva autoría siguen como restricciones conservadoras del dossier, no como disposiciones localizadas aquí. Los 150 USD están anunciados y regulados; el saldo individual sigue sin comprobar.
9. Historia de adjudicaciones se recorta a P1. La decisión de oferta no necesita un modelo predictivo.

## Marco normativo traducido a controles de producto
- Separar criterio económico, criterios cualitativos y elegibilidad. Una buena puntuación económica no acredita solvencia ni resultado total.
- Art.149: mostrar presunción/posible necesidad de justificación bajo escenario; nunca “excluida automáticamente” por precio anormal. Esta prohibición no niega que existan otras causas legales de exclusión.
- Con pluralidad y regla ausente: unknown, no aplicar automáticamente art.85.
- Aplicar grupo empresarial al conjunto de referencia de anormalidad; si grupo desconocido, resultado jurídico unknown. El conjunto de scoring no se altera por esta deduplicación.
- Conservar versiones de pliegos y correcciones. No solucionar una contradicción interpretando silenciosamente el documento.
- Información pública y escenarios propios. No recoger precios confidenciales actuales de rivales ni facilitar coordinación.
- Reutilización y protección de datos se revisan por fichero antes de publicación; no atribuir al Ministerio respaldo de BidLab. La lectura local no prueba autorización de redistribución de cualquier anexo.

## Gates y decisiones bloqueantes
| Gate | Estado al entregar | Evidencia / siguiente acción |
|---|---|---|
| G0 admisión/bases | PARCIAL / EXTERNO | Fechas, tracks, reglas públicas y condiciones de crédito leídas; aceptación individual, versión aplicable y saldo NC. Guardar evidencia privada; no bloquear trabajo offline ni publicar sin resolver. |
| G1 acceso/datos | PASS para ingesta; histórico CONDICIONAL | Feed/ZIP y mediciones ejecutadas. Dos expedientes con pares revisables; no corpus competitivo ni predictor. |
| G2 documentos | PASS descarga/lectura; derechos públicos POR CERRAR | Cinco PCAP y un PPT con hashes. Validar redistribución por documento antes de hacer público evidence/originals. |
| G3 Meta real | BLOCKED: sin credencial | Ninguna llamada inferencial ejecutada. Probar tools/meta_smoke.py con clave propia; salida/coste real, no fixture fabricado. |
| G4 matemática | PASS de especificación/oráculos; app PENDIENTE | Tres fórmulas reales inspeccionadas; Tías caso activable tras revisión local registrada; pruebas numéricas en examples. |
| G5 demo | PENDIENTE de desarrollo | Guion, datos y E2E definidos. No existe app ni vídeo en este paquete. |


## Hallazgos adicionales de reglas y créditos
El texto oficial conserva la titularidad del participante, permite componentes abiertos bajo su licencia y concede derechos amplios de explotación al organizador. Por ello, presentar únicamente material que el autor pueda divulgar y licenciar; no documentos de clientes. Se revisaron reglas completas públicas, no una aceptación individual.

Credit Terms: claim con correo de admisión y Team ID; cuenta API y medio de pago requeridos para usar el servicio, no para participar. El PDF prevé aplicar primero crédito y después cobrar uso adicional. Su apartado 3.5 dice que el crédito concedido no caduca, mientras el resumen del waiver menciona diez días: discrepancia registrada, prevalencia concreta a confirmar en versión aceptada. No sumar claims de compañeros en una cuenta. El consumo de créditos es opcional para competir.

La página de envío sin sesión no permitió comprobar campos autenticados. No se ha enviado formulario, reclamado crédito ni aceptado términos por el usuario. Evidencia: evidence/hackathon_rules_probe.json y hashes de descargas.

## Mercado: comparación de funciones declaradas, sin probar cuentas
| Producto / fuente primaria | Funciones observadas | Implicación |
|---|---|---|
| [Tendios](https://help.tendios.com/faqs/does-ai-analyze-tender-specs), [tecnología](https://help.tendios.com/faqs/how-does-tendios-ai-work) | Declara extracción de solvencia/criterios/fechas, alertas y preguntas con páginas; combina LLM y RAG. | Extraer y citar pliegos ya es una capacidad comercial existente. |
| [Buscalicitaciones](https://buscalicitaciones.com/) | Búsqueda, adjudicatarios, órganos, comparación, cobertura y marcas de calidad; datos/programas abiertos. | No competir construyendo otro buscador masivo durante diez días. |
| [LicitaPilot](https://licitapilot.com/) | Declara extracción con cita literal/estado de verificación y preparación con memoria de empresa. | No afirmar exclusividad de trazabilidad o decisión de viabilidad. |
| BidLab, D | Regla aprobada compilada a motor restringido, escenarios explícitos, curva coste/puntos y traza reproducible exportada. | Diferenciar por profundidad y fiabilidad del laboratorio. No se ha demostrado que ningún competidor ofrezca algo equivalente. |

