import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
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

async function saveNamed(page: Page, name: string): Promise<string> {
  await page.getByTestId("scenario-name").fill(name);
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText(`Prueba «${name}» guardada.`)).toBeVisible();
  const href = await page.getByRole("link", { name: "Verla en el informe" }).getAttribute("href");
  const id = new URL(href ?? "", "http://x/").searchParams.get("prueba");
  expect(id, "saved prueba id in link").toBeTruthy();
  return id ?? "";
}

// R01: ?prueba= selects once; a later click owns the selection and the export.
test("R01 deep link selects initially but a later click wins and exports", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("discount-input").fill("10");
  await expect(page.getByTestId("price-net")).toContainText("106.502,40");
  const idA = await saveNamed(page, "R01 primera");

  await page.getByTestId("discount-input").fill("15");
  await expect(page.getByTestId("price-net")).toContainText("100.585,60");
  const idB = await saveNamed(page, "R01 segunda");
  expect(idB).not.toBe(idA);

  await page.getByRole("link", { name: "Verla en el informe" }).click();
  await expect(page.getByRole("button", { name: /Abrir prueba R01 segunda/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await page.getByRole("button", { name: /Abrir prueba R01 primera/ }).click();
  await expect(page.getByRole("button", { name: /Abrir prueba R01 primera/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(new URL(page.url()).searchParams.get("prueba"), "deep link consumed").toBeNull();

  let exportedId: string | null = null;
  await page.route("**/api/v1/reports", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      exportedId = request.postDataJSON()?.scenario_id ?? null;
    }
    await route.continue();
  });
  await page.getByRole("radio", { name: "Preparar oferta" }).check();
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  expect(exportedId, "exported scenario follows the click").toBe(idA);

  await page.reload();
  await expect(page.getByRole("button", { name: /Abrir prueba R01 primera/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(guard.blocked()).toBe(0);
});

// R02: an older cost draft never overwrites a newer revision without confirm.
test("R02 stale cost draft shows the conflict and confirms explicitly", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("cost-toggle").click();
  await page.getByTestId("cost-direct").fill("95000,00");

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem("bidlab.session.v1") ?? "{}"));
  const companyId = session.company_id as string;
  expect(companyId).toBeTruthy();
  const headers = { "X-BidLab-Client": "local-ui", "Idempotency-Key": `r02-${Date.now()}` };
  const before = await page.request.get(`${API_BASE}/companies/${companyId}`, { headers });
  expect(before.ok()).toBe(true);
  const current = await before.json();
  // "Elsewhere" saves rev N+1 while our draft still points at N.
  const bump = await page.request.put(`${API_BASE}/companies/${companyId}`, {
    headers,
    data: {
      expected_revision: current.revision,
      name: current.name,
      synthetic: false,
      scope_id: current.scope_id,
      period_months: current.period_months,
      direct_cost_net: "88000.00",
      overhead_net: current.overhead_net,
      target_margin_rate: current.target_margin_rate,
      evidence: current.evidence,
    },
  });
  expect(bump.ok()).toBe(true);

  await page.reload();
  await openPricing(page);
  await page.getByTestId("cost-toggle").click();
  await expect(page.getByText("Tus datos cambiaron en otro lugar.")).toBeVisible();
  await expect(page.getByText(/Costes directos: ahora 88000,00/)).toBeVisible();
  await expect(page.getByTestId("cost-direct")).toHaveValue("95000,00");

  await page.getByRole("button", { name: "Guardar de todas formas" }).click();
  await expect(page.getByText("Ya guardamos tus costes.")).toBeVisible();
  await expect(page.getByText("Tus datos cambiaron en otro lugar.")).toBeHidden();

  const after = await page.request.get(`${API_BASE}/companies/${companyId}`, { headers });
  const saved = await after.json();
  expect(saved.revision).toBe(current.revision + 2);
  expect(saved.direct_cost_net).toBe("95000.00");

  await restorePristineCompany(page.request);
  expect(guard.blocked()).toBe(0);
});

// R03: a freshly saved prueba appears in Informe without reloading.
test("R03 saved prueba shows in Informe without reload", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openTab(page, "Informe");
  // Storage is tender-scoped per run, so other specs' copies may already
  // list here; what matters is that this run's list was fetched (cached).
  await expect(page.getByRole("heading", { name: /Paso 1/ })).toBeVisible();
  await expect(page.getByText("Cargando tus pruebas guardadas…")).toBeHidden();
  await expect(page.getByRole("button", { name: /Abrir prueba R03 fresca/ })).toHaveCount(0);

  await openTab(page, "Precio");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  await saveNamed(page, "R03 fresca");

  await openTab(page, "Informe");
  await expect(page.getByRole("button", { name: /Abrir prueba R03 fresca/ })).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

// R04: quota failures warn visibly, keep memory, and clear on retry.
test("R04 quota failure warns once and clears when storage returns", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { __r04fail: boolean }).__r04fail = true;
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key === "bidlab.drafts.v2" && (window as unknown as { __r04fail: boolean }).__r04fail) {
        const err = new Error("full");
        err.name = "QuotaExceededError";
        throw err;
      }
      original.call(this, key, value);
    };
  });
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("discount-input").fill("12");
  const banner = page.getByTestId("draft-durable-error");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("no recargues");
  expect(await banner.count(), "single stable banner, no loop").toBe(1);
  // Memory editing keeps working while persistence fails.
  await expect(page.getByTestId("discount-readout")).toContainText("12");

  await page.evaluate(() => {
    (window as unknown as { __r04fail: boolean }).__r04fail = false;
  });
  await page.getByRole("button", { name: "Reintentar guardado" }).click();
  await expect(banner).toBeHidden();
  expect(guard.blocked()).toBe(0);
});
