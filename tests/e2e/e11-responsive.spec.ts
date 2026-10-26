import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, openTab } from "./helpers";

test.describe("E11 desktop 1280x720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("E11 desktop shows KPIs, keyboard drawer and keyboard save", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openPricing(page);
    for (const id of ["price-net", "profit-net", "economic-score", "anomaly-status"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowX).toBeLessThanOrEqual(1);

    await openTab(page, "Requisitos");
    await page.getByRole("button", { name: /Ver evidencia.*página 6/ }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("evidence-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("evidence-drawer")).toBeHidden();

    await openPricing(page);
    await page.getByTestId("scenario-name").fill("E11 teclado");
    await page.getByTestId("save-scenario").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: /Abrir en Informe/ })).toBeVisible();

    await page.screenshot({ path: "test-results/e11-desktop.png" });
    expect(guard.blocked()).toBe(0);
  });
});

test.describe("E11 mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("E11 mobile keeps drawer and save usable by keyboard", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openTab(page, "Requisitos");
    await page.getByRole("button", { name: /Ver evidencia.*página 6/ }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("evidence-drawer")).toBeVisible();
    await page.keyboard.press("Escape");

    await openPricing(page);
    await page.getByTestId("scenario-name").fill("E11 móvil");
    await page.getByTestId("save-scenario").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: /Abrir en Informe/ })).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/e11-mobile.png", fullPage: true });
    expect(guard.blocked()).toBe(0);
  });
});
