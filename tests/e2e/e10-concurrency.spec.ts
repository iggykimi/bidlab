import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

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
  // C11 intencional: espera fija para solapar la primera petición (retrasada
  // 800ms por el route) con la segunda; no hay estado observable que esperar.
  await page.waitForTimeout(400); // first request in flight (delayed)
  await page.getByTestId("discount-input").fill("20");
  await expect(page.getByTestId("price-net")).toContainText("94.668,80");
  await expect(page.getByTestId("profit-net")).toContainText("4668,80");
  await expect(page.getByTestId("economic-score")).toContainText("49,0000");
  // C11 intencional: ventana para que una respuesta obsoleta repintase si el
  // guard latest-wins fallara; el aserto posterior la delataría.
  await page.waitForTimeout(1000); // stale delayed response must not repaint
  await expect(page.getByTestId("price-net")).toContainText("94.668,80");
  expect(calls).toBeGreaterThanOrEqual(2);
  expect(guard.blocked()).toBe(0);
});
