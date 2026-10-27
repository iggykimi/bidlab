import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// UX-01: la rebaja sobrevive a cambiar de sección y a recargar.
test("UX-01 discount draft survives tab switch and reload", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await expect(page.getByTestId("conclusion")).toContainText("ofertarías");

  await page.getByTestId("discount-input").fill("14");
  await expect(page.getByTestId("price-net")).toContainText("101.768,96");

  await page.getByRole("tab", { name: "Requisitos" }).click();
  await expect(page.getByRole("tab", { name: "Requisitos" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Precio" }).click();
  await expect(page.getByTestId("discount-input")).toHaveValue("14");
  await expect(page.getByTestId("price-net")).toContainText("101.768,96");

  await page.reload();
  await expect(page.getByTestId("discount-input")).toHaveValue("14");
  await expect(page.getByTestId("price-net")).toContainText("101.768,96");
  expect(guard.blocked()).toBe(0);
});

// UX-02: la nota del informe sobrevive a cambiar de sección.
test("UX-02 report note survives tab switch", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await page.getByRole("tab", { name: "Informe" }).click();
  await page.getByTestId("report-note-input").fill("Revisar el seguro antes del viernes.");
  await page.getByRole("tab", { name: "Precio" }).click();
  await expect(page.getByTestId("discount-input")).toBeVisible();
  await page.getByRole("tab", { name: "Informe" }).click();
  await expect(page.getByTestId("report-note-input")).toHaveValue(
    "Revisar el seguro antes del viernes."
  );
  expect(guard.blocked()).toBe(0);
});

// UX-03: editar tras guardar muestra "cambios desde la copia", no un falso guardado.
test("UX-03 editing after save shows changes since the copy", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await expect(page.getByTestId("conclusion")).toContainText("ofertarías");

  await page.getByTestId("discount-input").fill("13");
  await expect(page.getByTestId("price-net")).toContainText("102.952,32");
  await page.getByTestId("scenario-name").fill("Borrador UX 13");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «Borrador UX 13» guardada.")).toBeVisible();

  await page.getByTestId("discount-input").fill("14");
  await expect(page.getByText("Cambios desde la copia guardada «Borrador UX 13».")).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

// UX-05: una copia guardada se reabre como borrador editable sin tocar el original.
test("UX-05 saved scenario reopens as an editable copy", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await expect(page.getByTestId("conclusion")).toContainText("ofertarías");

  await page.getByTestId("discount-input").fill("13");
  await expect(page.getByTestId("price-net")).toContainText("102.952,32");
  await page.getByTestId("scenario-name").fill("Base para copiar");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «Base para copiar» guardada.")).toBeVisible();

  await page.getByRole("tab", { name: "Informe" }).click();
  await page.getByRole("button", { name: /Abrir escenario Base para copiar/ }).click();
  const detail = page.getByTestId("scenario-detail");
  await expect(detail).toContainText("102.952,32");
  await detail.getByTestId("open-as-copy").click();

  await expect(page.getByTestId("discount-input")).toHaveValue("13");
  await expect(page.getByTestId("scenario-name")).toHaveValue("Base para copiar (copia)");
  await expect(page.getByTestId("price-net")).toContainText("102.952,32");
  await expect(page.getByText("Prueba «Base para copiar» guardada.")).toHaveCount(0);
  expect(guard.blocked()).toBe(0);
});

// UX-04: durante el recálculo, las cifras viejas se rotulan como anteriores.
test("UX-04 stale figures are labelled while recalculating", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");

  // Retraso determinista de la próxima evaluación para ver el estado intermedio.
  let delayed = false;
  await page.route("**/api/v1/scenarios/evaluate", async (route) => {
    if (!delayed) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await route.continue();
  });

  await page.getByTestId("discount-input").fill("20");
  await expect(page.getByTestId("stale-result")).toContainText("cálculo anterior");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  await expect(page.getByTestId("price-net")).toContainText("94.668,80", { timeout: 15000 });
  await expect(page.getByTestId("stale-result")).toHaveCount(0);
  expect(guard.blocked()).toBe(0);
});
