// Barra de la visita guiada: ejecuta los pasos verificados sobre la app real
// y cuenta en qué paso está o dónde se detuvo. Solo aparece con ?tour=1 para
// no cambiar la UI normal; una vez empezada, sigue aunque cambies de página.

import { useRef, useState } from "react";
import { Button } from "../components/ui";
import { buildTourSteps, TOUR_SCENARIO_NAME } from "./steps";
import { executeTour, type TourPhase } from "./runner";

const STEP_LABELS: Record<string, string> = {
  "cargar-ejemplo": "cargar el ejemplo",
  "rebaja-15": "probar una rebaja del 15 %",
  "guardar-prueba": "guardar la prueba",
  "borrador-decision": "preparar el borrador",
};

function stepLabel(id: string): string {
  return STEP_LABELS[id] ?? id;
}

type BarPhase = "idle" | TourPhase;

export function TourBar() {
  const [enabled] = useState(() => new URLSearchParams(window.location.search).has("tour"));
  const [total] = useState(() => buildTourSteps().length);
  const [phase, setPhase] = useState<BarPhase>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [stepIds, setStepIds] = useState<string[]>([]);
  const [failedStep, setFailedStep] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  if (!enabled && phase === "idle") return null;
  const running = phase === "running";

  async function handleStart() {
    if (controllerRef.current) return;
    const steps = buildTourSteps();
    setStepIds(steps.map((s) => s.id));
    setStepIndex(0);
    setFailedStep(null);
    setPhase("running");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const outcome = await executeTour(steps, controller.signal, setStepIndex);
      setFailedStep(outcome.failedStep);
      setPhase(outcome.phase);
    } catch {
      setFailedStep(null);
      setPhase("blocked");
    } finally {
      controllerRef.current = null;
    }
  }

  function handleStop() {
    controllerRef.current?.abort();
  }

  let status: string;
  if (phase === "running") {
    status = `Paso ${stepIndex + 1} de ${total}: ${stepLabel(stepIds[stepIndex] ?? "")}…`;
  } else if (phase === "done") {
    status = `Visita terminada: la prueba «${TOUR_SCENARIO_NAME}» quedó guardada y el borrador abierto.`;
  } else if (phase === "blocked" && failedStep !== null) {
    status = `La visita se detuvo en «${stepLabel(failedStep)}»: algo en pantalla no coincide.`;
  } else if (phase === "blocked") {
    status = "La visita se detuvo por un error inesperado.";
  } else if (phase === "cancelled") {
    status = "Detuviste la visita. Puedes empezarla de nuevo.";
  } else {
    status = `Te enseño el ejemplo en ${total} pasos, actuando sobre la pantalla real.`;
  }

  return (
    <div
      role="region"
      aria-label="Visita guiada"
      data-testid="tour-bar"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-3"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <p className="text-sm font-semibold">Visita guiada</p>
        <p data-testid="tour-status" role="status" className="text-sm text-muted">
          {status}
        </p>
        <div className="ms-auto flex gap-2">
          {running ? (
            <Button variant="secondary" data-testid="tour-stop" onClick={handleStop}>
              Detener
            </Button>
          ) : (
            <Button data-testid="tour-start" onClick={() => void handleStart()}>
              {phase === "idle" ? "Empezar visita" : "Empezar de nuevo"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
