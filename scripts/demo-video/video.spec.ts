import { expect, test, type Page } from "@playwright/test";
import { installOfflineGuard, takeConsoleFailures } from "../../tests/e2e/helpers";

// Footage real sin narración para el vídeo de 180 s (T33). No es puerta:
// el mismo flujo oro del guion, con pausas para que se lea cada pantalla.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

async function pause(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

test("record gold flow footage", async ({ page }) => {
  test.setTimeout(240_000);
  await installOfflineGuard(page);
  await page.goto("/");
  await pause(page, 1500);
  await page.getByTestId("demo-load").click();
  await expect(page.getByTestId("tender-title")).toContainText("Tías");
  await pause(page, 2000);
  await page.getByRole("tab", { name: "Precio" }).click();
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  await pause(page, 1500);
  await page.getByTestId("discount-input").fill("10");
  await expect(page.getByTestId("price-net")).toContainText("106.502,40");
  await pause(page, 1500);
  await page.getByTestId("scenario-name").fill("Demo 10");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «Demo 10» guardada.")).toBeVisible();
  await pause(page, 1500);
  await page.getByTestId("discount-input").fill("15");
  await expect(page.getByTestId("price-net")).toContainText("100.585,60");
  await page.getByTestId("scenario-name").fill("Demo 15");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «Demo 15» guardada.")).toBeVisible();
  await pause(page, 1500);
  await page.getByRole("tab", { name: "Informe" }).click();
  await expect(page.getByRole("button", { name: /Abrir prueba Demo 10/ })).toBeVisible();
  await page.getByRole("button", { name: /Abrir prueba Demo 10/ }).click();
  await expect(page.getByTestId("scenario-detail")).toBeVisible();
  await pause(page, 2000);
});
