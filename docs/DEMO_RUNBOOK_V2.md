# BidLab · Runbook demo V2 (histórico @264712f; secuencia válida, cifras V2)

Fecha: 2026-10-29. HEAD código: `264712f`. Estado: curado (modo B §18.4):
«Demostración reproducible · datos revisados». Cero llamadas Meta.

## Arranque (un comando tras compilar)

```sh
npm run build -w apps/web
python scripts/demo.py --reset-demo
```

Abre `http://127.0.0.1:8000/` (API + frontal same-origin).
`npm run dev -w apps/web` (puerto 5173) solo para desarrollar el frontal.

## Reset seguro

`python scripts/demo.py --reset-demo` resetea la DB demo en
`BIDLAB_STORAGE_DIR`, siembra Tías y arranca. `--reset` solo existe en modo
demo. Tu base personal: usa `BIDLAB_STORAGE_DIR` aparte; `demo_story.py`
y los E2E usan almacenamientos temporales y no tocan la tuya.

## Estado live/curado

- Capabilities: `mode: demo`, `meta_configured: false`.
- Insignia «Datos de ejemplo» (curado) / «Tus datos» (propias).
- Sin `.env` ni claves en pantalla durante la grabación.

## Verificación de cifras (antes de grabar)

1. `python scripts/verify.py` → exit 0 (puertas 10/10; E2E 85/85 en V2,
   98/98 en V5 — ver [verification-log](verification-log.md) §V5).
2. Caso oro: rebaja 10 % → 106.502,40 € / +16.502,40 € / 49,0 de 49;
   rebaja 15 % → 100.585,60 € / +10.585,60 € / 49,0 de 49;
   delta +5.916,80 € (CMP-02).
3. Rastro visible en Resumen («Ejemplo preparado.»); cobertura en Citas
   (9 citas, 6 páginas de 41); frontera bajo la comparativa.

## Guion

`docs/demo-script-180s.md` v4 post-#3 (guion + notas de cámara V2 +
recorrido propio fuera de los 180 s). Vídeo pendiente del autor.
Capturas frescas: `docs/demo/` y `docs/v2-shots/`.
