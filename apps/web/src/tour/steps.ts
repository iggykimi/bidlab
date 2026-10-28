// Pasos del tour sobre la app real: cada perform actúa en el DOM y cada
// verify lee el estado confirmado (revisión, contexto, visibilidad).
// Si una prueba falla, runVerifiedTour se detiene ahí.

import type { VerifiedStep } from "../lib/motion";
import { byTestId, click, setChecked, setInputValue, textOf, waitFor } from "./dom";

export const TOUR_SCENARIO_NAME = "Tour 15";

function tabButton(id: string): HTMLElement | null {
  return document.getElementById(`tab-${id}`);
}

async function gotoTab(id: string, signal: AbortSignal): Promise<boolean> {
  const btn = tabButton(id);
  if (!btn) return false;
  if (btn.getAttribute("aria-selected") !== "true") click(btn);
  return waitFor(() => tabButton(id)?.getAttribute("aria-selected") === "true", signal);
}

function scenarioSaved(): boolean {
  const nodes = [...document.querySelectorAll('p[role="status"]')];
  return nodes.some((n) => n.textContent?.includes(`«${TOUR_SCENARIO_NAME}» guardada`) ?? false);
}

const stepDemo: VerifiedStep = {
  id: "cargar-ejemplo",
  perform: async (signal) => {
    if (byTestId("demo-banner")) return;
    const ok = await waitFor(() => byTestId("demo-load") !== null, signal);
    if (!ok) return;
    const btn = byTestId("demo-load");
    if (btn && !(btn as HTMLButtonElement).disabled) click(btn);
    await waitFor(
      () => byTestId("demo-banner") !== null && byTestId("tender-title") !== null,
      signal,
    );
  },
  verify: async () => byTestId("demo-banner") !== null && byTestId("tender-title") !== null,
};

function rebajaConfirmed(): boolean {
  const conclusion = textOf("conclusion") ?? "";
  const price = textOf("price-net") ?? "";
  const readout = textOf("discount-readout") ?? "";
  // 118.336 € con 15 % de rebaja: precio exacto 100.585,60 €.
  return readout.includes("15") && conclusion.includes("15") && price.includes("100.585,60");
}

const stepRebaja: VerifiedStep = {
  id: "rebaja-15",
  perform: async (signal) => {
    if (!(await gotoTab("precio", signal))) return;
    const ready = await waitFor(() => byTestId("discount-input") !== null, signal);
    if (!ready) return;
    const input = byTestId("discount-input") as HTMLInputElement | null;
    if (input && input.value !== "15") {
      setInputValue(input, "15");
      input.focus();
      input.blur();
    }
    await waitFor(() => rebajaConfirmed(), signal);
  },
  verify: async () => rebajaConfirmed(),
};

const stepGuardar: VerifiedStep = {
  id: "guardar-prueba",
  perform: async (signal) => {
    if (!(await gotoTab("precio", signal))) return;
    const ready = await waitFor(
      () => byTestId("scenario-name") !== null && byTestId("save-scenario") !== null,
      signal,
    );
    if (!ready) return;
    if (scenarioSaved()) return;
    const name = byTestId("scenario-name") as HTMLInputElement | null;
    if (name) setInputValue(name, TOUR_SCENARIO_NAME);
    const save = byTestId("save-scenario");
    if (save && !(save as HTMLButtonElement).disabled) click(save);
    await waitFor(() => scenarioSaved(), signal);
  },
  verify: async () => scenarioSaved(),
};

function informeConfirmed(): boolean {
  const draft = textOf("report-draft-state") ?? "";
  const detail = byTestId("scenario-detail") !== null;
  const chosen = document.querySelector("input[name='decision']:checked") !== null;
  // El tour se detiene en el borrador: archivar es tu decisión, no suya.
  return draft.includes("Borrador") && detail && chosen;
}

const stepInforme: VerifiedStep = {
  id: "borrador-decision",
  perform: async (signal) => {
    if (!(await gotoTab("informe", signal))) return;
    const listReady = await waitFor(
      () =>
        [...document.querySelectorAll("section[aria-label='Escenarios guardados'] button")].some(
          (b) => b.textContent?.includes(TOUR_SCENARIO_NAME) ?? false,
        ),
      signal,
    );
    if (!listReady) return;
    const open = [...document.querySelectorAll("section[aria-label='Escenarios guardados'] button")].find(
      (b) => b.textContent?.includes(TOUR_SCENARIO_NAME) ?? false,
    );
    if (open && open.getAttribute("aria-pressed") !== "true") click(open as HTMLElement);
    // El tour nunca cambia una decisión ya elegida: solo propone si no hay ninguna.
    const chosen = document.querySelector("input[name='decision']:checked");
    if (!chosen) {
      const study = document.querySelector(
        "input[name='decision'][value='study']",
      ) as HTMLInputElement | null;
      if (study) setChecked(study, true);
    }
    await waitFor(() => informeConfirmed(), signal);
  },
  verify: async () => informeConfirmed(),
};

export function buildTourSteps(): VerifiedStep[] {
  return [stepDemo, stepRebaja, stepGuardar, stepInforme];
}
