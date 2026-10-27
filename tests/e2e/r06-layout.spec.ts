import { expect, test, type Page } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// R06: rebate field in the first viewport, cost summary + wide editor,
// compare from Precio, no page-level horizontal scroll.
// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

function uniqueTag(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function saveNamed(page: Page, name: string): Promise<void> {
  await page.getByTestId("scenario-name").fill(name);
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText(`Prueba «${name}» guardada.`)).toBeVisible();
}

/** The discount FIELD box (not another block) fits in the viewport. */
async function expectFieldInViewport(page: Page, width: number, height: number): Promise<void> {
  const box = await page.getByTestId("discount-input").boundingBox();
  expect(box, "discount field box").not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height);
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll, "no horizontal page scroll").toBeLessThanOrEqual(overflow.client);
}

test.use({ viewport: { width: 1280, height: 720 } });

// R06 desktop: field, label, title/context and example notice in viewport.
test("R06 rebate field visible at 1280x720 with title and example notice", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await expectFieldInViewport(page, 1280, 720);
  await expect(page.getByText("Escribe tu rebaja (%)")).toBeVisible();
  await expect(page.getByTestId("tender-title")).toBeVisible();
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expectNoPageOverflow(page);
  expect(guard.blocked()).toBe(0);
});

// R06 desktop: cost summary first, editor opens wide on demand.
test("R06 cost summary expands to a wide editor", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await expect(page.getByTestId("cost-summary")).toContainText("Pyme de ejemplo");
  await expect(page.getByTestId("cost-direct")).toHaveCount(0);
  await page.getByTestId("cost-toggle").click();
  await expect(page.getByTestId("cost-direct")).toBeVisible();
  const box = await page.getByTestId("cost-editor").boundingBox();
  expect(box, "cost editor box").not.toBeNull();
  expect(box!.width, "wide editor, not a narrow column").toBeGreaterThan(700);
  await page.getByTestId("cost-toggle").click();
  await expect(page.getByTestId("cost-summary")).toBeVisible();
  await expectNoPageOverflow(page);
  expect(guard.blocked()).toBe(0);
});

// R06 desktop: two compatible pruebas compare from the Precio phase.
test("R06 two saved pruebas compare from Precio", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("discount-input").fill("10");
  await expect(page.getByTestId("price-net")).toContainText("106.502,40");
  await saveNamed(page, `R06 diez ${tag}`);
  await page.getByTestId("discount-input").fill("15");
  await expect(page.getByTestId("price-net")).toContainText("100.585,60");
  await saveNamed(page, `R06 quince ${tag}`);

  await page.getByRole("checkbox", { name: `Comparar R06 diez ${tag}` }).check();
  await page.getByRole("checkbox", { name: `Comparar R06 quince ${tag}` }).check();
  await page.getByTestId("compare-run").click();
  const result = page.getByTestId("compare-result");
  await expect(result).toContainText("Puedes compararlas: comparten contexto.");
  await expect(result).toContainText("R06 diez");
  await expect(result).toContainText("R06 quince");
  expect(guard.blocked()).toBe(0);
});

test.describe("mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // R06 mobile: the rebate field sits near the top, no long scroll.
  test("R06 rebate field visible at 390x844", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openPricing(page);

    await expectFieldInViewport(page, 390, 844);
    await expect(page.getByText("Escribe tu rebaja (%)")).toBeVisible();
    await expect(page.getByTestId("tender-title")).toBeVisible();
    await expect(page.getByTestId("demo-banner")).toBeVisible();
    await expectNoPageOverflow(page);
    expect(guard.blocked()).toBe(0);
  });
});
