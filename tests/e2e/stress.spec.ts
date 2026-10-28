import { expect, test, type Page } from "@playwright/test";
import { installOfflineGuard, loadDemo, openTab, takeConsoleFailures } from "./helpers";

// Malla de resistencia: validación honesta, ejecución contra el backend,
// selección de rebaja y traslado al simulador.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

async function openStress(page: Page) {
  await loadDemo(page);
  await openTab(page, "Precio");
  const section = page.getByTestId("stress-section");
  await expect(section).toBeVisible();
  return section;
}

test("empty cost blocks the run with a plain error", async ({ page }) => {
  await installOfflineGuard(page);
  const section = await openStress(page);
  await section.getByTestId("stress-run").click();
  await expect(section.getByRole("alert")).toContainText("Revisa tu coste en «Base» (como 80000,00).");
});

test("narrow grid runs, selects and applies a rebate", async ({ page }) => {
  test.setTimeout(120_000);
  await installOfflineGuard(page);
  const section = await openStress(page);
  await section.getByLabel("Rebaja inicial en tanto por ciento").fill("5");
  await section.getByLabel("Rebaja final en tanto por ciento").fill("15");
  await section.getByLabel("Paso de la malla en tanto por ciento").fill("5");
  await expect(section.getByRole("status")).toContainText("Esta malla prueba 3 rebajas.");
  await section.getByLabel("Tu coste sin impuestos en € (coma o punto)").fill("80000,00");
  await section.getByLabel("Periodo en meses").fill("24");
  await section.getByLabel("Rival A · precio sin impuestos en €").fill("110000,00");
  await section.getByLabel("Rival B · precio sin impuestos en €").fill("115000,00");
  await section.getByLabel("Tomar estos como todos los rivales").check();
  await section.getByLabel("Cada rival es de una empresa distinta").check();
  await section.getByLabel("Puntos por precio mínimos").fill("40");
  await section.getByLabel("Beneficio mínimo en € (coma o punto)").fill("1000");
  await section.getByTestId("stress-run").click();
  const selection = section.getByTestId("stress-selection");
  await expect(selection).toContainText("cumple tus límites", { timeout: 60_000 });
  await expect(section.getByTestId("stress-row-0.0500")).toBeVisible();
  const text = await selection.textContent();
  const match = text?.match(/del ([\d,]+)\s%/);
  expect(match, "selection percent").not.toBeNull();
  await section.getByTestId("stress-apply").click();
  await expect(section.getByText("Ya tienes esa rebaja en el simulador.")).toBeVisible();
  await expect(page.getByTestId("discount-readout")).toContainText(`Rebaja: ${match![1]} %`);
});
