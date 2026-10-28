# Motor de reglas — especificación matemática
El modelo interpreta documentos; este motor calcula. Las siguientes fórmulas se localizaron en PCAP reales descargados, no son fórmulas genéricas atribuidas a ellos. Los precios usados en ejemplos numéricos son **hipótesis de prueba**, nunca ofertas reales publicadas. Estado de implementación: implementado (`domain/{money,scoring,expressions,anomaly,eligibility,groups}.py`, `ENGINE_VERSION="1.0.0"` en `bidlab/__init__.py`); oráculos independientes en `examples/math_vectors.json` (`tools/verify_math_oracles.py`).

## Precondiciones y representación
Entrada aprobada: scope/horizonte/moneda/unidad, regla y revisión, precio propio derivado de descuento, coste coherente y escenario rival. P0 solo EUR, precio global neto y duración inicial explícita.

Decimal con precision=34 y contexto local. Dinero derivado del slider se cuantiza a 0.01, ROUND_HALF_UP, antes de puntuar; no redondear cada operación de puntos. Serializar score/ratio a máximo 12 decimales (ROUND_HALF_UP). Display (enmienda 26-oct, revisión UX): titulares redondeados para lectura — puntos a 1 decimal ("46,4 de 49"), margen en % a 1 decimal ("19,9 %"), euros en titulares sin decimales, euros exactos con 2; backend intacto (strings exactos) y exactos visibles en "Detalles técnicos". Informe indica que la precisión mostrada es teórica salvo que el PCAP establezca un redondeo; si lo establece, versionar regla con ese redondeo exacto. Margen mostrado es sobre ventas ((P-K)/P); etiquetarlo así, nunca "sobre coste".

P=B×(1-d), 0≤d≤0.40 en UI P0, B=budget_net aprobado para ese ámbito. B>0, P>0; techo aprobado C exige P≤C. API rechaza descuentos fuera del alcance P0, no confundir ese alcance con un límite legal. B y C pueden diferir en un caso complejo; no habilitar sin revisión.

Coste K=direct_cost+overhead del mismo scope y horizonte.
- beneficio=P-K
- margen=(P-K)/P
- precio objetivo de margen m: K/(1-m), con 0≤m<1; es referencia del usuario, no oferta recomendada.
- baja adjudicada histórica=(B-A)/B solo con par comparable.

Costes negativos =>422. Coste/periodo distinto o no proporcionado => profit/margin=null, puntos pueden calcularse si su base sí está aprobada. Ganar dinero con coste sintético no acredita viabilidad real. Margen sobre ventas y recargo sobre coste son magnitudes distintas; la UI usa el primero. Techo de coste (`money.cost_ceiling`, expuesto como `max_cost_net` por `services/stress.py`): a precio fijo P y beneficio mínimo M, K_techo = P − M; null si negativo. Los costes nunca cambian los puntos: un céntimo por encima del techo rompe solo la condición de beneficio.

## Conjunto rival y mejor oferta
Un escenario assumed, complete=true representa **un conjunto hipotético** de ofertas admitidas. La mejor oferta económica para puntuar es min(P, rivales). La propia oferta debe entrar en cada punto de la curva: nunca congelar best_price al mínimo rival si el usuario lo mejora.

Si no se declara conjunto completo, score.status=unknown y value=null cuando depende de min/media desconocidos. Un mínimo observado en un acta parcial no demuestra que sea mínimo de todas las ofertas válidas. Un escenario completo sin rivales expresa un único licitador hipotético, no una predicción del número real.

Ofertas inválidas/negativas/cero, moneda/unidad incompatible o más de 20 rivales =>422. No retirar automáticamente del scoring una oferta marcada como presuntamente anormal: puede justificarse. El usuario puede construir otro escenario explícito de ofertas admitidas, sin que la app decida su exclusión.

## Tres casos reales
### R1 — Tías, activación P0
Expediente 2026/00006554N, PCAP SHA en manifest, página PDF 10, cláusula 12.2; precio 49 puntos. Texto distingue proporción inversa y directa. Para precio se selecciona inversa mediante revisión:

S(P)=49×min(P,R1,...,Rn)/P.

Presupuesto inicial neto B=118336.00, periodo 24 meses, IGIC separado. Referencia es presupuesto inicial; VEC295840 no es slider_base.

Ejemplo A: rivales hipotéticos 106502.40 y110052.48, K=90000.00 sintético.
| Baja | Precio | Beneficio | Puntos de precio |
|---:|---:|---:|---:|
| 5% | 112419.20 | 22419.20 | 46.421052631579 |
| 15% | 100585.60 | 10585.60 | 49.000000000000 |
| 30% | 82835.20 | -7164.80 | 49.000000000000 |

Bajar de 15 a30 no mejora puntos en ese escenario y sí reduce beneficio. La interfaz puede mostrar esa dominancia **bajo ese escenario**, no recomendar una baja óptima universal. Rivales alternativos 100585.60 y110052.48 con precio propio al5% dan43.842105263158.

Solo se calculan los49 puntos de precio. Otros criterios suman51 y no se estiman automáticamente; no usar este resultado para ordenar ofertas completas o dar probabilidad de ganar.

### R2 — Alfresco, interpretación propuesta con ambigüedad
Expediente 26 036 SR JD AB UA21, ID20777832, PCAP p.9, precio65 puntos. La línea impresa muestra “log mo/0”; el párrafo define O como oferta a valorar y log base10. La inspección visual confirma que no es solo un cambio introducido por extracción de texto.

Interpretación candidata:
S(P)=65×(1+log10(best_price/P)), restringida al intervalo0..65 según texto.
  
Ejemplo hipotético P=100000 y best=80000: 58.700849154476 puntos a 12 decimales (oráculo examples/math_vectors.json; el valor impreso anterior contenía un dígito erróneo y se corrige por el oráculo independiente). P=best =>65; best/P≤0.1 =>0 si se confirma el tratamiento de límite inferior. “Despreciando puntos fuera del intervalo” puede requerir confirmar la interpretación exacta del clamp; no asignar cero por una lectura dudosa sin revisión.

Estado en semilla: blocked/pending, con issue sobre denominador y límites. El motor puede verificar la plantilla logarítmica en tests, pero la regla del expediente no pasa a approved por ese hecho. No corregir un error material del PCAP con una conjetura silenciosa.

### R3 — Marketing AMTC, base VEC y horizonte no resuelto
PA-1/2026, ID20706136, PCAP p.15, precio35 puntos:
S(P)=35×(VEC-P)/(VEC-min(P,R...)).
  
VEC según Atom118054.97; la fórmula define VEC y el anexo V, p.57, pide importe de año inicial más eventual prórroga. Bruto148217.96 no reconciliado con el neto; no forzar IVA/IGIC uniforme ni cambiar referencia a PBL.

Ejemplo puramente matemático usando referencia118054.97, P100000, best90000: consultar resultado exacto en examples/math_vectors.json. Denominador cero (todas ofertas coinciden con referencia) =>unknown:zero_denominator. Si el pliego no especifica una excepción, no repartir35 o0 por conveniencia. Por debajo de referencia y best positivo, máximo35 cuando P=best; no clamp adicional silencioso.

Estado real del expediente: blocked hasta confirmar unidades/periodo y tratamiento de referencias. Su plazo observado era26/10/2026 09:00 sin zona explícita; es ejemplo documental, no recomendación de licitar ahora.

## DSL / compilación segura
P0 no admite lenguaje libre ni Python. Plantilla aprobada genera un AST canónico. Operadores JSON: add, sub, mul, div, min, max, log10. Variables permitidas: own_price, best_price, reference_price, max_points. Constantes Decimal finitas de magnitud≤10^12. (Verificado idéntico: `ALLOWED_OPS`/`ALLOWED_VARS`/`MAX_CONST_ABS` en `domain/expressions.py`; `MAX_RIVALS=20` en `domain/scoring.py`.)

Ejemplo inversa:
~~~json
{"kind":"call","op":"div","args":[
  {"kind":"call","op":"mul","args":[
    {"kind":"var","name":"max_points"},
    {"kind":"var","name":"best_price"}]},
  {"kind":"var","name":"own_price"}]}
~~~
No eval, exec, ast.parse de código, imports, llamadas de atributos, lambdas, acceso a ficheros/red ni interpolación de strings a expresiones. Validación recursiva enum/arity:
- add/sub/mul/div: exactamente2 hijos.
- min/max: 2..8.
- log10:1 hijo, argumento>0.
- Profundidad≤12, nodos≤128, operaciones≤256 por evaluación (`MAX_DEPTH`/`MAX_NODES`/`MAX_OPS` en `domain/expressions.py`); curva máx 201 puntos (`CurveRequest.points` máx 201 en contrato). Rechazar ciclos si se usa representación en memoria.
- Divisor0 =>unknown con traza y motivo, no Infinity, NaN ni epsilon artificial.
- Overflow/no finito =>error de dominio documentado.
- Rango esperado0..max_points; si la plantilla no autoriza clamp, fuera de rango =>unsupported/needs_review, no corregirlo calladamente.
- Versión engine=1.0.0; AST y parámetros canónicos en snapshot. El cliente aporta template_id y revisión, nunca código ejecutable.

El esquema Expr está en OpenAPI; aridad, profundidad, unidades y equivalencia con plantilla se prueban en Python. Registrar traza de operaciones legible, no razonamiento interno del LLM.

## Anormalidad: decisión jurídica acotada
Fuentes: LCSP149, RGLCAP85 y cláusula del PCAP. Prioridad:
1. Política explícita revisada del PCAP y correcciones vigentes.
2. Supletoria revisada cuando149.2.a sea aplicable y no haya otra previsión.
3. En los demás casos unknown/revisión necesaria.

La app reproduce una condición objetiva de presunción, **no declara inadmisión/exclusión ni suficiencia de una justificación**. El art149 prevé trámite contradictorio. Con pluralidad y ausencia de parámetros, no aplicar art85 por defecto. La doctrina JCCPE119/18 reconoce que los criterios relevantes para viabilidad no tienen por qué coincidir con todos los criterios de adjudicación; no emitir un juicio automático sobre validez del PCAP.

### Política Tías 18.5 (PCAP p.20)
Está expresamente en el pliego. Se implementan sus ramas, no “ley universal del25%”.
Sea B la base aprobada y O el conjunto de precios válidos hipotéticos para anormalidad:
- n=1: presunción si P<0.75B.
- n=2: la oferta inferior entra en presunción si P<0.80×otra.
- n=3: media inicial μ de las tres. Si máximo>1.10μ, recalcular μ sin una oferta máxima. Presunción si P<0.90μ_referencia **o** P<0.75B (cierre expresamente presente en este PCAP).
- n≥4: media inicial μ. Eliminar del **cómputo de media** todas las ofertas>1.10μ; si las restantes son≥3, nueva media de restantes; si son<3, nueva media de las tres ofertas más bajas del conjunto original. Presunción si P<0.90μ_referencia.

Eliminar del cómputo de media no significa excluir de la licitación ni del scoring. La poda se hace una vez según el texto, no iterativamente hasta estabilizar.

Comparadores estrictos: “más de” implica < o >, la igualdad del umbral no activa esa rama. No cuantizar μ/umbral a céntimos antes de comparar. Se muestra umbral aproximado con precisión pero el cálculo usa Decimal completo.

### Variantes que deben quedar separadas
- Alfresco p.16 reproduce ramas pero **no incluye** en n=3 el cierre de baja>25% que sí aparece en art85 y Tías. three_bidder_absolute_25=false; no añadirlo desde una plantilla genérica.
- RGLCAP85 estándar: n=3 sí incluye cierre25%; su aplicabilidad debe revisarse. Apartado5 permite reducción motivada en un tercio de porcentajes y6 consideración de solvencia. Si reduction=true y no se implementa/verifica esa variante, unsupported, nunca ejecutar estándar a escondidas. P0 no requiere esa reducción.
- Regla mixta precio+otros criterios o porcentajes diferentes =>unsupported hasta crear política versionada con casos independientes. No fabricar un AST jurídico arbitrario.

### Empresas del mismo grupo
Con group_membership_confirmed y own_group_id/rivales conocidos (en la demo son hipótesis expresas), construir referencias de anormalidad con la oferta más baja de cada grupo, conforme149.3. Mantener trazabilidad grupo→precios. La condición del grupo se informa como presunción condicional respecto a las ofertas afectadas; no valorar jurídicamente una UTE compleja con agrupación inventada.
  
Si la composición de grupos o alcance jurídico no es suficiente, anomaly.status=unknown aunque score esté definido. Dos rivales del mismo grupo no se convierten en dos observaciones independientes para la media. El scoring conserva todas las ofertas que el escenario declara admitidas.

No inferir grupo por nombre parecido ni NIF compartido en una descripción. En P0 basta caso de grupos independientes explícitos; test de agrupación y unknown sigue siendo obligatorio para no calcular mal ante datos incompletos.

### Salida y traza
AnomalyResult: status, policy_id, branch, reference_mean_net, threshold_net, reference_offer_count y reason_codes. Completar trace con media inicial, lista usada/retirada, condición estricta, base y evidencias. Devolver possible_justification_required o not_flagged_under_assumptions solo con inputs y política suficientes. “No marcada bajo estas hipótesis” no garantiza aceptación real.

## Elegibilidad en lógica de tres valores
Hoja solo se calcula si regla revisada y evidencia pertinente con unidad/periodo/ámbito suficientes.
- AND: not_met si alguna hoja falla; met si todas met; si no, unknown.
- OR: met si alguna met; not_met si todas not_met; si no, unknown.
- Ausencia de documento =>unknown, no not_met.
- Valor inferior confirmado con medios alternativos no resueltos =>veredicto de esa hoja not_met, grupo puede seguir unknown/met.
- Condiciones manuales/idioma/formato/modelo de anexo no reducibles a número =>unknown hasta revisión acreditada.
- El dominio implementa además `Not` (unknown se mantiene; AND vacío=met, OR vacío=not_met); el contrato expone solo AND/OR en `RequirementGroup`.

## Estadística descriptiva
No se prescribe distribución de rivales. Para n observaciones comparables ordenadas x:
percentil tipo7, h=(n-1)p, j=floor(h), γ=h-j; q=(1-γ)x[j]+γx[j+1], índices desde0; extremo superior ajustado a x[n-1]. Usar Decimal, ordenar por valor no strings. Mostrar mediana p=.5, Q1=.25, Q3=.75 solo si gate DATA_FEASIBILITY satisfecho.
  
No bootstrap ni intervalos de ganar. No “ahorro generado”, causalidad o futura distribución de ofertas a partir de adjudicaciones ganadoras. Validación estadística aquí significa controlar universo, grano, filtros y exclusiones; no simular una validación predictiva sin etiquetas. Sin implementar como módulo (2026-10-28): no existe `domain/statistics.py` ni endpoint histórico (P1); la especificación de percentil tipo 7 sigue vigente para cuando se implemente.

## Matriz mínima de regresión
| Caso | Entrada | Esperado |
|---|---|---|
| Inversa own mínima | 49; own85; rivales90/93 |49 |
| Inversa own no mínima |49; own95; rivales90/93 |46.421052631579 |
| Lineal todas en referencia |B=100, own100, rival100 |unknown:zero_denominator |
| Log argumento0 |best0 |422 input inválido, no log(0) |
| Tías n1 frontera |B100, own75 /74.99 |no marcada / presunción |
| n2 frontera |80 y100 /79.99 y100 |no marcada / presunción |
| n3 poda |70/90/100, B100 |media80, threshold72,70 marcada |
| n3 cierre25 |74/75/76, B100 |74 marcada en Tías; no en variante Alfresco por esa condición |
| n4 poda |50/60/70/100 |media60, threshold54;50 marcada |
| n4 fallback |40/41/100/100 |media181/3, threshold54.3 |
| Grupo desconocido |precios completos, grupo null |anomaly unknown; score definido |
| Perfil sin certificado |servicios declarados sin acreditación |unknown |
| Cambio documento |regla aprobada sobre hash anterior |409 revisión obsoleta para nuevo cálculo |

examples/math_vectors.json y tools/verify_math_oracles.py guardan cifras calculadas con Fraction/math por separado; no se deben generar expectativas llamando al mismo motor que se pretende verificar. Tras implementar, los tests de producto leen estos vectores y añaden propiedades.

