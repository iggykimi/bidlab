import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// E01: cargar ejemplo -> título Tías, badge Demo curada, presupuesto neto, 0 llamadas externas.
test("E01 demo load shows Tías with Demo badge and stays offline", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await page.goto("/");
  await page.getByTestId("demo-load").click();
  await expect(page.getByTestId("tender-title")).toContainText("Tías");
  await expect(page.getByTestId("demo-badge")).toContainText("Demo curada");
  await expect(page.locator("main")).toContainText("118.336");
  await expect(page.getByRole("link", { name: /Ver publicación/ })).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

// E02: abrir requisito técnico -> por verificar; drawer en página 6 de 41 con la cita.
test("E02 technical requirement is unknown with page 6 of 41 evidence", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await page.getByRole("tab", { name: "Requisitos" }).click();
  const row = page.getByTestId("requirement-tech-services");
  await expect(row).toContainText("Por verificar");
  await row.getByRole("button", { name: /página 6/ }).click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await expect(page.getByTestId("evidence-page")).toContainText("Página 6 de 41");
  await expect(page.getByTestId("evidence-quote")).toContainText("207.088");
  expect(guard.blocked()).toBe(0);
});

// E09: sin clave, intentar live -> mensaje accionable, sin éxito simulado ni spinner infinito.
test("E09 live attempt without key shows an actionable message", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  let analysisCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("/analysis")) analysisCalls += 1;
  });
  await loadDemo(page);
  await expect(page.getByTestId("live-attempt")).toBeVisible();
  await page.getByTestId("live-attempt").click();
  const message = page.getByTestId("live-message");
  await expect(message).toContainText("no está configurado");
  await expect(message).not.toContainText(/completado/i);
  await expect(page.getByTestId("live-attempt")).toBeEnabled();
  expect(analysisCalls).toBe(0);
  expect(guard.blocked()).toBe(0);
});
