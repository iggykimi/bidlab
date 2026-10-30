import { expect, test, type Page } from "@playwright/test";
import { API_BASE, installOfflineGuard, loadDemo, takeConsoleFailures } from "./helpers";

// P0 context guards: crossed sessions never price, period mismatches fail
// loudly, the scoring reference is confirmed on screen, and the review
// draft tracks its base revision.
// C10: any console.error / pageerror fails the test. The 422 below is
// injected on purpose (period guard path) and asserted, so only that
// exact resource line is exempt here.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  const unexpected = failures.consoleErrors.filter(
    (m) => !(m.startsWith("Failed to load resource") && m.includes("422"))
  );
  expect(unexpected, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

function uniqueTag(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function createTenderToStep2(
  page: Page,
  title: string,
  externalId: string,
  pblNet: string,
  period: string
): Promise<void> {
  await page.goto("/");
  await page.getByTestId("nueva-licitacion").click();
  await expect(page.getByRole("heading", { name: "¿Qué licitación quieres dar de alta?" })).toBeVisible();
  await page.getByTestId("intake-manual").click();
  await page.getByTestId("intake-title").fill(title);
  await page.getByTestId("intake-external-id").fill(externalId);
  await page.getByTestId("intake-body").fill("Ayuntamiento de Prueba");
  await page.getByTestId("intake-pbl-net").fill(pblNet);
  await page.getByTestId("intake-period").fill(period);
  await page.getByTestId("intake-submit").click();
  await expect(page.getByRole("heading", { name: "¿Quieres añadir el pliego en PDF?" })).toBeVisible();
}

async function createCompany(page: Page, name: string, direct: string, period: string): Promise<void> {
  await page.getByTestId("company-create-name").fill(name);
  await page.getByTestId("company-create-direct").fill(direct);
  await page.getByTestId("company-create-period").fill(period);
  await page.getByTestId("company-create-submit").click();
}

async function fillReview(
  page: Page,
  opts: { template?: string; maxPoints?: string; anomaly?: string; reason?: string } = {}
): Promise<void> {
  await page.getByTestId(`review-template-${opts.template ?? "proportional_inverse"}`).check();
  await page.getByTestId("review-maxpoints").fill(opts.maxPoints ?? "49");
  await page.getByTestId(`review-anomaly-${opts.anomaly ?? "rglcap85_standard"}`).check();
  await page.getByTestId("review-reason").fill(opts.reason ?? "Reviso mi pliego a mano.");
}

// P0-1: a demo session opened on an own tender blocks before any number,
// and never fires an evaluation across contexts.
test("P0-1 crossed session blocks pricing without evaluating", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  const tag = uniqueTag();
  const created = await page.request.post(`${API_BASE}/tenders`, {
    headers: { "Content-Type": "application/json", "X-BidLab-Client": "local-ui", "Idempotency-Key": `p01-${tag}` },
    data: {
      title: `Cruce ${tag}`,
      external_id: `CRZ/${tag}`,
      contracting_body: "Ayuntamiento de Prueba",
      source_url: null,
      scope_label: null,
      basis: { pbl_net: "60000.00", pbl_gross: null, tax_kind: "VAT", period_months: 12, currency: "EUR" },
    },
  });
  expect(created.ok()).toBe(true);
  const tenderId = (await created.json()).id as string;

  let evaluateCalls = 0;
  await page.route("**/api/v1/scenarios/evaluate", async (route) => {
    evaluateCalls += 1;
    await route.continue();
  });
  await page.goto(`/tenders/${tenderId}?tab=precio`);
  await expect(page.getByText("Tu sesión apunta a otra licitación.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a la biblioteca" })).toBeVisible();
  await expect(page.getByTestId("price-net")).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(evaluateCalls, "no crossed evaluation fired").toBe(0);
  expect(guard.blocked()).toBe(0);
});

// P0-2: a 12-month cost on a 24-month scope fails with a plain message.
test("P0-2 cost period mismatch shows a plain error, not figures", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await createTenderToStep2(page, `Periodo ${tag}`, `PER/${tag}`, "80000", "24");
  await page.getByTestId("intake-skip").click();
  await createCompany(page, "Empresa doce", "50000", "12");
  await expect(page.getByRole("heading", { name: "¿Pides propuestas automáticas?" })).toBeVisible();

  await fillReview(page);
  await page.getByTestId("review-submit").click();
  await expect(page.getByTestId("review-success")).toBeVisible();
  await page.getByTestId("review-go-pricing").click();

  await expect(page.getByText("El coste cubre unos meses distintos de los del contrato.")).toBeVisible();
  await expect(page.getByTestId("price-net")).toContainText("—");
  expect(guard.blocked()).toBe(0);
});

// P0-3: a custom scoring reference flows to the basis and the score.
// linear: 49*(110000-95000)/(110000-92000) = 40,8333 -> "40,8 de 49".
test("P0-3 custom scoring reference is confirmed and used", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await createTenderToStep2(page, `Referencia ${tag}`, `REF/${tag}`, "100000", "12");
  await page.getByTestId("intake-skip").click();
  await createCompany(page, "Empresa ref", "60000", "12");
  await expect(page.getByRole("heading", { name: "¿Pides propuestas automáticas?" })).toBeVisible();

  await page.getByTestId("review-reference-custom").check();
  await page.getByTestId("review-reference-net").fill("110000");
  await fillReview(page, { template: "linear_discount", anomaly: "unsupported" });
  await page.getByTestId("review-submit").click();
  await expect(page.getByTestId("review-success")).toBeVisible();

  const tenderId = page.url().match(/\/tenders\/([^?]+)/)?.[1];
  expect(tenderId, "tender id in url").toBeTruthy();
  const workspace = await page.request.get(`${API_BASE}/tenders/${tenderId}/workspace`);
  expect(workspace.ok()).toBe(true);
  const basis = (await workspace.json()).tender.scopes[0].basis;
  expect(basis.scoring_reference_net).toBe("110000.00");
  expect(basis.reference_kind).toBe("custom");

  await page.getByTestId("review-go-pricing").click();
  await page.getByTestId("discount-input").fill("5");
  await page.getByTestId("rival-a-price").fill("92000");
  await page.getByTestId("rival-b-price").fill("98000");
  await expect(page.getByTestId("economic-score")).toContainText("40,8 de 49");
  expect(guard.blocked()).toBe(0);
});

// P0-4: the review draft tracks its base revision across reloads and
// approvals elsewhere; rebase keeps every word.
test("P0-4 review draft warns on a moved base and rebases", async ({ page, browser }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  const title = `Base ${tag}`;
  await createTenderToStep2(page, title, `BAS/${tag}`, "70000", "12");
  await page.getByTestId("intake-skip").click();
  await createCompany(page, "Empresa base", "40000", "12");
  await expect(page.getByTestId("review-budget")).toHaveValue(/70000/);
  await expect(page.getByTestId("review-stale-base")).toHaveCount(0);
  await page.getByTestId("review-reason").fill("Mi motivo sobrevive.");
  const tenderUrl = page.url();

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await installOfflineGuard(page2);
  await page2.goto(tenderUrl);
  await page2.getByTestId("review-budget").fill("70000");
  await page2.getByTestId("review-template-proportional_inverse").check();
  await page2.getByTestId("review-maxpoints").fill("40");
  await page2.getByTestId("review-anomaly-rglcap85_standard").check();
  await page2.getByTestId("review-reason").fill("Aprobada en otro lado.");
  await page2.getByTestId("review-submit").click();
  await expect(page2.getByTestId("review-success")).toContainText("Ya guardamos tu revisión 1.");
  await ctx2.close();

  await page.reload();
  await expect(page.getByTestId("review-stale-base")).toContainText("(base 0)");
  await expect(page.getByTestId("review-reason")).toHaveValue("Mi motivo sobrevive.");
  await page.getByTestId("review-rebase").click();
  await expect(page.getByTestId("review-stale-base")).toHaveCount(0);
  await page.getByTestId("review-template-proportional_inverse").check();
  await page.getByTestId("review-maxpoints").fill("40");
  await page.getByTestId("review-anomaly-rglcap85_standard").check();
  await page.getByTestId("review-submit").click();
  await expect(page.getByTestId("review-success")).toContainText("Ya guardamos tu revisión 2.");
  expect(guard.blocked()).toBe(0);
});
