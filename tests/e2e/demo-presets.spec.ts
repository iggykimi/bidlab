import { expect, test } from "@playwright/test";
import { API_BASE, installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
});

test("example shortcuts apply declared inputs without saving or changing company costs", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  const beforeResponse = await page.request.get(`${API_BASE}/companies/company-demo`);
  expect(beforeResponse.ok()).toBe(true);
  const before = await beforeResponse.json();
  let saved = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/scenarios") saved += 1;
  });

  await page.getByTestId("demo-case-10").click();
  await expect(page.getByTestId("price-net")).toContainText("106.502,40");
  await expect(page.getByTestId("profit-net")).toContainText("16.502,40");
  await expect(page.getByTestId("economic-score")).toContainText("49,0 de 49");

  await page.getByTestId("demo-case-15").click();
  await expect(page.getByTestId("price-net")).toContainText("100.585,60");
  await expect(page.getByTestId("profit-net")).toContainText("10.585,60");
  await expect(page.getByTestId("economic-score")).toContainText("49,0 de 49");

  await page.getByTestId("demo-case-30").click();
  await expect(page.getByTestId("anomaly-status")).toContainText("Sí");
  await expect(page.getByTestId("anomaly-card")).toContainText("justifiques tus costes");

  await page.getByTestId("demo-case-incomplete").click();
  await expect(page.getByTestId("economic-score")).toContainText("Sin determinar");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  await expect(page.getByTestId("rivals-complete")).not.toBeChecked();
  await expect(page.getByTestId("offer-composition")).toContainText("90.000,00");

  const afterResponse = await page.request.get(`${API_BASE}/companies/company-demo`);
  expect(afterResponse.ok()).toBe(true);
  expect(await afterResponse.json()).toEqual(before);
  expect(saved).toBe(0);
  expect(guard.blocked()).toBe(0);
});

test("a new draft cannot borrow its labels from the previous painted result or be saved early", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/scenarios/evaluate", async (route) => {
    await gate;
    await route.continue();
  });

  try {
    await page.getByTestId("discount-input").fill("10");
    await expect(page.getByTestId("stale-result")).toBeVisible();
    await expect(page.getByTestId("save-scenario")).toBeDisabled();
    await expect(page.getByTestId("conclusion")).toContainText("rebaja del 5,0");
    await expect(page.getByTestId("conclusion")).not.toContainText("rebaja del 10,0");
    await expect(page.getByTestId("calculation-trace")).toContainText("menos un 5,0");
    await expect(page.getByTestId("offer-composition")).toContainText("Reparto del cálculo anterior");
  } finally {
    release();
  }
  await expect(page.getByTestId("price-net")).toContainText("106.502,40");
  await expect(page.getByTestId("conclusion")).toContainText("rebaja del 10,0");
  await expect(page.getByTestId("save-scenario")).toBeEnabled();
  expect(guard.blocked()).toBe(0);
});
