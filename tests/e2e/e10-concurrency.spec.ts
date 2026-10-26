import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing } from "./helpers";

// E10: cambios rápidos con HTTP retrasado -> gana la última respuesta.
test("E10 rapid changes paint only the latest response", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  let calls = 0;
  await page.route("**/scenarios/evaluate", async (route) => {
    calls += 1;
    if (calls === 1) await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });

  await page.getByTestId("discount-input").fill("10");
  await page.waitForTimeout(400); // first request in flight (delayed)
  await page.getByTestId("discount-input").fill("20");
  await expect(page.getByTestId("price-net")).toContainText("94.668,80");
  await expect(page.getByTestId("profit-net")).toContainText("4668,80");
  await expect(page.getByTestId("economic-score")).toContainText("49,0000");
  await page.waitForTimeout(1000); // stale delayed response must not repaint
  await expect(page.getByTestId("price-net")).toContainText("94.668,80");
  expect(calls).toBeGreaterThanOrEqual(2);
  expect(guard.blocked()).toBe(0);
});
