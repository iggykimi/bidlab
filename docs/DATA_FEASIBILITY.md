# Viabilidad de datos — prueba ejecutada
**Conclusión:** acceso oficial viable para metadatos, pliegos y determinados resultados. **No hay base demostrada para reconstruir todas las ofertas ni entrenar un predictor de ganar.** Los porcentajes de esta sección describen únicamente los archivos descargados, no el universo nacional.

## Experimentos y bytes
| Muestra | Fuente | Resultado |
|---|---|---|
| Feed de perfiles alojados sin menores | URL D03 de SOURCE_AUDIT | HTTP 200; 1.970.633 bytes; SHA-256 c15cf7144811345e9f547cc9b4a86e9054831bdc8c84481bdb830ca81ddb0da4 |
| ZIP oficial 2012 | URL D04 | HTTP 200; 16.008.909 bytes; SHA-256 de130e278de9877fe5840ba1263de75d1894949155989050edfad5cc76247763 |
| Contenido ZIP | zipfile + parser XML seguro, sin extraer rutas a disco | 38 miembros Atom; 246.398.228 bytes descomprimidos; 19.000 entradas; 11.262 atom:id distintos |
| Documentos | seis URLs GetDocumentByIdServlet tomadas literalmente del feed | Cinco PCAP y un PPT, todos HTTP 200 y abiertos con lector PDF; metadatos exactos en evidence/download_manifest.json |

El feed indica updated 2026-10-25T20:03:14.004+01:00. La consulta fue el 26 de octubre: la app no lo rotulará como información en tiempo real. Se observó un enlace next real; no se recorrió toda la cadena. El ZIP de 2012 incluye nombres de miembros con fechas posteriores: no interpretar año del archivo como año de actualización o adjudicación de cada fila.

El parser exploratorio completo está en tools/probe_placsp.py. La sonda no es todavía el ETL de producto: conserva filas de resultado por versión para auditar el archivo; **no se deben sumar sus filas como contratos únicos**. Los 22 candidatos recientes estructurales siguen con semantic_comparability=UNREVIEWED.

## Completitud medida
### Feed reciente
Grano de expedientes: 68 entradas / 68 IDs distintos, sin duplicados en este fichero inicial.

| Campo / condición | Numerador / denominador | Porcentaje |
|---|---:|---:|
| PBL neto, PBL bruto, VEC | 68/68 cada campo | 100% |
| Algún CPV, NUTS | 68/68 cada campo | 100% |
| Algún lote | 20/68 | 29,41% |
| Algún TenderResult | 22/68 | 32,35% |
| URL de PCAP en LegalDocumentReference | 56/68 | 82,35% |

Grano de resultados: **33 TenderResult**, incluyendo desiertos y otras decisiones.

| Campo / control | Numerador / denominador | Porcentaje |
|---|---:|---:|
| Importe adjudicado neto presente | 27/33 | 81,82% |
| Número de ofertas recibido presente | 33/33 | 100% |
| LowerTenderAmount y HigherTenderAmount | 13/33 cada campo | 39,39% |
| Candidato estructural después de controles | 22/33 | 66,67% |
| Todas las ofertas individualizadas de todos los licitadores | No identificado como tabla en esta sonda | No estimable |

Flags no excluyentes: 6 sin importe adjudicado, 6 sin ganador, 4 resultados con adjudicación múltiple sin lote resoluble y 1 importe mayor que presupuesto. Un campo presente puede valer cero, estar desactualizado o tener otra base económica.

### ZIP histórico
Los siguientes denominadores son **versiones de entradas**, no expedientes únicos depurados.

| Medida | Resultado |
|---|---:|
| Versiones adicionales sobre IDs únicos | 7.738/19.000 (40,73%) |
| PBL neto y bruto / CPV presentes | 19.000/19.000 |
| VEC presente | 10.616/19.000 (55,87%) |
| NUTS presente | 18.526/19.000 (97,51%) |
| Entradas con resultados | 17.892/19.000 |
| Expedientes distintos con enlace PCAP observado en alguna versión | 5.626/11.262 (49,96%) |
| TenderResult totales, antes de deduplicar | 26.765 |
| Award net presente | 25.933/26.765 (96,89%) |
| ReceivedTenderQuantity presente | 7.122/26.765 (26,61%) |
| Lower / Higher presentes | 2.947 / 2.852 de 26.765 |
| Candidatos estructurales por versión, no corpus validado | 19.823 |

El flag “importe adjudicado cero” apareció 1.997 veces y “PBL no positivo” 1.331. No reemplazar nulos por cero. La diferencia de cobertura entre muestras es material; el ZIP 2012 se usa para probar ingesta/cambios, **no como contexto comercial actual de la demo**.

## Cinco ejemplos identificables
Las URLs completas de ficha y PDF se conservan en evidence/document_catalogue.json y download_manifest.json; los enlaces de esta tabla son IDs oficiales observados.

| ID oficial / expediente | Datos observados | Decisión |
|---|---|---|
| [20777838](https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=4mTE7tVTKp4IYE3ZiZ%2BxmQ%3D%3D), 2026/00006554N | PAI Tías; PBL neto 118.336; bruto 126.619,52; VEC 295.840; PCAP 41 páginas, precio 49 puntos p.10; anormalidad p.20 | Caso P0. Mantener impuestos IGIC, horizonte inicial 24 meses y prórrogas aparte. |
| [20777832](https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=xhe%2FPZ%2B0JKoeIBJRHQiPkQ%3D%3D), 26 036 SR JD AB UA21 | Alfresco; PBL neto 575.960; PCAP 41 páginas y PPT descargado; fórmula logarítmica p.9 | Caso de revisión/ambigüedad, no activación automática. |
| [20706136](https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=Ph8JhyG8lUU7u6%2B%2FR7DUoA%3D%3D), PA-1/2026 | Marketing AMTC; PBL/VEC Atom 118.054,97; bruto 148.217,96 no reconciliado; PCAP 63 páginas; fórmula VEC p.15, anexo p.57 incluye prórroga | Bloqueado por base/horizonte y regla no cerrados. Plazo Atom 26/10/2026 09:00 sin zona explícita: no inferir zona por Canarias. |
| [17907789](https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=Wpg2%2Fh%2BIqaacCF8sV%2BqtYA%3D%3D), SERV-E-PA-47-2025 | Limpieza Tomelloso; PBL neto 1.457.330; adjudicado 1.163.252,09; seis ofertas recibidas; PCAP p.1–2: tanto alzado y un año inicial | Par neto revisable: baja adjudicada 20,1792257%. Descripción del resultado confirma el precio, no contiene todos los importes rivales. |
| [20010571](https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=CnUJSe9O2JNrhBlEHQFSKA%3D%3D), PA 79/2026 | Licencias Microsoft Torrejón; tres lotes; PCAP p.6 confirma presupuestos 775.000 / 171.074,38 / 35.000; award net 663.269,40 / 152.062,01 / 29.139,97 | Ratios por lote: 14,4168516%, 11,1135110%, 16,7429429%. No dividir cada adjudicación por 981.074,38 del total. |

Estos dos últimos expedientes proporcionan **cuatro observaciones con pares de importes y ámbito revisados documentalmente**, no cuatro competidores ni un grupo homogéneo por CPV. La resolución de adjudicación original de Microsoft aún puede requerir revisión para usos más exigentes. Las bajas son ratios observados, no una medida de ahorro causal ni precios efectivos de ejecución.

Contraejemplos reales:
- Expediente 2025-04134, ID 18210249: dos adjudicatarios sin lote resoluble; dividir 116.200 por 727.780 aparentaría baja 84,03%. Se excluye hasta aclarar alcance.
- 15825/2026, ID 19972438: presupuesto 85.800 frente a adjudicación 343.200; posible diferencia temporal/unidad. Flag, no baja negativa presentada como competitividad.
- Un TenderResult con ResultCode=3 y 0 ofertas no es un adjudicatario de precio cero.
- Marketing: no aplicar IVA 21% por defecto a bruto/neto. En Canarias puede existir IGIC y el dato bruto concreto presenta una discrepancia adicional.

## Rutas XML exactas
Namespaces observados:
- a = http://www.w3.org/2005/Atom
- cbc = urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2
- cac = urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2
- ext = urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonAggregateComponents-2
- bext = urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonBasicComponents-2
- at = http://purl.org/atompub/tombstones/1.0

Base C = a:entry/ext:ContractFolderStatus. Los prefijos de serialización pueden cambiar; comparar URI, no texto del prefijo.

| Concepto | Ruta relativa |
|---|---|
| ID estable del feed | a:entry/a:id |
| Versionado | a:entry/a:updated; a:entry/a:link/@href |
| Número administrativo / estado | C/cbc:ContractFolderID; C/bext:ContractFolderStatusCode |
| Órgano | C/ext:LocatedContractingParty/cac:Party/cac:PartyName/cbc:Name |
| PBL sin impuestos | C/cac:ProcurementProject/cac:BudgetAmount/cbc:TaxExclusiveAmount |
| PBL con impuestos | Mismo BudgetAmount/cbc:TotalAmount |
| VEC | Mismo BudgetAmount/cbc:EstimatedOverallContractAmount |
| CPV | C/cac:ProcurementProject/cac:RequiredCommodityClassification/cbc:ItemClassificationCode |
| NUTS de ejecución | C/cac:ProcurementProject/cac:RealizedLocation/cbc:CountrySubentityCode |
| Lote y presupuesto | C/cac:ProcurementProjectLot/cbc:ID; su cac:ProcurementProject/cac:BudgetAmount/cbc:TaxExclusiveAmount |
| PCAP / PPT | C/cac:LegalDocumentReference o TechnicalDocumentReference / cac:Attachment/cac:ExternalReference/cbc:URI |
| Plazo presentación | C/cac:TenderingProcess/cac:TenderSubmissionDeadlinePeriod/cbc:EndDate, EndTime, Description |
| Resultado / fecha | C/cac:TenderResult/cbc:ResultCode y AwardDate |
| Ofertas recibidas | C/cac:TenderResult/cbc:ReceivedTenderQuantity |
| Mínimo y máximo publicados | C/cac:TenderResult/cbc:LowerTenderAmount y HigherTenderAmount |
| Ganador | C/cac:TenderResult/cac:WinningParty (no se importa NIF personal en MVP) |
| Lote del resultado | C/cac:TenderResult/cac:AwardedTenderedProject/cbc:ProcurementProjectLotID |
| Adjudicación sin impuestos | C/cac:TenderResult/cac:AwardedTenderedProject/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount |
| Adjudicación con impuestos | Mismo LegalMonetaryTotal/cbc:PayableAmount |

Ejemplo minimizado y sin datos personales en examples/placsp_minimal.xml. Preserva IDs, importes y referencia de lote observados; no se hace pasar por fichero original completo. En el producto, conservar snapshot original privado y SHA-256. Los estados se guardan también en bruto; no mapear RES automáticamente a “adjudicado”: examinar ResultCode/ganador.

## ETL implementable e idempotencia
1. P0 importa un archivo local permitido o el fixture curado. P1 descargador CLI de URLs del catálogo, nunca endpoint de “importar cualquier URL”.
2. Guardar bytes en storage/raw/<sha256>, manifest con URL, retrieved_at, ETag, Last-Modified, content-type. No usar ETag como hash.
3. ZIP: rechazar rutas absolutas/.., miembros >64 MiB, total >512 MiB, >1.000 miembros o ratio compresión >100; leer miembros a stream sin extractall. XML: sin DTD, entidades externas ni red.
4. Guardar notice_version con unique(feed_id, atom_id, updated_utc, raw_sha). Si mismo ID/updated y distinto hash: conflicto en cuarentena, no elegir arbitrariamente.
5. Elegir versión de máxima fecha UTC observada antes de la fecha de corte. at:deleted-entry invalida estado actual, conserva historia. No recuperar ofertas desaparecidas mezclando campos de distintas versiones.
6. Tender único por (feed_id, atom_id). Número ContractFolderID no es único nacional. P0 no fusiona feeds distintos.
7. Scope = expediente completo o lote explícito. Presupuesto lote no hereda presupuesto total. TenderResult referencia lote cuando exista; varios resultados sin lote => comparability unknown.
8. Decimal desde texto; guardar moneda, tipo de impuesto, unidad (lump_sum/unit_price/percentage/framework_cap/unknown), horizonte y flags. Resolver timezone por fuente explícita; conservar literal cuando falta.
9. Un “candidato estructural” no es aceptado. Revisión PCAP/resultado comprueba horizonte, cantidades/unidades, impuestos, modificaciones, acuerdo marco y adjudicación parcial. Solo status comparable entra en agregados.
10. Transacción por snapshot; import del mismo hash debe dejar el mismo número de filas. Informe QA separa versiones, expedientes, lotes, resultados y pares elegibles. No guardar PII de contacto sin necesidad.
11. Para el ZIP histórico, la sonda actual no materializa todavía el modelo final ni trata tombstones como ETL de producto; tests obligatorios de esa funcionalidad antes de ingestión operativa.

## Uso estadístico permitido
Definir d=(B_net-A_net)/B_net, solo B>0 y ambas magnitudes en igual scope, moneda, horizonte y unidad, con revisión comparable. Excluir award<=0, presupuesto<=0, prórroga frente a duración inicial, adjudicación parcial no resuelta, máximo de gasto de acuerdo marco, precio unitario sin cantidad común y versiones repetidas. Nunca imputar datos ausentes.

Filtros P1: CPV exacto o familia elegida conscientemente, tipo contrato, periodo de adjudicación, territorio ejecución, unidad y horizonte. No ampliar filtros silenciosamente. El objetivo no se incorpora a su propio histórico; corte temporal anterior al expediente objetivo. n es número de observaciones scope adjudicadas, n_expedientes se muestra aparte.
- n=0: “No hay adjudicaciones comparables”.
- 1≤n<20: tabla individual con fuente, sin histograma ni percentiles como referencia de mercado.
- n≥20 y al menos 3 órganos: histograma con bins fijos de 5 puntos porcentuales; mediana, Q1/Q3, n y exclusiones. Cuantiles tipo 7/interpolación lineal especificados en RULE_ENGINE. No inferencia poblacional.
- Varias observaciones del mismo expediente se identifican; no intervalos bootstrap iid ignorando agrupación.
- No entrenamiento, simulación Monte Carlo de ganar, backtest de resultados ni calibración de probabilidades en P0/P1: faltan etiquetas y universo completo. Escenarios manuales no requieren inventar probabilidades.

## Descarga responsable y derechos
Datos desde catálogos oficiales explícitos; conservar avisos y actualización. El robots observado desaconseja navegación automatizada del portal. No se identificó una cuota oficial de descargas en las páginas leídas; imponer decisión propia de una conexión, ≥1 s entre recursos y cache, sin presentarla como límite del proveedor. Ante 403/429 detener y usar descarga manual; no eludir restricciones ni rotar IP.

Se incluyen copias de investigación para revisar, con publicación desactivada por defecto. Antes de repo público verificar titularidad/condiciones de cada PCAP/PPT y anexos; no aplicar una licencia MIT de código a documentos externos. Alternativa reproducible: comando de descarga explícito desde manifest y datos fácticos/ejemplos propios; si no hay autorización para redistribuir un PDF, no incorporarlo al repo. La demo offline se prepara en el ordenador del autor con una copia obtenida lícitamente y las condiciones de exhibición revisadas.

