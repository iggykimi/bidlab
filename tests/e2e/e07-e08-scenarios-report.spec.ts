import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, openTab, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// E07: guardar, recargar, abrir -> mismos valores/hashes; revisión de empresa intacta.
test("E07 saved scenario survives reload with identical values", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await page.getByTestId("scenario-name").fill("E07 base");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByRole("link", { name: "Verla en el informe" })).toBeVisible();
  await page.getByRole("link", { name: "Verla en el informe" }).click();
  await expect(page.getByTestId("scenario-detail")).toContainText("112.419,20");
  const hash = await page.getByTestId("scenario-hash").textContent();
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  // La revisión congelada sobrevive a recargar (sin fijar el número: otros
  // specs, como el editor de costes, mueven la revisión de la empresa).
  const before = await page.getByTestId("scenario-detail").textContent();
  const frozenRev = /empresa rev\. \d+/.exec(before ?? "")?.[0];
  expect(frozenRev).toBeTruthy();

  await page.reload();
  await expect(page.getByTestId("tender-title")).toContainText("Tías");
  await openTab(page, "Informe");
  // La lista es global del expediente: elegir por nombre, no por posición.
  await page.getByRole("button", { name: /Abrir escenario E07 base/ }).click();
  await expect(page.getByTestId("scenario-hash")).toHaveText(hash ?? "");
  await expect(page.getByTestId("scenario-detail")).toContainText("112.419,20");
  await expect(page.getByTestId("scenario-detail")).toContainText(frozenRev ?? "");
  expect(guard.blocked()).toBe(0);
});

// E08: exportar HTML y descargar -> reglas, snapshot, sintéticas, pendientes; sin secretos.
test("E08 report export downloads HTML with sources and no secrets", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);
  await page.getByTestId("scenario-name").fill("E08 base");
  await page.getByTestId("save-scenario").click();
  await page.getByRole("link", { name: "Verla en el informe" }).click();

  await page.getByRole("radio", { name: "Preparar oferta" }).check();
  await page.getByTestId("report-note-input").fill("Margen OK <b>esc</b>");
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  await expect(page.getByTestId("report-decision")).toContainText("Preparar oferta");
  const hash = (await page.getByTestId("scenario-hash").last().textContent()) ?? "";

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-report").click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import("node:fs");
  const html = fs.readFileSync(path as string, "utf-8");
  expect(html).toContain("proportional_inverse");
  expect(html).toContain("tias-18-5");
  expect(html).toContain(hash);
  expect(html).toContain("sintética");
  expect(html).toContain("Pendientes");
  expect(html).toContain("Demo curada");
  expect(html).toContain("&lt;b&gt;esc&lt;/b&gt;");
  expect(html).not.toContain("<b>esc</b>");
  expect(html).not.toContain("<script");
  expect(html).not.toMatch(/MODEL_API_KEY|model_api_key|Bearer [A-Za-z0-9]/);
  expect(guard.blocked()).toBe(0);
});
