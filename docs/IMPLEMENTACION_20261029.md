# Entrega de código · 29 de octubre de 2026

Esta entrega parte del commit `1a53b6a` del repositorio original. Las mejoras descritas aquí están aplicadas en el código del ZIP. No es una lista de funciones para volver a implementar.

## Integración por el otro modelo

1. Leer `LEER_PRIMERO.md` en la raíz del ZIP y comprobar el SHA base completo en `MANIFEST.json`.
2. Revisar `cambios.patch`: contiene los cambios de producto, pruebas y documentación. El directorio `codigo/` contiene el árbol completo resultante; la compilación está en `codigo/apps/web/dist/`.
3. Si se integra en un checkout del mismo commit base y sin cambios locales, ejecutar `git apply --check /ruta/cambios.patch` y después `git apply /ruta/cambios.patch`.
4. Si el autor ya ha vuelto a avanzar, comparar y resolver cada cambio. No sobrescribir el repositorio entero, hacer reset ni forzar la aplicación del parche. No volver a implementar las funciones que ya contiene.
5. Desde el checkout integrado: `uv sync --frozen --all-packages`, `npm ci` y `python scripts/verify.py --skip-e2e`. Después instalar el Chromium requerido y ejecutar `npm run test:e2e`. Los resultados de esta entrega están en `verificacion/` dentro del ZIP; los E2E no se cuentan como aprobados.
6. Compilar con `npm run build`. Con dependencias instaladas, `python scripts/demo.py` siembra el ejemplo y arranca API e interfaz en `http://127.0.0.1:8000/`. `--reset-demo` queda reservado para un almacenamiento de demo desechable.
7. No publicar, hacer push, activar gasto Meta ni enviar candidatura automáticamente.

## Backend corregido

- El reinicio recupera trabajos nunca iniciados; los fallidos no se convierten en una cola de reintentos de pago. Los interrumpidos conservan la incertidumbre de gasto.
- La intención de envío se registra antes de entrar en el adaptador. Uso desconocido conserva reserva y bloquea nuevas admisiones hasta conciliación; una estimación no se presenta como gasto liquidado.
- El recibo de una invocación se conserva independientemente de que su propuesta pueda promoverse. Una revisión o generación obsoleta no borra tokens o id del proveedor.
- Se cotejan revisión esperada y hashes documentales antes del procesamiento y al publicar. La interpretación actual no se sustituye por una respuesta anterior.
- Un PDF largo deja de provocar el fallo inmediato por superar seis páginas del adaptador: se selecciona un primer paquete acotado por señales de cláusula y se declara la cobertura parcial. No se afirma que se haya leído el expediente entero.
- Los renders usados como evidencia se vinculan al SHA del PDF y del PNG; se comprueban cabecera y dimensiones de la imagen antes de entregarla.
- Aprobar un dato requiere valor presente y cita localizada en la página y versión correctas del mismo expediente. La localización no sustituye la revisión semántica.
- Los dos códigos de error de esa revisión están incorporados al generador canónico y a los clientes Python/TypeScript regenerados. Las respuestas negativas también se validan contra el contrato.
- Modo demo/manual y modelos sin perfil de tarifa no habilitan llamadas live. Origin acepta el puerto local configurado sin abrir una allowlist arbitraria.
- FastAPI sirve la compilación web y sus rutas conocidas en un único origen. Se conservan los errores JSON de API, el confinamiento de archivos y cabeceras de seguridad; falta de build ofrece una salida clara.

## Frontend aplicado

- Cada resultado conserva las hipótesis que lo produjeron. Cambiar rebaja o rivales no cambia las etiquetas de cifras anteriores durante la espera.
- Guardar exige un resultado vigente. Un fallo al guardar no borra la copia que ya existía.
- Costes propios y costes de ejemplo se rotulan según su procedencia.
- Las citas se unen por documento, página y literal; una cita distinta no presta su estado a otra. La confirmación también comprueba versión y valor no vacío.
- El panel de evidencia distingue uploads propios de datos curados; un fallo de red de imagen no se describe como inexistencia del documento.
- El resumen ofrece tres acciones claras con SVG originales. El laboratorio muestra un reparto visual de coste y beneficio; una pérdida se dibuja fuera del precio, sin modificar el cálculo del motor.
- Tías tiene accesos a cuatro hipótesis de ejemplo: 10 %, 15 %, 30 % y conjunto incompleto. Solo cambian entradas; no modifican costes, guardan automáticamente ni fabrican resultados.
- El botón de ocultar vista previa del informe ahora la oculta sin hacer otra descarga.
- API relativa al origen por defecto; se mantiene el override explícito de desarrollo.

## Cuatro escenas ya ejecutadas con la API

Empresa y rivales son hipotéticos. El pliego de Tías y su revisión curada conservan su procedencia. Son ejemplos del mismo expediente, no cuatro licitaciones nuevas.

| Entrada | Precio neto | Beneficio neto | Puntos de precio | Qué enseña |
|---|---:|---:|---:|---|
| Rebaja 10 % | 106.502,40 € | 16.502,40 € | 49 | Punto de comparación |
| Rebaja 15 % | 100.585,60 € | 10.585,60 € | 49 | Mismos puntos, 5.916,80 € menos de beneficio |
| Rebaja 30 % | 82.835,20 € | −7.164,80 € | 49 | Pérdida y posible necesidad de justificación |
| Rebaja 10 %, conjunto incompleto | 106.502,40 € | 16.502,40 € | Sin determinar | El producto conserva lo calculable y reconoce qué falta |

Reproducir en una base temporal: `uv run python scripts/demo_story.py --output test-results/demo-story`. Exporta cuatro escenarios, cuatro informes HTML y la comparación mediante la API real local, sin tocar la base del usuario ni llamar a Meta. Las ejecuciones de entrega y sus snapshots están en `demo/` del ZIP.

Guion sugerido: abrir ejemplo y evidencia → 10 % → guardar → 15 % → guardar/comparar → 30 % y pérdida → conjunto incompleto → informe. La narración debe explicar el supuesto que cambia, no enumerar botones. No se ha grabado un vídeo nuevo en esta entrega.

## Límites que siguen siendo reales

- Cero llamadas nuevas a Meta en esta revisión. La aceptación real del payload, la calidad y latencia de extracción y el saldo requieren ejecución opt-in en el entorno del autor.
- El harness de comparación actual usa un fixture como control textual: no demuestra una mejora real de visión frente a texto. Su ruta live tampoco constituye aún una comparación completa con imágenes, hashes y ledger compartido. No usar `--allow-live` para defender una ablation ni publicar ventaja de precisión antes de corregirlo y medirlo.
- El presupuesto es admisión contra estimaciones, no un techo garantizado de factura del proveedor. Los intentos inciertos requieren conciliación.
- Upload, parseo y render siguen siendo síncronos en la ruta de carga; su aislamiento en proceso y transacciones más cortas es el siguiente trabajo técnico. No se ha fingido un worker documental completo.
- Se mantienen las decisiones pendientes de licencia de dependencias/documentos, autorización final de publicación y requisitos de candidatura.
- La descarga de Chromium requerida por Playwright falló en este entorno. El acceso del navegador al preview también falló; la inspección visual de escritorio/móvil y los E2E quedan pendientes, separados de build, pruebas unitarias, contratos y tipos. No hay capturas nuevas que se presenten como QA aprobado.

La fuente de estado de cada comprobación es `verificacion/`. Un bloqueo no es un PASS.
