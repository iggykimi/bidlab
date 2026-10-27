import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// T06: dos copias guardadas se comparan con deltas del backend.
test("CMP-01 two saved scenarios compare with backend deltas", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("scenario-name").fill("CMP base 5");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP base 5» guardada.")).toBeVisible();

  await page.getByTestId("discount-input").fill("15");
  await expect(page.getByTestId("price-net")).toContainText("100.585,60");
  await page.getByTestId("scenario-name").fill("CMP base 15");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP base 15» guardada.")).toBeVisible();

  await page.getByRole("tab", { name: "Informe" }).click();
  await page.getByRole("checkbox", { name: "Comparar CMP base 5" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP base 15" }).check();
  await page.getByTestId("compare-run").click();

  const result = page.getByTestId("compare-result");
  await expect(result).toContainText("Puedes compararlas: comparten contexto.");
  await expect(result).toContainText("CMP base 5");
  await expect(result).toContainText("CMP base 15");
  await expect(result).toContainText("-11.833,60 €");
  await expect(result).toContainText("+2,6");
  await expect(result).toContainText(/cede .* de beneficio/);
  expect(guard.blocked()).toBe(0);
});

// T06: el caso oro 10 % frente a 15 % da los mismos puntos con más beneficio.
test("CMP-02 golden 10 vs 15 keeps 49 points with higher profit", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("discount-input").fill("10");
  await expect(page.getByTestId("economic-score")).toContainText("49,0 de 49");
  await page.getByTestId("scenario-name").fill("CMP oro 10");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP oro 10» guardada.")).toBeVisible();

  await page.getByTestId("discount-input").fill("15");
  await page.getByTestId("scenario-name").fill("CMP oro 15");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP oro 15» guardada.")).toBeVisible();

  await page.getByRole("tab", { name: "Informe" }).click();
  await page.getByRole("checkbox", { name: "Comparar CMP oro 10" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP oro 15" }).check();
  await page.getByTestId("compare-run").click();

  const result = page.getByTestId("compare-result");
  await expect(result).toContainText("Puedes compararlas: comparten contexto.");
  await expect(result).toContainText("-5916,80 €");
  await expect(result).toContainText("con los mismos puntos");
  expect(guard.blocked()).toBe(0);
});
