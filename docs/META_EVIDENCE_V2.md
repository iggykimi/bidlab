# BidLab · Evidencia Meta V2 (issue #3)

Fecha: 2026-10-29. Sin secretos en este fichero.

## Estado

- `MODEL_API_KEY`: ausente (entorno + `.env` inexistente).
- `META_API_URL`: ausente.
- Admisión / cuenta / saldo aplicable: no verificados por el autor.
- Modo efectivo: `demo`. `meta_configured: false`.
- Llamadas live durante V2: **0**.

## Qué sí existe (verificado, no live)

- Smoke mínimo real del 26-oct (`evidence/meta_smoke_status.json`): HTTP 200,
  `executed_inference: true`, `muse-spark-1.3`, 250 tokens, 1647 ms.
  Un smoke NO es una extracción documental: no se presenta como tal.
- Pipeline de análisis real con 503 honesto `provider_not_configured` sin clave.
- Recibos/invocaciones con modo fixture/live, tokens, coste, latencia.
- Comparación texto/híbrido offline (`scripts/compare_extraction.py`, exit 0):
  texto 0 hit/0 miss/11 unsupported sobre 11 claims (baseline trivial honesto);
  híbrido `blocked` (`provider_not_configured`), métricas null, cero llamadas.

## Qué queda BLOQUEADO (externo, del autor)

G0/M1/T1 y BL-V2-02 camino live (pasos 0–8 §4), BL-V2-11 brazo live,
segunda pasada P2: requieren clave + URL permitida + consentimiento de gasto
+ saldo verificado + documento autorizado. Nada de eso se finge en UI,
vídeo o candidatura: demo = «Demostración reproducible · datos revisados»
(modo B §18.4).
