import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loadDemo } from "../../tests/e2e/helpers";

// V2 evidence shots (§22.5.5): trace bar, curve, citations, stress map and
// compare+frontier on the real build. Fresh storage per run, settled UI.
const OUT = path.resolve(__dirname, "..", "..", "docs", "v2-shots");

async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole("tab", { name }).click();
}

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

test.describe("v2 desktop 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("capture v2 desktop surfaces", async ({ page }) => {
    test.setTimeout(180_000);
    await loadDemo(page);
    await expect(page.getByTestId("decision-trace")).toBeVisible();
    await shot(page, "v2-1440-resumen-trace.png");

    await openTab(page, "Precio");
    await saveNamed(page, "10", "V2 diez", "106.502,40");
    await page.getByTestId("curve-chart").scrollIntoViewIfNeeded();
    await shot(page, "v2-1440-curva.png");

    const section = page.getByTestId("stress-section");
    await section.scrollIntoViewIfNeeded();
    await section.getByLabel("Rebaja inicial en tanto por ciento").fill("5");
    await section.getByLabel("Rebaja final en tanto por ciento").fill("15");
    await section.getByLabel("Paso de la malla en tanto por ciento").fill("5");
    await section.getByLabel("Tu coste sin impuestos en € (coma o punto)").fill("80000,00");
    await section.getByLabel("Periodo en meses").fill("24");
    await section.getByLabel("Rival A · precio sin impuestos en €").fill("110000,00");
    await section.getByLabel("Rival B · precio sin impuestos en €").fill("115000,00");
    await section.getByLabel("Tomar estos como todos los rivales").check();
    await section.getByLabel("Cada rival es de una empresa distinta").check();
    await section.getByLabel("Puntos por precio mínimos").fill("40");
    await section.getByLabel("Beneficio mínimo en € (coma o punto)").fill("1000");
    await section.getByTestId("stress-run").click();
    await expect(section.getByTestId("stress-heatmap")).toBeVisible({ timeout: 60_000 });
    await section.getByTestId("stress-heatmap").scrollIntoViewIfNeeded();
    await shot(page, "v2-1440-stress.png");

    await saveNamed(page, "15", "V2 quince", "100.585,60");
    await openTab(page, "Informe");
    await page.getByRole("checkbox", { name: "Comparar V2 diez" }).check();
    await page.getByRole("checkbox", { name: "Comparar V2 quince" }).check();
    await page.getByTestId("compare-run").click();
    await expect(page.getByTestId("compare-result")).toContainText("comparten contexto");
    await page.getByTestId("compare-result").scrollIntoViewIfNeeded();
    await shot(page, "v2-1440-informe.png");

    await openTab(page, "Citas");
    await expect(page.getByTestId("coverage-card")).toBeVisible();
    await shot(page, "v2-1440-citas.png");
  });
});

test.describe("v2 tablet 768x1024", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("capture v2 tablet resumen", async ({ page }) => {
    await loadDemo(page);
    await expect(page.getByTestId("decision-trace")).toBeVisible();
    await shot(page, "v2-768-resumen-trace.png");
  });
});

test.describe("v2 mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("capture v2 mobile surfaces", async ({ page }) => {
    await loadDemo(page);
    await expect(page.getByTestId("decision-trace")).toBeVisible();
    await shot(page, "v2-390-resumen-trace.png");
    await openTab(page, "Citas");
    await expect(page.getByTestId("coverage-card")).toBeVisible();
    await shot(page, "v2-390-citas-coverage.png");
  });
});
