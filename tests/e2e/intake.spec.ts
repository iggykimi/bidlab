import { expect, test, type Page } from "@playwright/test";
import { installOfflineGuard, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test. The browser also logs
// a resource line for the intentionally rejected upload (415); that fetch
// is handled and asserted, so only that exact line is exempt here.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  const unexpected = failures.consoleErrors.filter(
    (m) => !(m.startsWith("Failed to load resource") && m.includes("415"))
  );
  expect(unexpected, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

function uniqueTag(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/** Fill step 1 and land on step 2 ("Añadir documento"). */
async function createTenderToStep2(page: Page, title: string, externalId: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("nueva-licitacion").click();
  await expect(page.getByRole("heading", { name: "¿Qué licitación quieres dar de alta?" })).toBeVisible();
  await page.getByTestId("intake-title").fill(title);
  await page.getByTestId("intake-external-id").fill(externalId);
  await page.getByTestId("intake-body").fill("Ayuntamiento de Prueba");
  await page.getByTestId("intake-submit").click();
  await expect(page.getByRole("heading", { name: "¿Quieres añadir el pliego en PDF?" })).toBeVisible();
}

// Intake: manual tender without a document shows in the library and opens.
test("manual tender without document appears in the library and opens", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  const title = `Limpieza manual ${tag}`;
  const externalId = `E2E/${tag}`;

  await createTenderToStep2(page, title, externalId);
  await page.getByTestId("intake-skip").click();
  await page.getByTestId("intake-skip-company").click();
  await expect(page.getByTestId("tender-title")).toContainText(title);

  await page.goto("/");
  await page.getByPlaceholder("Tías, 79411000…").fill(externalId);
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

// Intake UX (NN/g + Baymard): blur validates an engaged field without
// submitting, and untouched empty fields stay quiet.
test("blur validates an engaged field and spares untouched ones", async ({ page }) => {
  await installOfflineGuard(page);
  await page.goto("/");
  await page.getByTestId("nueva-licitacion").click();
  await expect(page.getByRole("heading", { name: "¿Qué licitación quieres dar de alta?" })).toBeVisible();

  await page.getByTestId("intake-source-url").fill("notaurl");
  await page.getByTestId("intake-source-url").press("Tab");
  await expect(page.getByText("empiece por https://")).toBeVisible();
  await expect(page.getByText("Escribe el título de la licitación.")).toBeHidden();
});

// Intake UX (NN/g + WCAG 3.3.1): an invalid submit focuses the first error.
test("invalid submit focuses the first field error", async ({ page }) => {
  await installOfflineGuard(page);
  await page.goto("/");
  await page.getByTestId("nueva-licitacion").click();
  await expect(page.getByRole("heading", { name: "¿Qué licitación quieres dar de alta?" })).toBeVisible();

  await page.getByTestId("intake-submit").click();
  await expect(page.getByTestId("intake-title")).toBeFocused();
  await expect(page.getByText("Escribe el título de la licitación.")).toBeVisible();
});

// Intake: non-PDF upload shows an explicit error and keeps the tender intact.
test("non-PDF upload shows an explicit error and keeps the tender", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  const title = `Pliego con error ${tag}`;
  const externalId = `ERR/${tag}`;

  await createTenderToStep2(page, title, externalId);

  // Client precheck: a .txt file never reaches the server.
  await page.getByTestId("intake-file").setInputFiles({
    name: "nota.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hola, no soy un pdf"),
  });
  await expect(page.getByTestId("intake-file-state")).toHaveText("error");
  await expect(page.getByText("Ese archivo no parece un PDF.")).toBeVisible();

  // Server check: .pdf name with text bytes is rejected by magic bytes.
  await page.getByTestId("intake-file").setInputFiles({
    name: "falso.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("hola, sigo sin ser un pdf"),
  });
  await expect(page.getByTestId("intake-file-state")).toHaveText("recibido");
  await page.getByTestId("intake-upload").click();
  await expect(page.getByTestId("intake-file-state")).toHaveText("error");
  await expect(page.getByText("Ese archivo no es un PDF válido.")).toBeVisible();

  // The tender survives the failed upload and opens normally.
  await page.getByTestId("intake-skip").click();
  await page.getByTestId("intake-skip-company").click();
  await expect(page.getByTestId("tender-title")).toContainText(title);
  expect(guard.blocked()).toBe(0);
});
