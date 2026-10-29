# ARCHIVED — BidLab research dictamen (2026-10-26)

> Documento histórico preservado. Describe el paquete de investigación ANTES de
> implementar la aplicación («No se ha implementado la aplicación», «Lo que sigue
> pendiente»). El estado actual vive en [/EXECUTIVE_AUDIT.md](../EXECUTIVE_AUDIT.md),
> [README.md](../README.md) y [docs/REVIEWER_GUIDE.md](../REVIEWER_GUIDE.md).
> Importado en `4e542ce`; archivado el 29-oct-2026 (V3, issue #4) sin cambiar
> una coma del cuerpo original.

---

# BidLab — dictamen y guía de arranque
**Investigación cerrada el 26 de octubre de 2026.** El proyecto conserva la idea del dossier: de un pliego a una decisión de oferta. Se entrega un paquete de doce especificaciones y evidencia reproducible para desarrollar después con Muse Code. No se ha implementado la aplicación.

## Dictamen
**Viable como laboratorio de decisiones con una licitación real, fuentes y matemáticas verificables.** La extracción documental por sí sola no diferencia el producto. El núcleo debe ser el Pricing Lab, donde precio, costes, puntos y presunción de anormalidad cambian bajo hipótesis explícitas y dejan una traza exportable.

No hay una base demostrada para estimar probabilidades de ganar. El histórico se mantiene descriptivo y condicionado a comparabilidad; se recorta antes que la calidad del simulador o la demo.

## Qué se ha probado realmente

| Prueba | Resultado |
|---|---|
| Feed oficial PLACSP | Descargado y parseado: 68 expedientes distintos, 33 registros de resultado. |
| Campos de ofertas | Número recibido presente en 33/33 resultados; mínimo/máximo en 13/33. No es una lista completa de ofertas rivales. |
| Pares presupuesto/adjudicación | 22 candidatos estructurales; siguen sujetos a revisión semántica. Se revisaron cuatro pares de dos expedientes, sin considerarlos un grupo estadístico homogéneo. |
| ZIP oficial 2012 | 16 MB comprimidos, 38 ficheros Atom; 19.000 entradas y 11.262 IDs distintos. Las 7.738 versiones adicionales confirman la necesidad de deduplicar. |
| Documentos | Cinco PCAP y un PPT descargados, con URLs y SHA-256. Tres fórmulas examinadas también visualmente. |
| Evidencias de página | 25 citas del gold inicial localizadas en sus páginas mediante pypdf. Esto no es una tasa de precisión de Meta. |
| Contratos y matemáticas | OpenAPI 3.1 validada: 22 rutas, 24 operaciones y 51 esquemas; SQL de 17 tablas ejecutado; ejemplos tipados y oráculos independientes comprobados. |
| Meta real | Bloqueado por falta de MODEL_API_KEY. No se enviaron solicitudes ni se inventó consumo. |

Los archivos originales del feed/ZIP cambiantes están identificados por hash. El paquete incluye CSV/JSON de la sonda reciente, resumen del ZIP y copias documentales de investigación; no redistribuye los 246 MB descomprimidos del ZIP.

## Caso de producto elegido
**2026/00006554N — asistencia técnica del PAI de Tías.** Presupuesto inicial neto: 118.336 EUR; presupuesto con IGIC: 126.619,52 EUR; duración inicial: 24 meses; valor estimado: 295.840 EUR. No son magnitudes intercambiables.

El PCAP asigna 49 puntos al precio y usa proporción inversa en su página PDF 10. La regla de anormalidad está en la página 20. El requisito de experiencia técnica de la página 6 permite mostrar un pendiente real sin inventar certificados de la empresa ficticia.

Con coste **sintético** de 90.000 EUR y rivales **hipotéticos** de 106.502,40 y 110.052,48:

| Baja propia | Precio neto | Beneficio hipotético | Puntos económicos condicionados |
|---|---:|---:|---:|
| 5% | 112.419,20 | 22.419,20 | 46,4211 / 49 |
| 15% | 100.585,60 | 10.585,60 | 49,0000 / 49 |
| 30% | 82.835,20 | −7.164,80 | 49,0000 / 49 |

El último tramo hace visible que bajar más puede consumir margen sin mejorar puntos en ese escenario. Los otros 51 puntos no se inventan. La presunción de anormalidad significa posible justificación, no exclusión automática.

## Hallazgos que han cambiado el diseño

- Varios resultados de un expediente no se dividen por su presupuesto total. Se detectaron ratios engañosos por adjudicación parcial sin lote resoluble.
- El PCAP de marketing puntúa sobre VEC y su anexo incorpora prórroga; su base no está reconciliada. Queda como ejemplo bloqueado.
- El PCAP de Alfresco imprime un denominador con glifo 0 mientras define O como oferta. La interpretación logarítmica se prueba matemáticamente, pero no se aprueba automáticamente para ese expediente.
- La API PDF de Meta limita texto a las primeras 100 páginas e imágenes a las primeras 50. El diseño extrae y segmenta por página localmente.
- Muse Code y la app tienen credenciales y modalidades de facturación distintas. No se presupone que una suscripción del CLI cubra inferencia de la app.
- El portal publica Disallow: / en robots. Se descarta crawler HTML; se usan recursos oficiales expresamente publicados, cache y archivos locales.

## Reglas del evento y créditos
Se recuperó el texto público de [Official Rules / Waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) desde el JSON entregado por la web, aunque su vista textual mostraba Loading. La rúbrica pondera impacto 30%, herramientas Meta 25%, ejecución 20% y demo 25%; Indie permite hasta cuatro personas.

Los 150 USD están anunciados para seleccionados y requieren claim válido. Se leyó el PDF específico de Credit Terms: regula cuenta, cobro posterior al agotamiento y vigencia. Existe una discrepancia con el resumen del waiver sobre duración del crédito; debe comprobarse la versión aceptada y el saldo real. No se ha reclamado crédito ni aceptado condiciones por el participante.

Repositorio público, máximo de tres minutos y ventana exacta de nueva autoría se mantienen como restricciones conservadoras del dossier; no se han localizado como requisitos detallados en el texto recuperado. El portal sin sesión no permitió verificar todos los campos de entrega.

La fecha pública de cierre es 4 de noviembre a las 21:00 ET, equivalente al **5 de noviembre de 2026 a las 03:00 en Madrid**. Objetivo interno: 4 de noviembre a las 18:00 CET.

## Paquete de implementación
El ZIP contiene PRD con trece historias verificables, arquitectura y árbol de módulos, OpenAPI, modelos y SQL, motor matemático/DSL, estrategia unitaria/integración/Playwright, 38 tareas, presupuesto, guion de 180 segundos, AGENTS.md y MUSE_GOAL.md. Incluye sondas, fuentes exactas, gold inicial y ejemplos de contratos.

Stack decidido: React/TypeScript/Vite y FastAPI/Pydantic/SQLite; dominio Python puro con Decimal; PDF local y Meta como adaptador. Sin base vectorial, multiusuario o despliegue cloud inicial. Estimación P0: **58 horas más 10 de contingencia**; P1 opcional añade 8,5 horas.

El agente comienza por entorno, acceso y contratos; después entrega el recorrido completo de Tías. Se permite lead más dos helpers cuando Muse los soporte, con worktrees separados y verificación del integrador. No se depende de workflows o mensajería disponibles en una plataforma concreta.

## Lo que sigue pendiente

1. Admisión del participante, versión de reglas aceptada y claim/saldo real.
2. Smoke y extracción real con Meta; sin esto no declarar completa la integración del hackathon.
3. Revisión por documento antes de publicar originales. Las copias de investigación no conceden una licencia general sobre anexos, fotos o logos.
4. Implementación, pytest/Playwright/build, ensayo offline y grabación del vídeo. Están especificados, no ejecutados.

Para empezar, copiar el árbol del ZIP a la raíz de un repo nuevo, conservar AGENTS.md y pegar el comando exacto de docs/MUSE_GOAL.md. El archivo incluye el prompt inicial, checkpoints y condiciones para pausar ante bloqueos sin fingir éxito.
