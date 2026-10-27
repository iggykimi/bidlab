import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// T23: el flujo complete=false se declara en el panel y conserva la economía.
test("T23 incomplete set declares unknown score and anomaly, economics intact", async ({
  page,
}) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  const completeness = page.getByTestId("rival-completeness");
  await expect(completeness).toContainText("Conjunto completo supuesto");
  await expect(completeness).toContainText("mínimos por grupo");

  await page.getByTestId("rivals-complete").uncheck();
  await expect(completeness).toContainText("Conjunto incompleto supuesto");
  await expect(completeness).toContainText("mejor oferta");
  await expect(page.getByTestId("economic-score")).toContainText("Sin determinar");
  await expect(page.getByTestId("anomaly-status")).toContainText("Sin determinar");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  await expect(page.getByTestId("profit-net")).toContainText("22.419,20");

  await page.getByTestId("rivals-complete").check();
  await page.getByTestId("groups-confirmed").uncheck();
  await expect(completeness).toContainText("sin confirmar");
  await expect(page.getByTestId("anomaly-status")).toContainText("Sin determinar");
  await expect(page.getByTestId("economic-score")).toContainText("46,4211");
  expect(guard.blocked()).toBe(0);
});

// T23: mínimos por grupo del backend (3 referencias, rama n3_no_trim por defecto).
test("T23 group references show backend minima, mean, threshold and branch", async ({
  page,
}) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  const refs = page.getByTestId("group-references");
  await expect(refs).toContainText("Oferta propia");
  await expect(refs).toContainText("Hipótesis A");
  await expect(refs).toContainText("Ofertas de referencia (mínimos por grupo)");
  await expect(page.getByTestId("reference-count")).toHaveText("3");
  await expect(refs).toContainText("n3_no_trim");
  await expect(refs).toContainText("109.658");
  await expect(refs).toContainText("LCSP 149.3");
  await expect(page.getByTestId("anomaly-detail")).toContainText("3 ofertas de referencia");

  await page.getByTestId("groups-confirmed").uncheck();
  await expect(refs).toContainText("Referencias sin determinar");
  await expect(refs).toContainText("sin confirmar");
  expect(guard.blocked()).toBe(0);
});

// T24: cada cifra enlaza a su fuente (regla p.10, política p.20, Atom, huellas).
test("T24 every figure links to its source or citation", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await expect(page.getByRole("link", { name: /Fuente oficial \(Atom\)/ })).toBeVisible();
  await expect(page.getByTestId("source-hashes")).toContainText("Huellas de fuente (2)");
  await expect(page.getByTestId("source-hashes")).toContainText("snapshot Atom");

  const kpis = page.locator("section[aria-label='Indicadores']");
  await kpis.getByRole("button", { name: /p\. 10: ver evidencia/ }).first().click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await expect(page.getByTestId("evidence-page")).toContainText("Página 10 de 41");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("evidence-drawer")).toBeHidden();

  await kpis.getByRole("button", { name: /p\. 20: ver evidencia/ }).first().click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await expect(page.getByTestId("evidence-page")).toContainText("Página 20 de 41");
  await page.keyboard.press("Escape");

  // La traza y la curva conservan valores del backend con sus fuentes.
  await expect(page.getByTestId("calculation-trace")).toContainText("Precio de oferta");
  await expect(page.getByTestId("calculation-trace")).toContainText("112419.20");
  await page.getByTestId("curve-table").locator("summary").click();
  await expect(page.getByTestId("curve-table")).toContainText("112.419,20");
  await expect(page.getByTestId("curve-table")).toContainText("Sin presunción");
  expect(guard.blocked()).toBe(0);
});
