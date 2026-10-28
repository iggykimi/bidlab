import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { API_BASE, installOfflineGuard, loadDemo, openTab, takeConsoleFailures } from "./helpers";

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

/** Restore the pristine demo company so the suite stays order-independent. */
async function restorePristineCompany(request: APIRequestContext): Promise<void> {
  const current = await request.get(`${API_BASE}/companies/company-demo`);
  expect(current.ok()).toBe(true);
  const body = (await current.json()) as { revision: number };
  const restored = await request.put(`${API_BASE}/companies/company-demo`, {
    headers: { "Content-Type": "application/json", "X-BidLab-Client": "local-ui" },
    data: {
      expected_revision: body.revision,
      name: "Pyme de ejemplo",
      synthetic: true,
      scope_id: "tias-whole",
      period_months: 24,
      direct_cost_net: "80000.00",
      overhead_net: "10000.00",
      target_margin_rate: "0.1000",
      evidence: [],
    },
  });
  expect(restored.ok()).toBe(true);
}

test("company change marks the grid stale with its timestamp", async ({ page }) => {
  test.setTimeout(120_000);
  await installOfflineGuard(page);
  await loadDemo(page);
  await restorePristineCompany(page.request);
  await openTab(page, "Precio");
  const section = page.getByTestId("stress-section");
  await expect(section).toBeVisible();
  await section.getByLabel("Rebaja inicial en tanto por ciento").fill("5");
  await section.getByLabel("Rebaja final en tanto por ciento").fill("15");
  await section.getByLabel("Paso de la malla en tanto por ciento").fill("5");
  await section.getByLabel("Tu coste sin impuestos en € (coma o punto)").fill("80000,00");
  await section.getByLabel("Periodo en meses").fill("24");
  await section.getByLabel("Rival A · precio sin impuestos en €").fill("110000,00");
  await section.getByLabel("Rival B · precio sin impuestos en €").fill("115000,00");
  await section.getByLabel("Puntos por precio mínimos").fill("40");
  await section.getByLabel("Beneficio mínimo en € (coma o punto)").fill("1000");
  await section.getByTestId("stress-run").click();
  const selection = section.getByTestId("stress-selection");
  await expect(selection).toContainText("cumple tus límites", { timeout: 60_000 });
  await expect(section.getByTestId("stress-computed-at")).toContainText("Calculada el");
  await expect(section.getByTestId("stress-stale")).toHaveCount(0);

  await page.getByTestId("cost-toggle").click();
  await page.getByTestId("cost-direct").fill("70000");
  await page.getByTestId("save-cost").click();
  await expect(page.getByTestId("profit-net")).toContainText("32.419,20");
  await expect(section.getByTestId("stress-stale")).toContainText("Vuelve a probarla");
  await expect(section.getByTestId("stress-computed-at")).toContainText("Calculada el");

  await restorePristineCompany(page.request);
});

test("selection shows the cost ceiling with its disclaimers", async ({ page }) => {
  test.setTimeout(120_000);
  await installOfflineGuard(page);
  const section = await openStress(page);
  await section.getByLabel("Rebaja inicial en tanto por ciento").fill("12");
  await section.getByLabel("Rebaja final en tanto por ciento").fill("12");
  await section.getByLabel("Paso de la malla en tanto por ciento").fill("0.5");
  await section.getByLabel("Tu coste sin impuestos en € (coma o punto)").fill("80000,00");
  await section.getByLabel("Periodo en meses").fill("24");
  await section.getByLabel("Rival A · precio sin impuestos en €").fill("106502,40");
  await section.getByLabel("Rival B · precio sin impuestos en €").fill("112419,20");
  await section.getByLabel("Puntos por precio mínimos").fill("47");
  await section.getByLabel("Beneficio mínimo en € (coma o punto)").fill("8000");
  await section.getByTestId("stress-run").click();
  const ceiling = section.getByTestId("stress-cost-ceiling");
  await expect(ceiling).toContainText("tu coste máximo es", { timeout: 60_000 });
  await expect(ceiling).toContainText("96.135,68");
  await expect(section.getByText("misma base: mismo precio, periodo, impuestos y moneda")).toBeVisible();
  await expect(
    section.getByText("No es una probabilidad ni una predicción de rivales")
  ).toBeVisible();
  await expect(section.getByRole("columnheader", { name: "Tu coste máximo" })).toBeVisible();
});
