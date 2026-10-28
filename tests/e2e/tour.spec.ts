import { expect, test } from "@playwright/test";
import { installOfflineGuard, takeConsoleFailures } from "./helpers";

// Tour verificado: la barra ejecuta pasos DOM reales sobre la app y se
// detiene en el primer paso sin prueba. Sin ?tour=1 la UI no cambia.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

test("tour bar hidden without ?tour=1", async ({ page }) => {
  await installOfflineGuard(page);
  await page.goto("/");
  await expect(page.getByTestId("tour-bar")).toHaveCount(0);
});

test("full guided tour ends with scenario saved and draft open", async ({ page }) => {
  test.setTimeout(120_000);
  await installOfflineGuard(page);
  await page.goto("/?tour=1");
  await expect(page.getByTestId("tour-bar")).toBeVisible();
  await page.getByTestId("tour-start").click();
  await expect(page.getByTestId("tour-status")).toContainText("Visita terminada", { timeout: 90_000 });
  await expect(page.getByTestId("report-draft-state")).toContainText("Borrador");
  await expect(page.getByTestId("scenario-detail")).toBeVisible();
});
