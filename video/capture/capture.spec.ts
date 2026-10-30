import fs from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loadDemo, openTab } from "../../tests/e2e/helpers";

// Real-app captures for the 180 s video. Each frame is a settled screenshot
// plus the boxes of the elements the camera will move to, so Remotion can
// zoom into real UI without hard-coded coordinates.
const OUT = path.resolve(__dirname, "..", "public", "shots");
const SCALE = 1.5;
type Box = { x: number; y: number; w: number; h: number };
const manifest: Record<string, Record<string, Box>> = {};

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForLoadState("networkidle");
  await page.mouse.move(4, 4);
  await page.locator("li[data-sonner-toast]").first().waitFor({ state: "detached", timeout: 8000 });
  await page.waitForTimeout(400);
}

async function snap(page: Page, name: string, focus: Record<string, Locator> = {}): Promise<void> {
  await settle(page);
  const boxes: Record<string, Box> = {};
  for (const [key, locator] of Object.entries(focus)) {
    const b = await locator.boundingBox();
    if (b) boxes[key] = { x: b.x * SCALE, y: b.y * SCALE, w: b.width * SCALE, h: b.height * SCALE };
  }
  manifest[name] = boxes;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: "disabled" });
}

async function top(locator: Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: "start" }));
}

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
test.afterAll(() => {
  const file = path.join(OUT, "boxes.json");
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  fs.writeFileSync(file, `${JSON.stringify({ ...previous, ...manifest }, null, 2)}\n`);
});

test("gold journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("demo-load")).toBeVisible();
  await snap(page, "home", { demo: page.getByTestId("demo-load") });

  await loadDemo(page);
  await snap(page, "summary", {
    title: page.getByTestId("tender-title"),
    steps: page.getByRole("tablist"),
  });

  await openTab(page, "Requisitos");
  const req = page.getByRole("heading", { name: "¿Puedes presentarte?" });
  await top(req);
  await snap(page, "requirements", {
    table: page.locator("table").first(),
    unknown: page.getByTestId("requirement-tech-services"),
  });

  await page.getByTestId("clarify-req-tech-amount").click();
  const clarify = page.getByTestId("clarification-panel");
  await top(clarify);
  await page.evaluate(() => window.scrollBy(0, -360));
  await snap(page, "clarify-offline", {
    button: page.getByTestId("clarify-req-tech-amount"),
    panel: clarify,
  });
  await clarify.getByRole("button", { name: "Cerrar" }).click();
  await top(req);

  await page.getByTestId("requirement-tech-services").getByRole("button").first().click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await snap(page, "evidence", {
    drawer: page.getByTestId("evidence-drawer"),
    quote: page.getByTestId("evidence-quote"),
  });
  await page.getByRole("button", { name: "Cerrar" }).click();

  await openTab(page, "Precio");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
  const kpis = page.locator("section[aria-label='Indicadores']");
  for (const [pct, price] of [
    ["10", "106.502,40"],
    ["15", "100.585,60"],
  ] as const) {
    await page.getByTestId("discount-input").fill(pct);
    await expect(page.getByTestId("price-net")).toContainText(price);
    await top(page.getByRole("heading", { name: "¿Cuánto quieres rebajar?" }));
    await page.evaluate(() => window.scrollBy(0, -24));
    await snap(page, `price-${pct}`, {
      slider: page.getByTestId("discount-input"),
      price: page.getByTestId("price-net"),
      profit: page.getByTestId("profit-net"),
      kpis,
      score: page.getByTestId("economic-score"),
    });
    await page.getByTestId("scenario-name").fill(`Rebaja ${pct} %`);
    await page.getByTestId("save-scenario").click();
    await expect(page.getByText(`Prueba «Rebaja ${pct} %» guardada.`)).toBeVisible();
  }

  const ask = page.getByTestId("ask-panel");
  await top(ask);
  await snap(page, "ask-offline", { panel: ask, mic: ask.getByTestId("ask-mic") });

  await page.getByTestId("curve-chart").scrollIntoViewIfNeeded();
  await snap(page, "curve", { chart: page.getByTestId("curve-chart") });

  await openTab(page, "Resumen");
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap(page, "spotlight", { spotlight: page.getByTestId("decision-spotlight") });

  await openTab(page, "Informe");
  await page.getByRole("checkbox", { name: "Comparar Rebaja 10 %" }).check();
  await page.getByRole("checkbox", { name: "Comparar Rebaja 15 %" }).check();
  await page.getByTestId("compare-run").click();
  await expect(page.getByTestId("frontier-result")).toBeVisible();
  await top(page.getByTestId("compare-result"));
  await snap(page, "compare", {
    result: page.getByTestId("compare-result"),
    duel: page.getByTestId("compare-duel"),
    frontier: page.getByTestId("frontier-result"),
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /Abrir prueba Rebaja 10 %/ }).click();
  await page.getByRole("radio", { name: "Preparar oferta" }).check();
  await page.getByTestId("report-note-input").fill("Preparo la oferta: el 10 % da los mismos puntos y más margen.");
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  await top(page.getByTestId("report-detail"));
  await snap(page, "report", { report: page.getByTestId("report-detail") });

  await openTab(page, "Resumen");
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap(page, "font-normal", { toggle: page.locator("#font") });
  await page.locator("#font").click();
  await snap(page, "font-large", { toggle: page.locator("#font") });
});

test("own tender and Meta consent", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nueva-licitacion").click();
  await page
    .getByTestId("import-url")
    .fill("https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=5a%2FQilm%2BBmc2wEhQbcAqug%3D%3D");
  await snap(page, "import-offline", { field: page.getByTestId("import-url"), submit: page.getByTestId("import-submit") });
  await page.getByTestId("intake-manual").click();
  await page.getByTestId("intake-title").fill("Limpieza de edificios municipales");
  await page.getByTestId("intake-external-id").fill("2026/LIM-014");
  await page.getByTestId("intake-body").fill("Ayuntamiento de ejemplo");
  await snap(page, "intake", { form: page.locator("form").first() });
  await page.getByTestId("intake-submit").click();
  await page.getByTestId("intake-skip").click();
  await page.getByTestId("intake-skip-company").click();
  await expect(page.getByTestId("tender-title")).toContainText("Limpieza");
  await openTab(page, "Revisar");
  await page.getByText("Envío al modelo").first().scrollIntoViewIfNeeded();
  await snap(page, "meta-review", { consent: page.getByText("Envío al modelo").first() });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  test("pricing on a phone", async ({ page }) => {
    await loadDemo(page);
    await openTab(page, "Precio");
    await expect(page.getByTestId("price-net")).toContainText("112.419,20");
    await settle(page);
    await page.screenshot({ path: path.join(OUT, "mobile.png"), animations: "disabled" });
  });
});
