import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, openTab, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

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
    await page.getByRole("button", { name: /Ver página 6 en el pliego/ }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("evidence-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("evidence-drawer")).toBeHidden();

    await openPricing(page);
    await page.getByTestId("scenario-name").fill("E11 teclado");
    await page.getByTestId("save-scenario").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Verla en el informe" })).toBeVisible();

    await page.screenshot({ path: "test-results/e11-desktop.png" });
    expect(guard.blocked()).toBe(0);
  });
});

test.describe("V2 narrow 320x568", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  // BL-V2-14/Q08: el rastro y la tira de cobertura se ajustan sin scroll
  // horizontal global a 320 px.
  test("V2 trace bar and coverage strip fit at 320px", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    const trace = page.getByTestId("decision-trace");
    await expect(trace.locator("li")).toHaveCount(5);
    const overflowResumen = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowResumen).toBeLessThanOrEqual(1);

    await openTab(page, "Citas");
    await expect(page.getByTestId("coverage-card")).toBeVisible();
    const overflowCitas = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowCitas).toBeLessThanOrEqual(1);
    expect(guard.blocked()).toBe(0);
  });
});

test.describe("E11 mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("E11 mobile keeps drawer and save usable by keyboard", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openTab(page, "Requisitos");
    await page.getByRole("button", { name: /Ver página 6 en el pliego/ }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("evidence-drawer")).toBeVisible();
    await page.keyboard.press("Escape");

    await openPricing(page);
    await page.getByTestId("scenario-name").fill("E11 móvil");
    await page.getByTestId("save-scenario").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Verla en el informe" })).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/e11-mobile.png", fullPage: true });
    expect(guard.blocked()).toBe(0);
  });
});
