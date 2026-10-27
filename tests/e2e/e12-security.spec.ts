import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, openTab, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// E12: HTML hostil en nombre/nota y documento sin bytes -> sin ejecución, error controlado.
test("E12 hostile HTML is inert and missing bytes fail softly", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("scenario-name").fill('<img src=x onerror="window.__e12pwned=1">');
  await page.getByTestId("save-scenario").click();
  await page.getByRole("link", { name: "Verla en el informe" }).click();
  await expect(page.getByTestId("scenario-detail")).toContainText('<img src=x onerror="window.__e12pwned=1">');
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__e12pwned)).toBeUndefined();

  await page.getByTestId("report-note-input").fill("<script>window.__e12pwned2=1</script>");
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-note")).toContainText("<script>window.__e12pwned2=1</script>");
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__e12pwned2)).toBeUndefined();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-report").click();
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import("node:fs");
  const html = fs.readFileSync(path as string, "utf-8");
  expect(html).not.toContain("<script");
  expect(html).toContain("&lt;script&gt;");

  await openTab(page, "Requisitos");
  await page.getByTestId("requirement-tech-services").getByRole("button", { name: /Ver página 6 en el pliego/ }).click();
  await expect(page.getByTestId("evidence-drawer")).toContainText(
    "No puedes descargar el PDF original desde aquí. Consúltalo en la web oficial o usa el texto de esta página."
  );
  await expect(page.getByRole("link", { name: /Ver fuente oficial/ }).first()).toBeVisible();
  expect(guard.blocked()).toBe(0);
});
