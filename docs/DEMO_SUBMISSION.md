# Demo de tres minutos y entrega
La restricción de180segundos/repo público viene del dossier y se mantiene conservadoramente; cotejar bases aceptadas antes de enviar. No hay vídeo grabado ni aplicación ejecutable todavía.

## Escena y datos
Caso real: PAI Tías2026/00006554N. PCAP original descargado,41páginas; presupuesto neto118336, bruto126619.52IGIC,49puntos precio. Citas: solvencia técnica p.6, fórmula p.10, anormalidad p.20. Perfil y costes90000 sintéticos, rivalesA106502.40 yB110052.48 hipótesis.

En pantalla siempre: “Demo curada · documento público real · empresa y rivales hipotéticos”. Solo si existe ejecución real previa de Meta, se puede añadir “Extracción con muse-spark-1.3 revisada el…”, mostrando invocation real. Si no existe, decir “Extracción curada manualmente; integración Meta pendiente” y reconocer que G3 falta. Nunca animar una llamada API ficticia.

Tías es el caso funcional; Alfresco/Marketing se usan fuera del recorrido principal para mostrar bloqueos y límites, no para añadir complejidad a los180s.

## Guion cronometrado
| Tiempo | Acción | Mensaje y evidencia |
|---|---|---|
|00–15s |Home y Cargar ejemplo |“Una pyme necesita decidir si puede presentarse y cómo afecta su precio a coste y puntos.” Licitación y snapshot reales. |
|15–40s |Requisitos; abrir técnica |“Este requisito no está acreditado. La cifra y su condición están en esta página.” Mostrar p.6 yunknown, no inventar certificados. |
|40–60s |PricingLab, coste/hipótesis |“El coste es de una empresa ficticia; los precios rivales son escenarios. No conocemos las ofertas futuras.” Mostrar base24meses/neto/IGIC aparte. |
|60–90s |Baja5→15% |Precio112419.20→100585.60; beneficio22419.20→10585.60; puntos46.4211→49. “Más baja puede reducir margen sin mejorar puntos bajo estas hipótesis.” |
|90–115s |Volver5%; rivalA a100585.60 |Puntos43.8421. “La puntuación cambia cuando cambia el escenario; no es una predicción de ganar.” |
|115–140s |Restaurar rivales; propia30%; abrir alerta |Mostrar posible justificación, nunca exclusión; PCAP p.20. Precio82835.20 y beneficio negativo sintético. |
|140–160s |Ver cálculo y fuente |Minincluyepropia, fórmula49×mejor/propia, revisión y p.10. Mostrar uno de los resultados sin otra llamadaIA. |
|160–180s |Guardar y exportar |Informe con pendientes, supuestos, páginas y cálculos. Cerrar: “Del documento a una decisión trazable; la empresa decide.” |

No dedicar un minuto a instalación ni leer tablas enteras. Puede grabarse voz inglesa con UI española si el concurso lo permite; no asumir idioma requerido. No afirmar recuperación nacional ni benchmark de precisión que no se haya medido.

## Preparación reproducible que debe implementar el agente
1. Instalar dependencias/browser y compilar antes de desconectar red.
2. python scripts/demo.py --reset-demo inicia DB de demo separada y servidorloopback. Semillaidempotente; no borrar DB de trabajo privada.
3. Verificar GETcapabilities mode=demo, meta_configured puede false, cero llamadas a proveedor y assets locales.
4. Abrir1280×720o1440×900, zoom100%, mismas posiciones de paneles; coste/rivales iniciales arriba.
5. Ensayo con E2Eycronómetro; exportar informe y comparar con examples/demo_expected.json.
6. Repetir desde limpio dos veces, incluyendouna ejecución sin Internet. Guardar logs reales, commit y captura de escritorio/móvil.
7. Grabar≤180s; no mostrar .env, claves, datos privados o ventanas de facturación. Verificar audio legible y vídeo exportado completo.
8. Mantener una grabación de respaldo y copia local de inputs; subir solo tras revisión del autor y permiso del portal de entrega.

scripts/demo.py es un contrato de desarrollo; no existe en este paquete de investigación. Las sondas tools/ sí existen y se distinguen de ese arranque futuro.

## Checklist de presentación
### Elegibilidad y reglas — pendiente de participante
Admisión efectiva, bases aplicables y fecha exacta de autoría; trackIndie/temaBuildforYourWorld; integrantes y límite real; obligaciones Meta; vídeo/duración/idioma/formato; repo/licencia; enlaces/submission y declaraciones de datos. Conservar evidencia privada de aceptación, no identidad/correos en repo.

Fechapública:4nov202621:00America/New_York, que corresponde5nov03:00Europe/Madrid. Entrega interna4nov18:00CET. Volver a comprobar cambios en página oficial/portal antes de presentar.

### Repositorio
README con instalación, versiones fijadas, arquitectura corta, ejecución offline y limitaciones. LICENSE para código propio elegida por autor (propuestaMIT, decisión no ejecutada). THIRD_PARTY_NOTICES con bibliotecas/datos y condiciones. .env.example sin secretos, storagegitignored, secret scan y revisión de historial, CI verde con commit exacto. No atribuir datos o código externos como autoría del hackathon.

Los probes y documentación fueron creados26oct; no se garantiza que el horario concreto cumpla bases hasta G0. Los documentos oficiales son material externo atribuido, no “construidos por el equipo”.

### Datos, derechos y privacidad
publication-manifest por fichero: sha256, fuente, fecha, titular/condiciones, allowed_in_public_repo yreviewer. Por defectofalse para originalesPDF y materiales sin revisión. Reutilización de datosHacienda sujeta a aviso; no sugerir patrocinio. Art13TRLPI excluye determinados actos/documentos públicos de propiedad intelectual, pero **no asumir sin análisis que cubre anexos de terceros, fotos, logos o documentos de una asociación privada**.

Las copias de investigación incluidas no conceden una licencia de redistribución. Alternativa: script de descarga explícito, hechos estructurados y fixtures propios etiquetados. No retirar avisos ni firmar PDFs de terceros como propios. Evitar NIF/contactos/personasinnecesarios en CSVpúblico; revisar también screenshots y transcripciones.

### Producto y calidad
Todos los US P0con estado y evidencia; mismos importes enUI/API/export; tipos decimales; score condicional; unknownsinconvertiracero; anormalidad correctamentecalificada; sinprobabilidades niusoscolusorios; assets/offline;G3real acreditado si se declara integración completa.

### Enlaces y envío
Repo y vídeo accesibles en ventana privada del navegador; enlace demo según regla real; no URLs localhost presentadas como despliegue público. No inventar URLdeGitHub,hostingovídeo: registrarlas cuando existan. El agente deja un submission-draft con campos reales y los que falten en NC. La publicaciónyenvío finales corresponden al autor salvo autorización explícita posterior.

## Mensaje breve para la candidatura (borrador factual)
“BidLab convierte un pliego real en un laboratorio de decisiones para una pyme: requisitos con páginas de evidencia, precios y costes bajo hipótesis explícitas, y una fórmula de puntuación ejecutada por un motor determinista. Muse Spark propone estructura documental; una revisión valida la base y las reglas. El laboratorio calcula y exporta los resultados. No predice ofertas confidenciales ni probabilidades de ganar.”

Solo mencionar usoMuseSpark ejecutado cuando G3haya pasado y reemplazar cualquier parte que aún esté pendiente. No publicar este texto como si la aplicación ya existiera.

