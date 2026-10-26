# Ejecución con Muse Code
Este paquete ya contiene AGENTS.md. Crear un repositorio nuevo dentro de la ventana permitida y copiar el paquete; revisar antes publication-manifest y no hacer público evidence/originals en bloque.

## Arranque
PowerShell:
~~~powershell
muse --version
git status --short
muse
~~~
Dentro del CLI, consultar /models y seleccionar el modelo accesible. La documentación anuncia 1.2 por defecto: no dar por elegido 1.3. /help y /settings muestran las capacidades disponibles. No se ha ejecutado el CLI en esta sesión; comprobar soporte real de Windows y rollout.

Autenticar el CLI según documentación oficial: META_API_KEY o sesión de navegador. La app usa MODEL_API_KEY solo en el servidor. Las claves pueden corresponder a cuentas o saldos distintos; la credencial de suscripción del CLI no se reutiliza en la app.

## Comando exacto
Copiar en una sola línea:
~~~text
/goal Implementa BidLab P0 conforme a AGENTS.md y los contratos de docs/: una licitación real de Tías, extracción Meta estructurada con citas revisables, requisitos con unknown, motor determinista de precio y presunción de anormalidad, Pricing Lab con hipótesis explícitas, escenarios persistidos, informe con fuentes y demo offline honesta. Trabaja por los hitos y gates, usa agentes acotados con worktrees solo si están disponibles, verifica y corrige unitarios, integración, seguridad, Playwright, tipos y build, y registra evidencia real en docs/verification-log.md. Entrega README reproducible, límites, guion de 180 segundos y borrador de candidatura. No añadas predicción ni histórico sin datos comparables, no inventes ejecuciones, no cierres como completo con criterios P0 fallidos o bloqueados y no publiques ni envíes sin autorización final del autor.
~~~

## Primer prompt después de /goal
~~~text
Lee íntegro el paquete, inspecciona git status y el entorno, y convierte examples/tasks.csv en docs/task-board.md con estados y dependencias. Verifica hashes y gates usando la evidencia existente, sin reinvestigar desde cero. Haz primero un smoke Meta real si hay MODEL_API_KEY y documenta G0/G3 pendientes si no. Genera esqueleto, locks y contratos; implementa primero el recorrido Tías con demo curada y cálculos reales. Se autorizan commits locales por bloque y helpers de Muse Code cuando estén habilitados: dominio y frontend en worktrees separados, con un lead integrador y verificación independiente. Descubre capacidades reales antes de usar workflows; si no están, continúa secuencialmente. Mantén coste y scope dentro de MILESTONES. Continúa las tareas independientes ante bloqueos externos y no solicites decisiones rutinarias inferibles. Empieza por T01 y entrega el primer vertical slice verificable.
~~~

## Checkpoints
Al terminar motor:
~~~text
Contrasta R1–R3 y ramas de anormalidad contra los oráculos externos, la fuente documental y las condiciones de activación. Prueba fronteras, agrupación, desconocidos y AST malicioso. Corrige implementación y documentos contradictorios, no los resultados esperados para acomodar un bug.
~~~
Al integrar:
~~~text
Audita US01–US13 contra API_CONTRACT y TEST_STRATEGY. Ejecuta checks reales y revisa screenshots desktop/móvil. Busca errores de IVA/IGIC, scope/horizonte, páginas, revisión y demo/live. Devuelve PASS/FAIL/BLOCKED por criterio y corrige P0; no añadas funcionalidades.
~~~
Antes de grabar:
~~~text
Arranca una DB de demo limpia y ejecuta exactamente el guion de DEMO_SUBMISSION sin red. Comprueba cifras/export y mide 180 segundos. Registra commit, entorno, tiempos y evidencia. Prepara archivos y checklist de candidatura, sin publicar ni enviar. Indica lo externo que siga bloqueado.
~~~

## Pausa y recuperación
/goal muestra el estado; /goal pause pausa; /goal resume continúa; /goal edit <objetivo> cambia el alcance; /goal clear elimina el objetivo. Esc interrumpe y, según documentación, pausa el objetivo pendiente. Reiniciar una sesión puede requerir /resume; comprobar /help del build.

Goal no es un proceso de despliegue ni una auditoría jurídica. Tras compactar, consultar task-board, blockers y verification-log antes de repetir pasos con efectos. Sin bucles infinitos. Si un smoke, las bases o el acceso siguen bloqueados, registrar BLOCKED y entregar un informe parcial honesto; no consumir créditos buscando una respuesta que encaje.

