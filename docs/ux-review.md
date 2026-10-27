# Revisión UX (externa, 26-oct) — fuente de verdad para la reescritura

## Diagnóstico

**Textos**
- Voz de desarrollador, no humana: "41 puntos del backend", "extractor curated-excerpts-1",
  "semilla revisada, no extracción en vivo". Asustan y no informan.
- Jerga sin explicar: PBL, baja, presunción de anormalidad, coste sintético, proportional_inverse.
- Sin personalidad: tono burocrático plano; solo "La decisión la tomas tú" suena humano,
  y choca con el resto (mezcla tú/impersonal).
- Etiquetas crípticas: "p. 8", "Coincidencia: literal", "Ver fuente oficial (Atom)".

**Números**
- Precisión absurda: 109.638,026666666667; 46,4211/49,0000; SHA-256 completo en pantalla.
- Ejes saturados de etiquetas de 6 cifras: ilegibles. Redondear a euros o 1 decimal;
  hashes tras un "Detalles técnicos".

**Visual**
- Jerarquía plana y dato clave (precio, margen) en gris claro sobre blanco: contraste insuficiente.
- Pestañas deshabilitadas casi invisibles; texto fantasma solapado al panel;
  gráficas densas con tipografía mínima.

**Usuarios mayores**
- Texto base ~12 px, controles pequeños, sin paso a paso ni ayuda contextual.

**Prioridades:** 1) redondear y ocultar hashes; 2) lenguaje claro ("Presupuesto base",
"¿Oferta temeraria?"); 3) tipografía grande, contraste real y flujo guiado. La pantalla
está escrita para quien la construyó, no para quien decide si presentarse a una licitación.
Los códigos internos y las cifras en bruto aparecen antes que la respuesta.

**Textos (jerga)**
- Jerga de proyecto: "semilla", "sintéticos", "curada", "snapshot", "SHA", "PBL", "CPV",
  "PCAP", "Atom", "backend", "rama n3_no_trim". Ningún usuario sabe qué significan.
- Inglés y código sin traducir: "research copy; bytes not redistributed", "own",
  "proportional_inverse", "demo_source_snapshot_not_live", "muse-spark-1.3",
  "Aviso: document doc-tias-pcap: internal status…". Son mensajes de depuración
  y no deberían verse.
- Frases difíciles: "Conjunto completo supuesto (sin marcar: puntuación sin determinar)"
  lleva doble negación. Los textos de "Presunción de anormalidad" mezclan puntos
  medios, códigos y fórmulas.
- Sin voz: falta frase de conclusión arriba, p. ej.:
  "Con una rebaja del 5 %, ofertarías 112.419 € y sacarías 46 de 49 puntos".
- Tratamiento incoherente: el informe dice "la decisión la tomas tú", resto impersonal.

| Ahora | Mejor |
|---|---|
| Demo curada: cifras de semilla revisada… sintéticos | Datos de ejemplo. Los precios de los rivales y tu coste son inventados para que puedas probar. |
| PBL neto | Presupuesto de salida (sin IVA) |
| Baja propia sobre PBL neto | ¿Cuánto rebajas el precio? |
| Hipótesis de rivales | ¿Qué crees que ofrecerán los demás? |
| Presunción de anormalidad: Sin presunción bajo estos supuestos | Con estos datos, tu oferta no se consideraría anormalmente baja. |
| 46,4211 / 49,0000 | 46 de 49 puntos por precio |
| Límite (literal): 2026-11-25 23:59:00; Hora peninsular | Plazo: 25 de noviembre de 2026, 23:59 |
| Estado observado: PUB | Publicada |

NOTA LEAD: donde la revisión dice IVA, es IGIC (verificado en pliego: "incluido IGIC",
fixtures tax_kind=IGIC). "Presupuesto de salida (sin IVA)" → "(sin IGIC)".

**Números**
- Redondea: 46,421052631579 → 46,4 puntos; 109.658,02666666667 → 109.658 €;
  0,199425009251 → 19,9 %.
- Unifica formato: la pantalla muestra "112.419,20 €" pero el campo pide "106502.40"
  con punto y "formato 1234.56". Acepta la coma (usuario español).
- Fechas en lenguaje normal, no ISO.

**Visual**
- Pestaña activa sin texto en una captura; otras apagadas como desactivadas. Revisar contraste.
- Carga: cifras grises parecen deshabilitadas; paneles en blanco con "Cargando la curva…".
- Botones de página: "p. 8, p. 8, p. 9" repetidos sin decir nada. Mejor "Ver en el pliego, pág. 8".
- Gráfico: eje horizontal al revés, marcas irregulares, sin títulos. Vertical empieza en 44,
  letra diminuta.
- Panel de evidencia translúcido (texto mezclado). Botón "Cerrar" cortado.
- Móvil: tabla de cálculo cortada, palabras partidas ("Contratación del E stado",
  "Inform e"), ~15 tarjetas en una columna.
- Formulario de rivales: ocho campos seguidos, valores "a", "b", "own" incomprensibles.

**Usuarios mayores**
- Fuentes y avisos en 11-13 px gris claro. Sube a 17-18 px mínimo, contraste alto.
- Botones ≥44 px de alto, etiquetas claras, no solo contornos finos.
- Avisos ámbar repetidos tres veces: uno solo, claro, palabras sencillas.
- Una decisión por bloque, valores por defecto razonables. Códigos/hashes/fórmulas
  en desplegable "Detalles técnicos".

## Orden de trabajo (de la revisión)

1. Frase de conclusión arriba de cada pestaña.
2. Redondeo y formato único de números.
3. Reescritura de etiquetas y mensajes.
4. Tamaño de letra y contraste.
5. Códigos y avisos internos a "Detalles técnicos".
6. Arreglos del móvil y del panel de evidencia.

## Revisión ampliada

No se vio la pestaña Requisitos: el plan la incluye al aplicar las reglas.
Algunas capturas parecen tomadas mientras cargaba (cifras grises, pestañas a medio
pintar); señalado donde afecta.

### 1. Los tres problemas de fondo

1. La pantalla enseña cálculos, no respuestas. Nada dice "esto es lo que significa
   para ti".
2. Se ve la maquinaria interna. Hashes de 64 caracteres, identificadores como
   `cit-turnover_threshold`, estados como `demo_source_snapshot_not_live`, el modelo
   `muse-spark-1.3`, "Petición n.º 1". Todo para quien depura.
3. Hecha para ratón, buena vista y paciencia. Letra pequeña y gris, botones de
   contorno fino, slider "con ← →", formularios de ocho campos.

### 2. Errores de contenido

- "Margen sobre coste" mal rotulado: la fórmula (112.419,20 − 90.000) ÷ 112.419,20
  = 19,9 % es margen sobre el precio; sobre coste sería 24,9 %.
  DECISIÓN LEAD (verificado RULE_ENGINE:13,17): la fórmula es correcta por spec
  (margen sobre ventas); se corrige el NOMBRE, no la fórmula.
- Probable IGIC, no IVA (126.619,52 ÷ 118.336 = 1,07 exacto; Tías en Lanzarote).
  VERIFICADO LEAD: pliego dice "incluido IGIC", fixtures tax_kind=IGIC.
  La UI dice "con IGIC (7 %)".
- Dos importes sin explicar: presupuesto 118.336 € vs valor estimado 295.840 €
  (2,5×). Explicar la diferencia.
- Cifras repetidas en "Ver cálculo": "112.419,20 €" y "112419.20".
- Cita con basura de la web: empieza con "todetias.es sede.ayuntamientodetias.es".
  Limpiar extractos (Fase seed en curso).
- Cita y texto de página idénticos en el panel de evidencia: deduplicar.
- "Resumen" no resume: falta plazo con días restantes y qué puntúa
  (precio 49, memoria 22, perfiles).
- "Los demás puntos no se calculan en esta versión" puede leerse como que ya los
  tienes. Decir qué falta.
- Cuatro nombres para lo mismo ("oferta", "precio de oferta", "propia oferta",
  "mejor oferta incluyendo la propia") y tres para las fuentes ("Evidencia",
  "Citas verificadas", "Evidencia documental"). Unificar: "tu oferta",
  "la oferta más barata", "Dónde lo dice el pliego".
- Estado de pestañas: activa sin texto en una captura; "Evidencia" resaltada con
  contenido de Informe en otra. Si no es fotograma intermedio, es fallo de estado:
  investigar y corregir o refutar con test.

### 3. Pestaña por pestaña

**Resumen.** Bloque "Lo esencial" arriba: plazo ("Hasta el 25 de noviembre de 2026,
23:59. Quedan 29 días" — dinámico), presupuesto, duración y qué puntúa. Debajo,
tres pasos guiados: 1 Revisa los requisitos, 2 Prueba precios, 3 Guarda tu decisión.

| Ahora | Mejor |
|---|---|
| ← Biblioteca | ← Volver a mis licitaciones |
| PBL neto 118.336,00 € · bruto 126.619,52 € | Presupuesto: 118.336 € sin IGIC (126.619,52 € con IGIC) |
| Valor estimado | Valor estimado del contrato (incluye todo el periodo posible, no solo 24 meses) |
| Estado observado: PUB | Estado: Publicada |
| CPV 79411000, 71356200 | Tipo de servicio (código CPV), con descripción oficial al lado |
| Límite (literal) | Plazo para presentar ofertas |
| Fecha de la instantánea | Datos tomados el 25 de octubre de 2026, a las 14:12 |
| Reglas de precio: proportional_inverse | Cómo se puntúa el precio: cuanto más barata tu oferta, más puntos (hasta 49) |

Quita la tarjeta "Análisis en vivo (Meta)" de la vista normal. Si se queda, una línea:
"El asistente de IA no está disponible en esta demo".

**Precio.** Frase de conclusión arriba: "Con una rebaja del 5 % ofertarías 112.419 €
y ganarías unos 22.419 € (si tu coste es 90.000 €). Sacarías 46 de 49 puntos por
precio porque el rival A, con 106.502 €, ofrece menos." (Construida con datos reales
del resultado; si no hay rivales, variante sin esa cláusula.)

| Ahora | Mejor |
|---|---|
| Baja propia sobre PBL neto | ¿Cuánto quieres rebajar el precio? |
| Deslizador de baja (teclado: ← →) | Rebaja: 5 %, con botones grandes − y + |
| Presunción de anormalidad: Sin presunción… | ¿Oferta sospechosamente baja? No |
| tias-18-5 · rama tres licitadores… | Una oferta se considera sospechosa si baja de 98.692 €, que es un 10 % menos que la media. Ninguna de las tres lo hace. (Generado con cifras reales; generalizar por rama.) |
| Hipótesis de rivales | Prueba con precios de rivales (inventados, pon los que creas probables) |
| Conjunto completo supuesto (sin marcar: puntuación sin determinar) | Tomar estos como todos los rivales |
| Grupos independientes supuestos | Mover a "Opciones avanzadas": si dos rivales son de la misma empresa, la ley los cuenta como uno |
| Comparar escenarios / Guardar escenario | Guardar esta prueba |
| Guardado: 5d757753939f4b36… | Prueba «nombre» guardada. Verla en el informe |

Gráfico: eje de precios crece de izquierda a derecha, con título ("Precio de oferta,
en €"). Tu oferta con punto y etiqueta, rivales con líneas verticales. Título-mensaje:
"Por debajo de 106.502 € ya eres la oferta más barata. Bajar más no suma puntos
y resta ganancia." (Construido con datos reales.)

"Ver cálculo": frases numeradas ("1. Tu precio: 118.336 € menos un 5 % = 112.419,20 €.
2. La oferta más barata es 106.502,40 €. 3. Tus puntos: 49 × 106.502,40 ÷ 112.419,20
= 46,4."). Expresión técnica a "Detalles técnicos".

**Evidencia ("Dónde lo dice el pliego").** Traducir nombres de citas:

| Ahora | Mejor |
|---|---|
| cit-turnover_threshold | Volumen de negocio exigido |
| cit-insurance_threshold | Seguro exigido |
| cit-technical_services_threshold | Experiencia exigida en servicios técnicos |
| cit-estimated_value | Valor estimado del contrato |
| cit-pbl_gross | Presupuesto con IGIC |
| cit-initial_duration_months | Duración inicial |
| cit-price_points | Puntos por precio |
| cit-anomaly_single_discount… | Cuándo una oferta se considera sospechosa |
| Coincidencia: literal | Texto idéntico al pliego |
| Abrir | Ver página 10 |

Tarjeta del documento: "Pliego administrativo, 41 páginas. Mostramos solo los
fragmentos citados, no el PDF completo. Ver en la web oficial." Fuera SHA,
"derechos: solo investigación" y "bytes not redistributed" (a "Detalles técnicos").
Panel lateral opaco, "Cerrar" grande y siempre visible, "Página anterior / Página
siguiente". Deduplicar cita/texto idénticos.

**Informe.**
- Vacío: "Todavía no has guardado ninguna prueba. Una prueba es una rebaja con unos
  rivales concretos. Guárdala en Precio y aparecerá aquí." + botón "Ir a Precio".
- "Decisión manual" → "¿Qué has decidido?", con "Seguir estudiándola / Preparar
  oferta / Descartarla".
- "Comentario (se conserva tal cual…)" → "Tus notas (saldrán tal cual en el informe)".
- "Exportar informe" → "Descargar informe en PDF", visible sin scroll. Si desactivado,
  di por qué.
- "La decisión la tomas tú…" → "Tú decides. El informe recoge tu prueba, de dónde
  sale cada dato y lo que te falta por comprobar."

### 4. Voz y tono

- Una sola persona gramatical: tú (decisión lead, coherente con guía de voz).
- Frases ≤20 palabras, un dato por frase, verbos en activo.
- Palabras de la ley una vez con explicación ("oferta anormalmente baja (la que la
  ley considera sospechosa)"); resto del tiempo "sospechosamente baja".
- Cada bloque responde a una pregunta; el título es esa pregunta.
- "pliego" (PCAP explicado una vez). "rebaja", no "baja".

### 5. Números y formatos

| Caso | Regla |
|---|---|
| Euros en titulares | Sin decimales: 112.419 € |
| Euros exactos | Coma + 2 decimales: 112.419,20 € |
| Puntos | Un decimal: 46,4 de 49 |
| Porcentajes | Un decimal máx: 19,9 % |
| Medias y umbrales | Al euro: 98.692 € |
| Fechas | "25 de noviembre de 2026, 23:59", sin ISO |
| Campos de precio | Acepta coma y punto, teclado numérico en móvil |
| Hashes e IDs | Solo en "Detalles técnicos", abreviados + botón copiar |

Cuatro funciones de formato; ningún texto formatea por su cuenta (Fase 0).
NOTA LEAD: esto enmienda la regla de display de RULE_ENGINE:7 (puntos a 4, margen
a 2). Backend intacto (strings exactos); solo cambia el display. Ver enmienda.

### 6. Visual y accesibilidad (desktop primero; móvil secundario)

- Texto base 18 px, mínimo 16 px en notas, interlineado 1,5, unidades relativas.
- Contraste ≥7:1 en texto; fuera grises claros en cifras/notas.
- Botones 48 px mínimo, relleno o borde grueso, verbo claro.
- Foco visible 3 px con teclado.
- Carga: "Calculando…" con esqueleto, conserva valor anterior, anuncia a lectores.
- Tarjetas alineadas arriba (sin estiramiento igualador con huecos).
- Un solo aviso ámbar, frases enteras.
- "¿Qué significa esto?" junto a conceptos difíciles (2 líneas).
- Ningún estado solo por color; "Sí/No" con texto.

### 7. Móvil (secundario: solo no-romper)

- Sin cortes (tabla→frases lo resuelve), sin palabras partidas (overflow-wrap normal),
  sin scroll horizontal a zoom 200 %.
- NO hay barra inferior nueva en esta fase (desktop primero).
- Panel de evidencia a pantalla completa y opaco.
- Precio: ordenar por pregunta, plegar lo demás.

### 8. Fases (lead)

| Fase | Qué | Queda hecho cuando |
|---|---|---|
| 0. Reglas | Glosario, voz, formatos (HECHO) | Existe guía de voz + formatos + tests |
| 1. Carcasa+Resumen | Banner, "Lo esencial", pasos, pestañas, tab-state bug, Detalles técnicos en shell | Resumen se entiende en 5 segundos |
| 2. Precio | Conclusión, controles grandes, rivales, gráfico, cálculo en frases, margen+IGIC | Nueva persona responde "¿cuánto ofertas?" sin ayuda |
| 3. Fuentes+Informe | Nombres citas, panel opaco, informe, PDF/print | Informe descargado en <3 clics |
| 4. Accesibilidad | 18 px, contraste 7:1, botones 48 px, foco, carga, aviso único, ayuda contextual | axe sin errores + teclado completo |
| 5. Móvil no-romper | Sin cortes, drawer pantalla completa, orden Precio | Sin scroll horizontal a 200 % |
| 6. Semilla | Limpieza extractos (EN CURSO paralelo) | Cero basura web en citas |

Prioridad: contenido (margen, IGIC) + fases 1-2, luego 3-4.

### 9. Comprobación

- Tareas: "¿Cuánto ofertarías rebajando un 5 %?", "¿Hasta cuándo puedes presentar?",
  "Descarga el informe". Éxito: sin ayuda, <3 min. (Requiere personas; queda para autor.)
- Cinco segundos en Precio: ¿qué recuerdan? (Autor.)
- INFLESZ ≥65. (Orientativo; sin gate automático.)
- axe/Lighthouse, teclado solo, lector en slider, zoom 200 %. (Gates E2E.)

### 10. Protocolo de jueces (lead, obligatorio hasta cierre)

Cada entrega de escritor pasa por 4 jueces independientes (contexto fresco,
solo lectura) antes de commitear. Cada juez puntúa 0-10 SU dimensión + lista
issues con file:line. Listón: **≥9,5 en las 4 dimensiones**. Si alguna baja,
el escritor itera (mismo u otro agente) hasta pasarlo. BoN donde el juicio
bifurque de verdad.

- J1 Comprensión senior: persona de 70 años, primera licitación online. ¿Entiende
  cada pantalla sin ayuda? ¿Responde "¿cuánto oferto?", "¿hasta cuándo?",
  "¿es sospechosa?" leyendo solo titulares?
- J2 Voz y copy: conformidad con docs/voice-guide-es.md (tú único, ≤20 palabras,
  preguntas como títulos, glosario, cero jerga/IDs/inglés visibles).
- J3 Accesibilidad: contraste, tamaños, targets, foco, estados de carga, lector,
  teclado completo, zoom 200 %. axe como suelo, no como techo.
- J4 Corrección factual: cada cifra/afirmación visible trazada a evidencia
  (fixtures/citas/RULE_ENGINE). Tasas derivadas rotuladas como derivadas;
  zonas horarias no probadas prohibidas; fechas dinámicas correctas.

Evidencia: capturas qa-* regeneradas por entrega + E2E verde + veredictos
archivados en docs/verification-log.md.

