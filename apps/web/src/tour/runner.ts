// Controlador del tour: ejecuta pasos verificados e informa del progreso.
// Puro y sin DOM: la barra (TourBar) aporta los pasos reales y el estado.

import { runVerifiedTour, type VerifiedStep } from "../lib/motion";

export type TourPhase = "running" | "done" | "blocked" | "cancelled";

export interface TourOutcome {
  phase: TourPhase;
  /** Id del paso sin prueba cuando phase es "blocked". */
  failedStep: string | null;
  /** Pasos cuya acción empezó. */
  started: number;
}

const BLOCKED_PREFIX = "Demo blocked at ";

export function blockedStepOf(error: unknown): string | null {
  if (error instanceof Error && error.message.startsWith(BLOCKED_PREFIX)) {
    return error.message.slice(BLOCKED_PREFIX.length).trim() || null;
  }
  return null;
}

export async function executeTour(
  steps: readonly VerifiedStep[],
  signal: AbortSignal,
  onStepStart: (index: number) => void,
): Promise<TourOutcome> {
  let started = 0;
  const wrapped: VerifiedStep[] = steps.map((step, index) => ({
    ...step,
    perform: async (sig: AbortSignal) => {
      started = index + 1;
      onStepStart(index);
      await step.perform(sig);
    },
  }));
  try {
    await runVerifiedTour(wrapped, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { phase: "cancelled", failedStep: null, started };
    }
    const failedStep = blockedStepOf(error);
    if (failedStep !== null) {
      return { phase: "blocked", failedStep, started };
    }
    throw error;
  }
  return { phase: "done", failedStep: null, started };
}
