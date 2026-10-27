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
  await expect(completeness).toContainText("Tomas estos como todos los rivales");
  await expect(completeness).toContainText("mínimos por grupo");

  await page.getByTestId("rivals-complete").uncheck();
  await expect(completeness).toContainText("Supones un conjunto incompleto");
  await expect(completeness).toContainText("la oferta más barata");
  await expect(page.getByTestId("economic-score")).toContainText("Sin determinar");
  await expect(page.getByTestId("anomaly-status")).toContainText("Sin determinar");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  await expect(page.getByTestId("profit-net")).toContainText("22.419,20");

  await page.getByTestId("rivals-complete").check();
  await page.getByText("Opciones avanzadas").click();
  await page.getByTestId("groups-confirmed").uncheck();
  await expect(completeness).toContainText("sin confirmar");
  await expect(page.getByTestId("anomaly-status")).toContainText("Sin determinar");
  await expect(page.getByTestId("economic-score")).toContainText("46,4 de 49");
  expect(guard.blocked()).toBe(0);
});

// T23: mínimos por grupo del backend (3 referencias, caso de tres licitadores por defecto).
test("T23 group references show backend minima, mean, threshold and branch", async ({
  page,
}) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  const refs = page.getByTestId("group-references");
  await expect(refs).toContainText("Tu oferta");
  await expect(refs).toContainText("Rival A");
  await expect(refs).toContainText("Ofertas de referencia (mínimos por grupo)");
  await expect(page.getByTestId("reference-count")).toHaveText("3");
  await expect(refs).toContainText("tres licitadores, media de las tres ofertas");
  await expect(refs).toContainText("109.658");
  await expect(refs).toContainText("art. 149 LCSP");
  await expect(page.getByTestId("anomaly-detail")).toContainText("3 ofertas de referencia");

  await page.getByText("Opciones avanzadas").click();
  await page.getByTestId("groups-confirmed").uncheck();
  await expect(refs).toContainText("Referencias sin determinar");
  await expect(refs).toContainText("Confirma los grupos");
  expect(guard.blocked()).toBe(0);
});

// T24: cada cifra enlaza a su fuente (fórmula p.10, regla p.20, Atom, huellas).
test("T24 every figure links to its source or citation", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await expect(page.getByRole("link", { name: "Fuente oficial" })).toBeVisible();
  await expect(page.getByTestId("source-hashes")).toContainText("Detalles técnicos");
  await expect(page.getByTestId("source-hashes")).toContainText("copia del anuncio oficial");

  const kpis = page.locator("section[aria-label='Indicadores']");
  await kpis.getByRole("button", { name: /p\. 10: ver cita/ }).first().click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await expect(page.getByTestId("evidence-page")).toContainText("Página 10 de 41");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("evidence-drawer")).toBeHidden();

  await kpis.getByRole("button", { name: /p\. 20: ver cita/ }).first().click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await expect(page.getByTestId("evidence-page")).toContainText("Página 20 de 41");
  await page.keyboard.press("Escape");

  // La traza y la curva conservan valores del backend con sus fuentes.
  await expect(page.getByTestId("calculation-trace")).toContainText("Tu precio");
  await expect(page.getByTestId("calculation-trace")).toContainText("112.419,20");
  await page.getByTestId("curve-table").locator("summary").click();
  await expect(page.getByTestId("curve-table")).toContainText("112.419,20");
  await expect(page.getByTestId("curve-table")).toContainText("¿Oferta sospechosa?");
  expect(guard.blocked()).toBe(0);
});

// T24: guardar confirma con el nombre de la prueba y enlaza al informe.
test("T24 saving confirms with the scenario name and a report link", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("scenario-name").fill("T24 prueba");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «T24 prueba» guardada.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Verla en el informe" })).toBeVisible();
  expect(guard.blocked()).toBe(0);
});
