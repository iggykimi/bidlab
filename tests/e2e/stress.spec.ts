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
  await expect(selection).toContainText("cumple tus límites en 1 hipótesis", { timeout: 60_000 });
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
  await expect(selection).toContainText("cumple tus límites en 1 hipótesis", { timeout: 60_000 });
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

test("editing inputs after a run marks it stale and blocks apply", async ({ page }) => {
  test.setTimeout(120_000);
  await installOfflineGuard(page);
  const section = await openStress(page);
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
  await expect(section.getByTestId("stress-selection")).toContainText("cumple tus límites", {
    timeout: 60_000,
  });
  await expect(section.getByTestId("stress-stale-input")).toHaveCount(0);
  await expect(section.getByTestId("stress-apply")).toBeEnabled();
  // BL-V2-06: heatmap mirrors the same cells with text, never color alone.
  const heatmap = section.getByTestId("stress-heatmap");
  await expect(heatmap).toBeVisible();
  await expect(heatmap).toContainText("Mapa de la malla");
  await expect(heatmap.getByRole("columnheader", { name: "Base" })).toBeVisible();
  await expect(heatmap.getByRole("rowheader", { name: "5 %", exact: true })).toBeVisible();

  await section.getByLabel("Beneficio mínimo en € (coma o punto)").fill("9000");
  await expect(section.getByTestId("stress-stale-input")).toContainText("Vuelve a probarla");
  await expect(section.getByTestId("stress-apply")).toBeDisabled();
  // BL-V3 P1-03: the stale banner renders before the conclusion title.
  const order = await section.evaluate((el) => {
    const banner = el.querySelector('[data-testid="stress-stale-input"]');
    const sel = el.querySelector('[data-testid="stress-selection"]');
    if (!(banner instanceof Element) || !(sel instanceof Element)) return "missing";
    return banner.compareDocumentPosition(sel) & Node.DOCUMENT_POSITION_FOLLOWING
      ? "banner-first"
      : "selection-first";
  });
  expect(order).toBe("banner-first");
  // The old grid stays visible as history, with its timestamp.
  await expect(section.getByTestId("stress-selection")).toContainText("cumple tus límites");
  await expect(section.getByTestId("stress-computed-at")).toContainText("Calculada el");
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

// BL-V3 P1-03 (BL-FIX-02): two hypotheses sharing a label render as two
// columns and two detail blocks; equal labels must not collapse the mesh.
test("duplicate hypothesis labels do not collapse the mesh", async ({ page }) => {
  test.setTimeout(120_000);
  await installOfflineGuard(page);
  const section = await openStress(page);
  await section.getByLabel("Rebaja inicial en tanto por ciento").fill("5");
  await section.getByLabel("Rebaja final en tanto por ciento").fill("15");
  await section.getByLabel("Paso de la malla en tanto por ciento").fill("5");
  await section.getByLabel("Etiqueta").nth(0).fill("Duplicada");
  await section.getByLabel("Tu coste sin impuestos en \u20ac (coma o punto)").nth(0).fill("80000,00");
  await section.getByLabel("Periodo en meses").nth(0).fill("24");
  await section.getByLabel("Rival A \u00b7 precio sin impuestos en \u20ac").nth(0).fill("110000,00");
  await section.getByLabel("Rival B \u00b7 precio sin impuestos en \u20ac").nth(0).fill("115000,00");
  await section.getByRole("button", { name: "A\u00f1adir hip\u00f3tesis" }).click();
  await section.getByLabel("Etiqueta").nth(1).fill("Duplicada");
  await section.getByLabel("Tu coste sin impuestos en \u20ac (coma o punto)").nth(1).fill("90000,00");
  await section.getByLabel("Periodo en meses").nth(1).fill("24");
  await section.getByLabel("Rival A \u00b7 precio sin impuestos en \u20ac").nth(1).fill("100000,00");
  await section.getByLabel("Rival B \u00b7 precio sin impuestos en \u20ac").nth(1).fill("105000,00");
  await section.getByLabel("Puntos por precio m\u00ednimos").fill("40");
  await section.getByLabel("Beneficio m\u00ednimo en \u20ac (coma o punto)").fill("1000");
  await section.getByTestId("stress-run").click();
  const heatmap = section.getByTestId("stress-heatmap");
  await expect(heatmap).toBeVisible({ timeout: 60_000 });
  await expect(heatmap.getByRole("columnheader", { name: "Duplicada" })).toHaveCount(2);
  await expect(section.locator("details summary", { hasText: "Duplicada" })).toHaveCount(2);
});
// BL-V3 P1-03: with 4 hypotheses the heatmap opens as a 3-column minimap;
// the dense detail opens on demand while the worst-case table stays complete.
test("heatmap minimap expands to all hypotheses on demand", async ({ page }) => {
  test.setTimeout(120_000);
  await installOfflineGuard(page);
  const section = await openStress(page);
  await section.getByLabel("Rebaja inicial en tanto por ciento").fill("5");
  await section.getByLabel("Rebaja final en tanto por ciento").fill("15");
  await section.getByLabel("Paso de la malla en tanto por ciento").fill("5");
  await section.getByRole("button", { name: "A\u00f1adir hip\u00f3tesis" }).click();
  await section.getByRole("button", { name: "A\u00f1adir hip\u00f3tesis" }).click();
  await section.getByRole("button", { name: "A\u00f1adir hip\u00f3tesis" }).click();
  for (let i = 0; i < 4; i++) {
    await section.getByLabel("Etiqueta").nth(i).fill(`Mini ${i + 1}`);
    await section.getByLabel("Tu coste sin impuestos en \u20ac (coma o punto)").nth(i).fill("80000,00");
    await section.getByLabel("Periodo en meses").nth(i).fill("24");
    await section.getByLabel("Rival A \u00b7 precio sin impuestos en \u20ac").nth(i).fill("110000,00");
    await section.getByLabel("Rival B \u00b7 precio sin impuestos en \u20ac").nth(i).fill("115000,00");
  }
  await section.getByLabel("Puntos por precio m\u00ednimos").fill("40");
  await section.getByLabel("Beneficio m\u00ednimo en \u20ac (coma o punto)").fill("1000");
  await section.getByTestId("stress-run").click();
  const heatmap = section.getByTestId("stress-heatmap");
  await expect(heatmap).toBeVisible({ timeout: 60_000 });
  await expect(heatmap.locator("thead th")).toHaveCount(4);
  const more = section.getByTestId("stress-heatmap-more");
  await expect(more).toContainText("Ver las 4 hipótesis");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(heatmap.locator("thead th")).toHaveCount(5);
  await expect(more).toContainText("Ver solo 3 hipótesis");
  await expect(section.getByTestId("stress-row-0.0500")).toBeVisible();
});
