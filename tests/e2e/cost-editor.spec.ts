import { expect, test, type APIRequestContext } from "@playwright/test";
import { API_BASE, installOfflineGuard, loadDemo, openPricing, openTab, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

/** Restore the pristine demo company so the suite stays order-independent. */
async function restorePristineCompany(request: APIRequestContext): Promise<void> {
  const current = await request.get(`${API_BASE}/companies/company-demo`);
  expect(current.ok()).toBe(true);
  const body = (await current.json()) as { revision: number };
  const restored = await request.put(`${API_BASE}/companies/company-demo`, {
    headers: { "Content-Type": "application/json", "X-BidLab-Client": "local-ui" },
    data: {
      expected_revision: body.revision,
      name: "Pyme de ejemplo",
      synthetic: true,
      scope_id: "tias-whole",
      period_months: 24,
      direct_cost_net: "80000.00",
      overhead_net: "10000.00",
      target_margin_rate: "0.1000",
      evidence: [],
    },
  });
  expect(restored.ok()).toBe(true);
}

// UX-06: edit direct cost -> save -> profit changes and company rev bumps.
test("cost editor save reprices profit and bumps the company revision", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await restorePristineCompany(page.request);
  await openPricing(page);
  await expect(page.getByTestId("profit-net")).toContainText("22.419,20");

  await page.getByText("Identificadores y códigos").click();
  const revText = await page.getByText(/company-demo rev\. \d+/).textContent();
  const rev = Number(/rev\. (\d+)/.exec(revText ?? "")?.[1]);
  expect(Number.isInteger(rev)).toBe(true);

  await page.getByTestId("cost-direct").fill("70000");
  await page.getByTestId("save-cost").click();
  await expect(page.getByTestId("profit-net")).toContainText("32.419,20");
  await expect(page.getByText(`company-demo rev. ${rev + 1}`)).toBeVisible();

  await restorePristineCompany(page.request);
  expect(guard.blocked()).toBe(0);
});

// UX-07: requirements action link lands on pricing with the cost card visible.
test("requirements action link opens the cost card on pricing", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openTab(page, "Requisitos");
  await page.getByRole("link", { name: /Aportar dato/ }).first().click();
  await expect(page.getByRole("tab", { name: "Precio" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#tu-coste")).toBeVisible();
  await expect(page.getByTestId("cost-direct")).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

// J1 P1-2: the link preselects the datum the requirement needs, in human words.
test("aportar dato preselects the needed evidence field", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openTab(page, "Requisitos");
  const link = page.getByRole("link", { name: /Aportar dato/ }).first();
  const href = await link.getAttribute("href");
  const field = new URL(href ?? "", "http://x/").searchParams.get("campo");
  expect(field).toBeTruthy();
  await link.click();
  await expect(page.locator("#tu-coste")).toBeFocused();
  await expect(page.getByTestId("evidence-key")).toHaveValue(field ?? "");
  await expect(page.getByTestId("evidence-key")).toContainText("Volumen anual");
  expect(guard.blocked()).toBe(0);
});
