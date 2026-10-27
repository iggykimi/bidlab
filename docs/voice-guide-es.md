# BidLab — Guía de voz en español (v1)

Esta guía es la única autoridad de voz.
Todo texto en español obedece esta guía.
Su ámbito cubre la interfaz, los textos del servidor y el informe.
Si otro documento discrepa, esta guía gana.
Después corrige el documento que discrepa.

## ¿Qué manda esta guía?

Esta guía manda cada palabra que lee el usuario.
El usuario es una pequeña empresa que licita.
Ella conoce pliegos, ofertas y rebajas.
Ella no conoce nuestro código ni nuestra jerga.
Escribes para ella, no para el equipo.

## ¿A quién hablas y cómo le tratas?

Siempre hablas de tú.
Nunca usas usted.
Nunca mezclas tú con fórmulas impersonales.
El servidor también habla de tú en sus textos.
Dices «Revisa tu oferta» en cada capa.
Dices «Te falta un dato» y no «Dato pendiente».
Dices «Guarda tu escenario» y no «Se guarda».

## ¿Cómo construyes cada frase?

Cada frase lleva un solo dato.
Cada frase tiene veinte palabras como máximo.
Cada frase usa un verbo activo.
Dices «BidLab conserva tu escenario».
No dices «Tu escenario es conservado».
Usas caja de frase en títulos y etiquetas.
No usas exclamaciones.
No usas marcas de IA.
No escribes «no es X, es Y».
No escribes listas de negaciones.
No escribes preguntas que te respondes solo.

## ¿Cómo titulas cada pantalla?

Cada título es una pregunta del usuario.
El título promete la respuesta de la pantalla.
Escribes «¿Cuánto oferto?».
Escribes «¿Puedo presentarme?».
Escribes «¿Mi oferta parece sospechosa?».
Escribes «¿Qué puntos consigo?».
Un título lleva una sola pregunta.
La respuesta empieza justo debajo.

## ¿Qué palabra usas?

Usas la palabra nueva, nunca la antigua.
La tabla manda en toda la interfaz.
Aplícala también a los textos del servidor.

| Término antiguo | Término nuevo | Nota |
|---|---|---|
| PBL neto | Presupuesto de salida sin IGIC | En Canarias el impuesto es el IGIC |
| PBL bruto | Presupuesto de salida con IGIC | — |
| PBL (a secas) | Presupuesto de salida | Especifica siempre con o sin IGIC |
| baja | rebaja | Verbo: rebajar; «rebaja del 5 %» |
| descuento (en UI) | rebaja | En la API vale `discount_rate` |
| presunción de anormalidad | oferta sospechosamente baja | Nota legal en el primer uso |
| anormalidad (a secas) | oferta sospechosa | Solo como forma corta posterior |
| baja temeraria | oferta sospechosamente baja | Término antiguo, no lo uses |
| coste sintético | coste de ejemplo | Coste ficticio de la empresa de ejemplo |
| empresa sintética | empresa de ejemplo | — |
| proportional_inverse | (no se muestra) | Describe el resultado con palabras |
| semilla | (no se muestra) | El contenido es un ejemplo |
| curada / curado | ejemplo | «Ejemplo Tías», no «semilla curada» |
| snapshot | (no se muestra) | Si nombras la copia: «copia guardada» |
| backend | (no se muestra) | Di «la aplicación» o no digas nada |
| hash / hashes / huella | (no se muestra) | Nunca enseñes valores hash |
| cit-* | (no se muestra) | Las citas enseñan texto y página |
| PCAP | pliego de condiciones (PCAP), luego pliego | Explica una vez por pantalla |
| scoring | puntos | — |
| puntuación | puntos | «46,4 de 49» |
| template | fórmula | «Fórmula autorizada» en el primer uso |
| regla de precio / pricing_rule | fórmula de puntos | — |
| policy | regla aplicada | — |
| branch | caso | «Caso 2» en vez de «rama 2» |
| scope | ámbito | `__whole__` es todo el contrato |
| unknown | sin determinar | Nunca muestres `unknown` |
| unsupported | no soportada | «Fórmula no soportada» |
| requisito | requisito | Condición para presentarte |
| elegibilidad | ¿puedes presentarte? | En tablas: «cumple requisitos» |
| criterio de puntuación | criterio de puntos | — |
| traza / trace | detalle del cálculo | — |
| supuesto / hipótesis | supuesto | Valor que declaras tú |
| pendiente / pending | te falta | «Te falta revisar…» |
| escenario | escenario | Tu hipótesis guardada |
| informe | informe | Tu registro de decisión |
| margen / beneficio | margen / beneficio | — |
| extracto / evidencia | cita | Siempre con texto y página |
| revisión | revisión | Versión aprobada de una regla |
| licitación / lote | licitación / lote | — |
| oferta | oferta | Tu oferta u oferta rival |
| endpoint / parse / workspace | (no se muestra) | Traduce la idea o calla |

## ¿Cómo presentas la oferta sospechosamente baja?

El primer uso de cada pantalla lleva nota legal.
Escribes «oferta sospechosamente baja (la ley la llama presunción de anormalidad, art. 149 LCSP)».
Después usas «oferta sospechosamente baja» sin nota.
En tablas estrechas vale «oferta sospechosa».
Añades una frase que explica el riesgo.
Escribes «Si tu oferta cae aquí, la administración te pide que justifiques tus costes».
Nunca anuncias una exclusión automática.
La presunción invita a justificar, no expulsa.

## ¿Cómo nombras el pliego?

La primera mención explica la sigla.
Escribes «pliego de condiciones (PCAP)».
Después escribes solo «pliego».
Repites la explicación en cada pantalla nueva.
Repites la explicación en cada informe.

## ¿Qué números muestras y cómo?

Muestras números con los formateadores canónicos.
Ningún otro archivo formatea números.
Todos los números pasan por `apps/web/src/lib/format.ts`.

| Formateador | Salida | Uso |
|---|---|---|
| `formatEurosHeadline` | 118.336 € | Titulares y cifras grandes |
| `formatEurosExact` | 118.336,00 € | Tablas y detalle |
| `formatPoints(valor, máximo)` | 46,4 de 49 | Puntos conseguidos |
| `formatPercent` | 5,0 % | Rebajas y márgenes |
| `formatFechaNormal` | 25 de noviembre de 2026, 23:59 | Fechas |
| `parsePrecioInput` | 118336.50 | Entrada de precios |

Aceptas coma y punto en los precios.
El usuario español escribe coma de forma natural.
El teclado móvil usa `PRECIO_INPUT_MODE` (`decimal`).
Nunca muestras un ISO crudo en la interfaz.
Nunca muestras `NaN` ni `Infinity`.
Lo no calculable muestra «—».

## ¿Qué no muestras nunca?

Nunca muestras códigos internos como texto principal.
Nunca muestras `proportional_inverse`.
Nunca muestras `semilla`, `curada`, `snapshot` ni `backend`.
Nunca muestras hashes ni identificadores `cit-*`.
Nunca muestras estados crudos (`review_status`, `match_status`).
Traduce cada código a palabras del usuario.
Relega el código crudo a «Identificadores y códigos».
Esa sección guarda el valor técnico completo.

## ¿Cómo escribes un error?

Cada error trae qué pasó y qué haces.
Escribes «No pudimos evaluar tu oferta. Comprueba que la aplicación local responde».
Añades el código técnico entre paréntesis.
Escribes «(código: basis_not_approved)».
Usas imperativo de tú en la acción.
Escribes «Reintenta», «Revisa» o «Carga».
Si no hay acción posible, lo dices.
Escribes «No has enviado ningún documento todavía».

## ¿Cómo citas fuentes?

Cada dato sensible enseña su fuente.
La cita trae texto literal y página.
Escribes «Pliego, página 10».
Lo no verificado se nombra con honestidad.
Escribes «sin determinar» o «por verificar».
Nunca rellenas un hueco con un número.
Nunca presentas hipótesis como hechos.

## Historial

- v1 (27 de octubre de 2026): primera autoridad única de voz. Fija tuteo total, frases cortas, títulos pregunta, glosario nuevo y formateadores canónicos.
