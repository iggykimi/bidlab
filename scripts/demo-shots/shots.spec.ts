import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loadDemo } from "../../tests/e2e/helpers";

// Presentation shots for docs/demo (R07). Separate base from the E2E
// suite: fresh storage, readable scenario names, settled UI, no test
// payloads. Run explicitly; never part of the gates.
const OUT = path.resolve(__dirname, "..", "..", "docs", "demo");

async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole("tab", { name }).click();
}

/** Fonts + network + transitions + toasts settled before every capture. */
async function settled(page: Page): Promise<void> {
  await expect(page.getByTestId("tender-title")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForLoadState("networkidle");
  await page.mouse.move(20, 20);
  await page
    .locator("li[data-sonner-toast]")
    .first()
    .waitFor({ state: "detached", timeout: 8000 });
  await page.waitForTimeout(600);
}

async function shot(page: Page, file: string): Promise<void> {
  await settled(page);
  await page.screenshot({ path: path.join(OUT, file), animations: "disabled" });
}

async function saveNamed(page: Page, discount: string, name: string, price: string): Promise<void> {
  await page.getByTestId("discount-input").fill(discount);
  await expect(page.getByTestId("price-net")).toContainText(price);
  await page.getByTestId("scenario-name").fill(name);
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText(`Prueba «${name}» guardada.`)).toBeVisible();
}

test("capture 01-07 desktop presentation shots", async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByTestId("tender-title")).toContainText("Tías");
  await shot(page, "01-resumen.png");

  await openTab(page, "Precio");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  await shot(page, "02-precio.png");

  await page.getByTestId("curve-chart").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("curve-chart")).toBeVisible();
  await shot(page, "03-curva.png");

  await openTab(page, "Citas");
  await expect(page.locator("section[aria-label='Documentos']")).toBeVisible();
  await page
    .getByRole("heading", { name: "Dónde lo dice el pliego" })
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot(page, "04-citas.png");

  await openTab(page, "Requisitos");
  await expect(page.getByTestId("requirement-tech-services")).toContainText("Por verificar");
  await shot(page, "05-requisitos.png");

  // Gold case with readable names: 10 % and 15 % both reach 49 points,
  // but 10 % keeps 5.916,80 € more profit under these assumptions.
  await openTab(page, "Precio");
  await saveNamed(page, "10", "Rebaja 10 %", "106.502,40");
  await saveNamed(page, "15", "Rebaja 15 %", "100.585,60");
  await page.getByRole("link", { name: "Verla en el informe" }).click();
  await page.getByRole("button", { name: /Abrir prueba Rebaja 10 %/ }).click();
  await page.getByRole("radio", { name: "Preparar oferta" }).check();
  await page.getByTestId("report-note-input").fill("Preparo la oferta si el margen aguanta.");
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  await expect(page.getByTestId("report-decision")).toContainText("Preparar oferta");
  await page
    .getByTestId("report-detail")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot(page, "06-informe.png");

  await openTab(page, "Precio");
  await expect(page.getByTestId("price-net")).toContainText("100.585,60");
  const opener = page
    .locator("section[aria-label='Indicadores']")
    .getByRole("button", { name: /p\. 10: ver cita/ })
    .first();
  await opener.click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar" })).toBeFocused();
  await shot(page, "07-evidencia-drawer.png");
});

test.describe("mobile shot", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("capture 08 movil presentation shot", async ({ page }) => {
    await loadDemo(page);
    await openTab(page, "Precio");
    await expect(page.getByTestId("price-net")).toContainText("112.419,20");
    await shot(page, "08-movil.png");
  });
});
