# BidLab · Decision log V2 (issue #3)

## Decisiones técnicas

- D-V2-1 Stale por clave canónica + secuencia, no por timestamp: dos resultados
  con mismas entradas normalizadas comparten clave; `latestSeq` ignora tardías.
- D-V2-2 Curva: etiquetas a HTML (leyenda externa + pies) en vez de pelear
  colisiones dentro del SVG; pins aria/tabla intactos.
- D-V2-3 Drawer: curado sin `<img>` (cero peticiones condenadas); error real
  con reintento por remontaje; hint por overflow medido + ResizeObserver.
- D-V2-4 Pareto: endpoint aditivo `POST /scenarios/frontier`, sin romper
  el schema de stress; `classify()` pura; unknown/anómalos excluidos con motivo.
- D-V2-5 Rastro: view-model puro sobre estados existentes; `own` por
  `source_id === id` (el `mode` del workspace es global de app, no procedencia).
  CSS compuesto en vez de SVG estático (§14 lo permite).
- D-V2-6 Cobertura: sin backend nuevo (§22.4). Citas = aprobadas (coherente
  con conteos); enviadas = `processed_pages` del trabajo (entregadas, nunca
  «confirmadas» inferidas); tira ≤60 páginas, texto si más.
- D-V2-7 Informe: vocabulario del repo («sin determinar») prevalece sobre el
  «No disponible» del prompt; modo siempre rotulado; descargo legal.
- D-V2-8 Push por oleada: la orden vigente del autor (siempre commit y push)
  prevalece sobre la regla 4 del prompt V2 (mismo criterio D28-2/D-ISSUE2-1).
- D-V2-9 Bench servicio (no HTTP): responde §12.1 sin andamiaje; verdict
  «no tocar» con límite conocido (100 p. ≈8,5 s).
- D-V2-10 Conclusión stress: cuenta hipótesis cubiertas (`comparable_count`
  de la rebaja elegida), no filas factibles; singular/plural correctos.

## Deudas

- Manifiesto de páginas por trabajo no expuesto por API (vive en
  `request_json` del job): la UI no puede mostrar selección exacta por pasada.
- `feasible_count` (filas factibles) sigue en contrato aunque la UI ya no
  lo presenta como hipótesis; renombrarlo rompería clientes.
- Sin axe-core: a11y cubierta por E2E propio + auditoría manual de contraste.
- 100 páginas ≈8,5 s síncronos: aceptable en local, a vigilar con proxy.

## Descarte con motivo

- Filtros por criticidad / batch por claim: sin campo ni endpoint en contrato.
- Export A-B y split resumen/anexo: riesgo sobre export estable.
- Segunda pasada, multilote, extras §24: P2/P3/backlog (live bloqueado / mandato).
- Migración Responses API, agentes, RAG, predictor: prohibidos por prompt/AGENTS.
