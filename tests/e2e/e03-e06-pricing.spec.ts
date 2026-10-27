import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// E03: 5 -> 15 por campo y teclado del deslizador; precio, beneficio, puntos y traza.
test("E03 discount 5 to 15 updates price profit score and trace", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await expect(page.getByTestId("conclusion")).toContainText("ofertarías");
  await expect(page.getByTestId("conclusion")).toContainText("112.419 €");
  await expect(page.getByTestId("profit-net")).toContainText("22.419,20");
  await expect(page.getByTestId("economic-score")).toContainText("46,4 de 49");

  await page.getByTestId("discount-input").fill("15");
  await page.getByTestId("discount-input").press("Tab");
  await expect(page.getByTestId("price-net")).toContainText("100.585,60");
  await expect(page.getByTestId("profit-net")).toContainText("10.585,60");
  await expect(page.getByTestId("economic-score")).toContainText("49,0 de 49");
  await expect(page.getByTestId("calculation-trace")).toContainText("100.585,60");

  // Teclado en el deslizador: Fin -> 40 %.
  await page.getByTestId("discount-slider").focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("price-net")).toContainText("71.001,60");

  // Botones grandes: − baja un punto (40 -> 39).
  await page.getByTestId("discount-minus").click();
  await expect(page.getByTestId("discount-readout")).toContainText("Rebaja: 39,0 %");
  await expect(page.getByTestId("price-net")).toContainText("72.184,96");
  expect(guard.blocked()).toBe(0);
});

// E04: rival A a 100585.60 con propia al 5 % -> 43,8 de 49; hipótesis visibles, sin probabilidades.
test("E04 rival A change reprices score without probability claims", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await page.getByTestId("rival-a-price").fill("100585.60");
  await expect(page.getByTestId("economic-score")).toContainText("43,8 de 49");
  await expect(page.getByTestId("assumptions")).toContainText(
    "Precios de rivales inventados por ti para probar"
  );
  await expect(page.locator("main")).not.toContainText(/probabilidad/i);
  await expect(page.locator("main")).not.toContainText(/optimizar para ganar/i);
  expect(guard.blocked()).toBe(0);
});

// E05: rivales de vuelta y propia al 30 % -> presunción, nunca «excluida».
test("E05 own 30 percent raises a conditional presumption", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await page.getByTestId("discount-input").fill("30");
  await page.getByTestId("discount-input").press("Tab");
  await expect(page.getByTestId("anomaly-status")).toHaveText("Sí");
  await expect(page.getByTestId("anomaly-detail")).toContainText("cae por debajo");
  await expect(page.getByTestId("anomaly-detail")).toContainText("justifiques tus costes");
  await expect(page.locator("main")).not.toContainText(/excluida/i);
  expect(guard.blocked()).toBe(0);
});

// E06: quitar completitud/grupos -> unknown correspondiente; cifras económicas intactas.
test("E06 incomplete rivals or groups yield unknown without losing economics", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("rivals-complete").uncheck();
  await expect(page.getByTestId("economic-score")).toContainText("Sin determinar");
  await expect(page.getByTestId("anomaly-status")).toContainText("Sin determinar");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  await expect(page.getByTestId("profit-net")).toContainText("22.419,20");

  await page.getByTestId("rivals-complete").check();
  await page.getByText("Opciones avanzadas").click();
  await page.getByTestId("groups-confirmed").uncheck();
  await expect(page.getByTestId("anomaly-status")).toContainText("Sin determinar");
  await expect(page.getByTestId("economic-score")).toContainText("46,4 de 49");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  expect(guard.blocked()).toBe(0);
});
