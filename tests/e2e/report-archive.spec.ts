import { expect, test, type Page } from "@playwright/test";
import { API_BASE, installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// Archived report vs draft vs print: the decision is never pre-filled, the
// archived snapshot carries its revisions on screen, HTML and print, and
// editing the draft never touches the archive.
// C10: any console.error / pageerror fails the test. Chromium logs one exact
// line for every srcdoc+sandbox preview iframe even with zero scripts in it
// (verified with a scriptless <p> probe); the sandbox stays because the
// preview renders server HTML carrying user note text. Only that exact
// browser-noise line is exempt here.
const SANDBOX_SRCDOC_NOISE =
  "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed";
test.afterEach(() => {
  const failures = takeConsoleFailures();
  const unexpected = failures.consoleErrors.filter((m) => !m.startsWith(SANDBOX_SRCDOC_NOISE));
  expect(unexpected, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

function uniqueTag(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function saveNamed(page: Page, discount: string, name: string, price: string): Promise<void> {
  await page.getByTestId("discount-input").fill(discount);
  await expect(page.getByTestId("price-net")).toContainText(price);
  await page.getByTestId("scenario-name").fill(name);
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText(`Prueba «${name}» guardada.`)).toBeVisible();
}

// The decision draft starts undecided; export requires an explicit choice.
test("archive decision is never pre-filled", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await loadDemo(page);
  await openPricing(page);
  await saveNamed(page, "10", `Archivo A ${tag}`, "106.502,40");
  await page.getByRole("link", { name: "Verla en el informe" }).click();

  await expect(page.getByTestId("report-draft-state")).toContainText("Borrador (sin archivar)");
  await expect(page.getByRole("radio", { name: "Seguir estudiándola" })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "Preparar oferta" })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "Descartarla" })).not.toBeChecked();
  await page.getByTestId("export-report").click();
  await expect(page.getByText("Elige qué has decidido antes de crear el informe.")).toBeVisible();
  await expect(page.getByTestId("report-detail")).toHaveCount(0);

  await page.getByRole("radio", { name: "Seguir estudiándola" }).check();
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  await expect(page.getByTestId("report-decision")).toContainText("Seguir estudiándola");
  expect(guard.blocked()).toBe(0);
});

test("report preview closes without fetching the HTML again", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await saveNamed(page, "10", `Vista previa ${uniqueTag()}`, "106.502,40");
  await page.getByRole("link", { name: "Verla en el informe" }).click();
  await page.getByRole("radio", { name: "Seguir estudiándola" }).check();
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  let fetches = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && /\/reports\/[^/]+\/html$/.test(new URL(request.url()).pathname)) {
      fetches += 1;
    }
  });
  await page.getByRole("button", { name: "Vista previa del informe", exact: true }).click();
  await expect(page.locator('iframe[title="Vista previa del informe"]')).toBeVisible();
  expect(fetches).toBe(1);
  await page.getByRole("button", { name: "Ocultar vista previa", exact: true }).click();
  await expect(page.locator('iframe[title="Vista previa del informe"]')).toHaveCount(0);
  expect(fetches).toBe(1);
  expect(guard.blocked()).toBe(0);
});

// Screen, downloaded HTML and print describe the same archived snapshot.
test("archive screen, HTML and print match", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await loadDemo(page);
  await openPricing(page);
  await saveNamed(page, "10", `Archivo B ${tag}`, "106.502,40");
  await page.getByRole("link", { name: "Verla en el informe" }).click();

  let reportId: string | null = null;
  await page.route("**/api/v1/reports", async (route) => {
    const response = await route.fetch();
    if (route.request().method() === "POST") {
      reportId = (await response.json()).id as string;
    }
    await route.fulfill({ response });
  });
  await page.getByRole("radio", { name: "Preparar oferta" }).check();
  await page.getByTestId("report-note-input").fill("Nota de archivo.");
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  expect(reportId, "created report id").toBeTruthy();

  const archive = page.getByTestId("report-archive");
  await expect(archive).toContainText("Archivado el");
  await expect(archive).toContainText("tias-price-r1 rev. 1");
  await expect(archive).toContainText(/Empresa rev\. \d+/);
  await expect(archive).toContainText("Copia");
  // Company revisions accumulate across specs sharing one run storage, so
  // the test pins consistency (same revision on screen, HTML and print),
  // not an absolute number.
  const screenText = await archive.textContent();
  const companyRev = screenText?.match(/Empresa rev\. (\d+)/)?.[1];
  expect(companyRev, "company revision on screen").toBeTruthy();

  const html = await page.request.get(`${API_BASE}/reports/${reportId}/html`);
  expect(html.ok()).toBe(true);
  const body = await html.text();
  for (const needle of [
    "106.502,40",
    "Preparar oferta",
    "Nota de archivo.",
    "Archivado el",
    "tias-price-r1 rev. 1",
    `Empresa rev. ${companyRev}`,
  ]) {
    expect(body, `html contains ${needle}`).toContain(needle);
  }

  await page.emulateMedia({ media: "print" });
  await expect(page.locator('section[aria-label="Nuevo informe"]')).toBeHidden();
  await expect(page.locator('section[aria-label="Escenarios guardados"]')).toBeHidden();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  await expect(page.getByTestId("report-note")).toContainText("Nota de archivo.");
  await expect(page.getByTestId("report-archive")).toContainText("tias-price-r1 rev. 1");
  await page.emulateMedia({ media: "screen" });
  expect(guard.blocked()).toBe(0);
});

// Editing the draft after archiving never touches the archived report.
test("archive draft edits leave the archive frozen", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await loadDemo(page);
  await openPricing(page);
  await saveNamed(page, "10", `Archivo C ${tag}`, "106.502,40");
  await page.getByRole("link", { name: "Verla en el informe" }).click();

  await page.getByRole("radio", { name: "Preparar oferta" }).check();
  await page.getByTestId("report-note-input").fill("Primera nota.");
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();

  await page.getByRole("radio", { name: "Descartarla" }).check();
  await page.getByTestId("report-note-input").fill("Segunda nota, solo borrador.");
  await expect(page.getByTestId("report-decision")).toContainText("Preparar oferta");
  await expect(page.getByTestId("report-note")).toContainText("Primera nota.");
  await expect(page.getByTestId("report-note")).not.toContainText("Segunda nota");
  expect(guard.blocked()).toBe(0);
});

// Precio links the compare tray to the Informe decision.
test("archive compare tray links to Informe", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await loadDemo(page);
  await openPricing(page);
  await saveNamed(page, "10", `Archivo D ${tag}`, "106.502,40");

  const link = page.getByRole("link", { name: "Lleva una prueba al informe para decidir" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/tab=informe/);
  await expect(page.getByRole("button", { name: /Abrir prueba Archivo D/ })).toBeVisible();
  expect(guard.blocked()).toBe(0);
});
