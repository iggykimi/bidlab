# Demo de tres minutos y entrega
La restricción de180segundos/repo público viene del dossier y se mantiene conservadoramente; cotejar bases aceptadas antes de enviar. La aplicación existe y corre offline; no hay vídeo grabado. Guion vigente: docs/demo-script-180s.md (R07, caso oro 10/15); runbook: docs/demo-runbook.md.

## Escena y datos
Caso real: PAI Tías2026/00006554N. PCAP original descargado,41páginas; presupuesto neto118336, bruto126619.52IGIC,49puntos precio. Citas: solvencia técnica p.6, fórmula p.10, anormalidad p.20. Perfil y costes90000 sintéticos («Pyme de ejemplo»: 80000+10000), rivalesA106502.40 yB110052.48 hipótesis.

Caso oro (fijado por CMP-02 + backend golden): rebaja10% → precio106502.40, beneficio16502.40,49puntos; rebaja15% → precio100585.60, beneficio10585.60,49puntos. El10% conserva5916,80€ más con los mismos puntos.

Rótulo de grabación (overlay en edición, NO existe en la UI): “Datos de ejemplo · documento público real · empresa y rivales hipotéticos”. La UI muestra la insignia «Datos de ejemplo» («Tus datos» en licitaciones propias). Solo si existe ejecución real previa de Meta, se puede añadir “Extracción con muse-spark-1.3 revisada el…”, mostrando invocation real. Si no existe, decir “Extracción curada manualmente; integración Meta en vivo pendiente en el frontal” y reconocer que G3 es parcial (solo smoke). Nunca animar una llamada API ficticia.

Tías es el caso funcional; el recorrido propio completo offline (alta + PDF + empresa + análisis + revisión manual + simular + comparar + exportar) queda como evidencia local E2E fuera de los180s. Alfresco/Marketing se usan fuera del recorrido principal para mostrar bloqueos y límites, no para añadir complejidad a los180s.

## Guion cronometrado
| Tiempo | Acción | Mensaje y evidencia |
|---|---|---|
|00–15s |Biblioteca y Cargar ejemplo |“Con el10% y el15% sacas los mismos49puntos; el10% conserva5916,80€ más.” Licitación y snapshot reales. |
|15–40s |Resumen: insignia, PBL, puntos |“Partimos de Tías:118336€ y49puntos; insignia Datos de ejemplo.” E01+E09. |
|40–60s |Requisitos; abrir técnica |“Este requisito queda Por verificar; la cita está en la página6.” Mostrar «Página6de41» y207.088, no inventar certificados. E02. |
|60–80s |Precio, coste/hipótesis |“El coste es ficticio; los rivales son escenarios que declaras tú.” Pyme de ejemplo, A106502.40/B110052.48. |
|80–100s |Rebaja al10% |Precio106502.40; beneficio16502.40; puntos49,0de49. «¿Cómo sale tu resultado?» CMP-02+R06. |
|100–122s |Guardar10y15; comparar desde Precio |“Mismos supuestos, mismo contexto: el10% conserva5916,80€ más con los mismos puntos.” CMP-02 + backend higher_profit_same_score. |
|122–140s |Volver5%; rivalA a100585.60 |Puntos43,8de49. “La conclusión cambia con la hipótesis; no es predicción.” E04. Restaurar rivalA. |
|140–158s |Conjunto incompleto (opcional) |Puntos «Sin determinar»; precio y beneficio intactos. E06. Saltable. |
|158–180s |Informe: abrir, decidir, descargar |«Copia(SHA-256)»64hex, «Preparar oferta», «Crear informe», «Descargar HTML». Cerrar: “Entiende la regla, compara y guarda.” E07+E08. |

No dedicar un minuto a instalación ni leer tablas enteras. Puede grabarse voz inglesa con UI española si el concurso lo permite; no asumir idioma requerido. No afirmar recuperación nacional ni benchmark de precisión que no se haya medido.

## Preparación reproducible que debe implementar el agente
1. Instalar dependencias/browser y compilar antes de desconectar red.
2. python scripts/demo.py --reset-demo inicia DB de demo separada y servidorloopback (API8000); npm run dev -w apps/web para el frontal(5173). Semillaidempotente; no borrar DB de trabajo privada.
3. Verificar GETcapabilities mode=demo, meta_configured=false, cero llamadas a proveedor y assets locales.
4. Abrir1280×720, zoom100%; tras Cargar ejemplo, clic en Precio y comprobar que «Escribe tu rebaja (%)» cabe sin scroll (R06).
5. Ensayo con E2Eycronómetro; exportar informe y comparar con fixtures/demo/expected.json (5/15/30%; caso10% fijado por CMP-02+R06+backend).
6. Repetir desde limpio dos veces, incluyendouna ejecución sin Internet (vaciar localStorage: bidlab.session.v1, bidlab.drafts.v2). Guardar logs reales y captura de escritorio/móvil; commit solo con autorización.
7. Grabar≤180s; no mostrar .env, claves, datos privados o ventanas de facturación. Verificar audio legible y vídeo exportado completo. Sin vídeo grabado a27-oct.
8. Mantener una grabación de respaldo y copia local de inputs; subir solo tras revisión del autor y permiso del portal de entrega.

scripts/demo.py existe y es el arranque oficial de la demo. Las sondas tools/ son investigación congelada y se distinguen de ese arranque.

## Checklist de presentación
### Elegibilidad y reglas — pendiente de participante
Admisión efectiva, bases aplicables y fecha exacta de autoría; trackIndie/temaBuildforYourWorld; integrantes y límite real; obligaciones Meta; vídeo/duración/idioma/formato; repo/licencia; enlaces/submission y declaraciones de datos. Conservar evidencia privada de aceptación, no identidad/correos en repo.

Fechapública:4nov202621:00America/New_York, que corresponde5nov03:00Europe/Madrid. Entrega interna4nov18:00CET. Volver a comprobar cambios en página oficial/portal antes de presentar.

### Repositorio
README con instalación, versiones fijadas, arquitectura corta, ejecución offline y limitaciones. LICENSE para código propio elegida por autor (propuestaMIT, decisión no ejecutada). THIRD_PARTY_NOTICES con bibliotecas/datos y condiciones. .env.example sin secretos, storagegitignored, secret scan y revisión de historial, puertas locales verdes con commit exacto (verify.py; sin CI remota por decisión del autor, sin push sin su autorización). No atribuir datos o código externos como autoría del hackathon.

Los probes y documentación fueron creados26oct; no se garantiza que el horario concreto cumpla bases hasta G0. Los documentos oficiales son material externo atribuido, no “construidos por el equipo”.

### Datos, derechos y privacidad
publication-manifest por fichero: sha256, fuente, fecha, titular/condiciones, allowed_in_public_repo yreviewer. Por defectofalse para originalesPDF y materiales sin revisión. Reutilización de datosHacienda sujeta a aviso; no sugerir patrocinio. Art13TRLPI excluye determinados actos/documentos públicos de propiedad intelectual, pero **no asumir sin análisis que cubre anexos de terceros, fotos, logos o documentos de una asociación privada**.

Las copias de investigación incluidas no conceden una licencia de redistribución. Alternativa: script de descarga explícito, hechos estructurados y fixtures propios etiquetados. No retirar avisos ni firmar PDFs de terceros como propios. Evitar NIF/contactos/personasinnecesarios en CSVpúblico; revisar también screenshots y transcripciones.

### Producto y calidad
Todos los US P0con estado y evidencia; mismos importes enUI/API/export; tipos decimales; score condicional; unknownsinconvertiracero; anormalidad correctamentecalificada; sinprobabilidades niusoscolusorios; assets/offline;G3parcial (smoke real; sin Meta en vivo en el frontal). Caso oro10/15 fijado (CMP-02 + backend golden + R06); recorrido propio offline fijado (own-journey3/3); estado R01–R04 fijado. Literales UI citados entre«» verificados en código; cifras de fixtures/demo/expected.json o specs.

### Enlaces y envío
Repo y vídeo accesibles en ventana privada del navegador; enlace demo según regla real; no URLs localhost presentadas como despliegue público. No inventar URLdeGitHub,hostingovídeo: registrarlas cuando existan. El agente deja un submission-draft con campos reales y los que falten en NC. La publicaciónyenvío finales corresponden al autor salvo autorización explícita posterior.

## Mensaje breve para la candidatura (borrador factual)
“BidLab convierte un pliego real en un laboratorio de decisiones para una pyme: requisitos con páginas de evidencia, precios y costes bajo hipótesis explícitas, y una fórmula de puntuación ejecutada por un motor determinista. Muse Spark propone estructura documental; una revisión valida la base y las reglas. El laboratorio calcula y exporta los resultados. No predice ofertas confidenciales ni probabilidades de ganar.”

Solo mencionar usoMuseSpark ejecutado cuando G3haya pasado y reemplazar cualquier parte que aún esté pendiente. No publicar este texto como si la aplicación ya existiera.

