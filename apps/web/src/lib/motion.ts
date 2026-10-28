// Primitivas de movimiento: solo valores reales ya confirmados.
// Sin React ni matemáticas de precio. Con reduced-motion no hay animación,
// pero el valor final siempre se escribe. Adaptado de ingenieria/motion.ts
// del Experience Lab.

export interface MotionContext {
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== "function") return true;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function reduce(ctx: MotionContext): boolean {
  return ctx.reducedMotion ?? prefersReducedMotion();
}

async function play(
  node: HTMLElement,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
  ctx: MotionContext,
): Promise<void> {
  if (ctx.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (reduce(ctx)) return;
  const animation = node.animate(frames, options);
  const abort = (): void => {
    animation.cancel();
  };
  ctx.signal?.addEventListener("abort", abort, { once: true });
  try {
    await animation.finished;
  } finally {
    ctx.signal?.removeEventListener("abort", abort);
  }
}

/** Entrada breve de una tarjeta ya visible en el estado. */
export async function reveal(node: HTMLElement, ctx: MotionContext = {}): Promise<void> {
  await play(
    node,
    [
      { opacity: 0, transform: "translateY(6px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" },
    ctx,
  );
}

/**
 * Escribe el texto real confirmado y lo funde. Llamar solo cuando la
 * respuesta pertenece a los inputs actuales (inputKey === current inputKey).
 */
export async function commitResult(
  node: HTMLElement,
  realText: string,
  ctx: MotionContext = {},
): Promise<void> {
  if (ctx.signal?.aborted) return;
  node.textContent = realText;
  await play(node, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 160, easing: "ease-out" }, ctx);
}

/**
 * Resaltado breve del fragmento citado. Solo cuando el texto real
 * ya está en pantalla; con reduced-motion no hace nada.
 */
export async function highlight(node: HTMLElement, ctx: MotionContext = {}): Promise<void> {
  await play(
    node,
    [{ backgroundColor: "#fff4c6" }, { backgroundColor: "transparent" }],
    { duration: 280 },
    ctx,
  );
}

/**
 * Pasa de la fuente a la regla: ambas siguen legibles. Sin clones
 * ni texto documental inventado.
 */
export async function sourceToRule(
  source: HTMLElement,
  rule: HTMLElement,
  ctx: MotionContext = {},
): Promise<void> {
  await play(
    source,
    [{ backgroundColor: "#fff4c6" }, { backgroundColor: "#e0ebc4" }],
    { duration: 280 },
    ctx,
  );
  await reveal(rule, ctx);
}

export interface VerifiedStep {
  id: string;
  /** La acción termina tras confirmar el estado real, no al pedirlo. */
  perform: (signal: AbortSignal) => Promise<void>;
  /** Lee revisión, contexto y visibilidad; nunca confía en la animación. */
  verify: () => Promise<boolean>;
}

/** Tour verificado: se detiene en el primer paso sin prueba. */
export async function runVerifiedTour(
  steps: readonly VerifiedStep[],
  signal: AbortSignal,
): Promise<void> {
  for (const step of steps) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    await step.perform(signal);
    if (!(await step.verify())) throw new Error(`Demo blocked at ${step.id}`);
  }
}
