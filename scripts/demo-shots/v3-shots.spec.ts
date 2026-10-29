import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loadDemo } from "../../tests/e2e/helpers";

// V3 evidence matrix (§8): 8 scenes x 5 widths on the real build with the
// seeded demo. Fresh storage per run, settled UI, viewport-unique scenario
// names. Run explicitly; never part of the gates.
const OUT = path.resolve(__dirname, "..", "..", "docs", "demo", "v3");

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

async function shot(page: Page, width: number, file: string): Promise<void> {
  await settled(page);
  await page.screenshot({ path: path.join(OUT, String(width), file), animations: "disabled" });
}

async function saveNamed(page: Page, discount: string, name: string, price: string): Promise<void> {
  await page.getByTestId("discount-input").fill(discount);
  await expect(page.getByTestId("price-net")).toContainText(price);
  await page.getByTestId("scenario-name").fill(name);
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText(`Prueba «${name}» guardada.`)).toBeVisible();
}

async function fillStress(page: Page): Promise<void> {
  const section = page.getByTestId("stress-section");
  await section.getByLabel("Rebaja inicial en tanto por ciento").fill("5");
  await section.getByLabel("Rebaja final en tanto por ciento").fill("15");
  await section.getByLabel("Paso de la malla en tanto por ciento").fill("5");
  await section.getByLabel("Tu coste sin impuestos en € (coma o punto)").fill("80000,00");
  await section.getByLabel("Periodo en meses").fill("24");
  await section.getByLabel("Rival A · precio sin impuestos en €").fill("110000,00");
  await section.getByLabel("Rival B · precio sin impuestos en €").fill("115000,00");
  await section.getByLabel("Puntos por precio mínimos").fill("40");
  await section.getByLabel("Beneficio mínimo en € (coma o punto)").fill("1000");
}

const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
];

for (const { width, height } of WIDTHS) {
  test.describe(`v3 matrix ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test(`capture 8 scenes at ${width}px`, async ({ page }) => {
      test.setTimeout(240_000);
      const tag = String(width);
      const ten = `V3 10 ${tag}`;
      const fifteen = `V3 15 ${tag}`;

      // S1 library: demo CTA without scrolling.
      await page.goto("/");
      await expect(page.getByTestId("demo-load")).toBeVisible();
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await page.waitForLoadState("networkidle");
      await page.mouse.move(20, 20);
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT, tag, "s1-lib.png"),
        animations: "disabled",
      });

      // S2 workspace hero with the decision spotlight (gold pair saved
      // first so the verdict is the settled state, not test leftovers).
      await loadDemo(page);
      await expect(page.getByTestId("tender-title")).toContainText("Tías");
      await openTab(page, "Precio");
      await saveNamed(page, "10", ten, "106.502,40");
      await saveNamed(page, "15", fifteen, "100.585,60");
      await openTab(page, "Resumen");
      const spotlight = page.getByTestId("decision-spotlight");
      await expect(spotlight).toContainText("con los mismos puntos");
      await shot(page, width, "s2-hero.png");

      // S3 pricing simulator with the compare hero (same gold pair).
      await openTab(page, "Precio");
      await page.getByRole("checkbox", { name: `Comparar ${ten}` }).check();
      await page.getByRole("checkbox", { name: `Comparar ${fifteen}` }).check();
      await page.getByTestId("compare-run").click();
      const hero = page.getByTestId("decision-comparison-hero");
      await expect(hero).toBeVisible();
      await hero.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await shot(page, width, "s3-pricing.png");

      // S4 curve with plateau legend.
      await page.getByTestId("curve-chart").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("curve-chart")).toBeVisible();
      await shot(page, width, "s4-curva.png");

      // S5 frontier in Informe.
      await openTab(page, "Informe");
      await page.getByRole("checkbox", { name: `Comparar ${ten}` }).check();
      await page.getByRole("checkbox", { name: `Comparar ${fifteen}` }).check();
      await page.getByTestId("compare-run").click();
      const frontier = page.getByTestId("frontier-result");
      await expect(frontier).toBeVisible();
      await frontier.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await shot(page, width, "s5-frontera.png");

      // S6 stress mesh, then edited into the stale state.
      await openTab(page, "Precio");
      const section = page.getByTestId("stress-section");
      await section.scrollIntoViewIfNeeded();
      await fillStress(page);
      await section.getByTestId("stress-run").click();
      await expect(section.getByTestId("stress-selection")).toContainText("cumple tus límites", {
        timeout: 60_000,
      });
      await section.getByLabel("Beneficio mínimo en € (coma o punto)").fill("9000");
      const stale = section.getByTestId("stress-stale-input");
      await expect(stale).toContainText("Resultado anterior");
      await stale.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await shot(page, width, "s6-malla.png");

      // S7 evidence drawer with the proof trail.
      await page
        .getByRole("button", { name: /p\. 10: ver cita/ })
        .first()
        .click();
      const drawer = page.getByTestId("evidence-drawer");
      await expect(drawer).toBeVisible();
      await expect(drawer.getByTestId("evidence-trail")).toBeVisible();
      await shot(page, width, "s7-evidencia.png");
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();

      // S8 honest error state (empty cost blocks the mesh run).
      await page.reload();
      await expect(page.getByTestId("tender-title")).toContainText("Tías");
      await openTab(page, "Precio");
      const fresh = page.getByTestId("stress-section");
      await fresh.scrollIntoViewIfNeeded();
      await fresh.getByTestId("stress-run").click();
      const alert = fresh.getByRole("alert");
      await expect(alert).toContainText("Revisa tu coste");
      await alert.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await shot(page, width, "s8-estado.png");
    });
  });
}
