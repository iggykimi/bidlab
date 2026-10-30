import { expect, test, type Page } from "@playwright/test";
import { installOfflineGuard, openTab, takeConsoleFailures } from "./helpers";

// T20: the incoherence radar on Revisar. No persisted observations exist
// yet, so real pairs are honestly empty; the labeled synthetic example
// still proves the happy path (both evidences plus the neutral question).
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

function uniqueTag(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/** Own tender without document or company; lands on the workspace. */
async function createBareTender(page: Page, title: string, externalId: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("nueva-licitacion").click();
  await expect(page.getByRole("heading", { name: "¿Qué licitación quieres dar de alta?" })).toBeVisible();
  await page.getByTestId("intake-manual").click();
  await page.getByTestId("intake-title").fill(title);
  await page.getByTestId("intake-external-id").fill(externalId);
  await page.getByTestId("intake-body").fill("Ayuntamiento de Prueba");
  await page.getByTestId("intake-submit").click();
  await expect(page.getByRole("heading", { name: "¿Quieres añadir el pliego en PDF?" })).toBeVisible();
  await page.getByTestId("intake-skip").click();
  await page.getByTestId("intake-skip-company").click();
  await expect(page.getByTestId("tender-title")).toContainText(title);
}

test("radar shows no comparable pairs and a labeled synthetic example", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await createBareTender(page, `Radar propio ${tag}`, `RADAR/${tag}`);

  await openTab(page, "Revisar");
  await expect(page.getByTestId("radar-empty")).toContainText("Sin pares comparables");

  await expect(page.getByTestId("radar-synthetic-badge")).toContainText("Ejemplo sintético");
  const card = page.getByTestId("radar-synthetic");
  await expect(card).toContainText("Duración en meses");
  await expect(card).toContainText("Página 2");
  await expect(card).toContainText("Página 3");
  await expect(card).toContainText("¿Ambos documentos hablan de la misma prestación inicial?");
  await expect(page.getByText("no salen de tus documentos")).toBeVisible();
  expect(guard.blocked()).toBe(0);
});
