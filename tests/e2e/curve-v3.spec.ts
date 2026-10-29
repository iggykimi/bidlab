import { expect, test, type Page } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// BL-V3 P1-02: the curve argues (plateau only when the backend points
// sustain it), stays readable at 320px and 200% zoom, and keeps the
// backend-numbers table as its keyboard fallback.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

async function openCurve(page: Page) {
  await loadDemo(page);
  await openPricing(page);
  const chart = page.getByTestId("curve-chart");
  await chart.scrollIntoViewIfNeeded();
  await expect(chart).toBeVisible();
  return chart;
}

/** Annotation labels stay within their chart and never cover each other. */
async function checkCurveLabels(chart: ReturnType<Page["getByTestId"]>): Promise<string> {
  return chart.evaluate((el) => {
    const boxes: { text: string; x: number; y: number; w: number; h: number }[] = [];
    for (const img of el.querySelectorAll('[role="img"]')) {
      const frame = img.getBoundingClientRect();
      for (const node of img.querySelectorAll("svg text")) {
        const text = (node.textContent ?? "").trim();
        if (!/Tu oferta|M\u00e1x\.|Rival [AB]|Equilibrio/.test(text)) continue;
        const r = (node as SVGTextElement).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const inside =
          r.left >= frame.left - 1 &&
          r.right <= frame.right + 1 &&
          r.top >= frame.top - 1 &&
          r.bottom <= frame.bottom + 1;
        if (!inside) return `clipped: ${text}`;
        boxes.push({ text, x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap =
          a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
        if (overlap) return `overlap: ${a.text} / ${b.text}`;
      }
    }
    return `ok:${boxes.length}`;
  });
}

test("demo curve names its plateau from backend points", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const chart = await openCurve(page);
  await expect(chart.locator("figcaption").first()).toContainText(
    "A partir de 106.502\u00a0\u20ac, m\u00e1s rebaja no mejora los puntos."
  );
  await expect(chart.getByTestId("curve-legend")).toContainText("Meseta");
  await expect(chart.getByRole("img", { name: /Curva precio-puntos/ })).toHaveAccessibleName(
    /meseta desde 106\.502/
  );
  expect(guard.blocked()).toBe(0);
});

test("unknown scores keep a neutral title without plateau claims", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const chart = await openCurve(page);
  await page.getByTestId("rivals-complete").uncheck();
  await expect(page.getByTestId("economic-score")).toContainText("Sin determinar");
  const caption = chart.locator("figcaption").first();
  await expect(caption).toContainText("tus puntos est\u00e1n sin determinar");
  await expect(caption).not.toContainText("m\u00e1s rebaja no mejora");
  await expect(chart.getByTestId("curve-legend")).toHaveCount(0);
  expect(guard.blocked()).toBe(0);
});

test("tooltip shows backend figures without moving the layout", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const chart = await openCurve(page);
  const img = chart.getByRole("img", { name: /Curva precio-puntos/ });
  const before = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    box: document
      .querySelector('[data-testid="curve-chart"]')
      ?.getBoundingClientRect()
      .toJSON(),
  }));
  await img.hover({ position: { x: 120, y: 60 } });
  await expect(
    chart.locator("figure").first().locator(".recharts-tooltip-wrapper")
  ).toContainText("Precio", {
    timeout: 10_000,
  });
  const after = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    box: document
      .querySelector('[data-testid="curve-chart"]')
      ?.getBoundingClientRect()
      .toJSON(),
  }));
  expect(after).toEqual(before);
  await expect(page.locator("main")).not.toContainText(/probabilidad/i);
  expect(guard.blocked()).toBe(0);
});

test("curve table opens by keyboard with backend numbers", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const chart = await openCurve(page);
  const summary = chart.getByTestId("curve-table").locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  const table = chart.getByTestId("curve-table");
  await expect(table).toContainText("112.419,20");
  await expect(table.getByRole("columnheader", { name: "Tu precio" })).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

test.describe("V3 curve at 320px", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("labels stay inside the chart without overlapping", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    const chart = await openCurve(page);
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowX).toBeLessThanOrEqual(1);
    expect(await checkCurveLabels(chart)).toMatch(/^ok:[1-9]/);
    await page.screenshot({ path: "test-results/v3-curve-320.png" });
    expect(guard.blocked()).toBe(0);
  });

  test("own label stays inside at the 0% and 40% extremes", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    const chart = await openCurve(page);
    for (const discount of ["0", "40"]) {
      await page.getByTestId("discount-input").fill(discount);
      await page.getByTestId("discount-input").press("Tab");
      await expect(chart.getByRole("img", { name: /Curva precio-puntos/ })).toBeVisible();
      expect(await checkCurveLabels(chart)).toMatch(/^ok:[1-9]/);
    }
    expect(guard.blocked()).toBe(0);
  });
});

test.describe("V3 curve at the 200%-zoom equivalent", () => {
  // Playwright has no browser-zoom API and CSS zoom does not reflow
  // breakpoints, so 200% on a 1280 screen is its honest equivalent:
  // a 640 CSS px viewport (same layout the zoomed browser computes).
  test.use({ viewport: { width: 640, height: 360 } });

  test("layout holds without global horizontal scroll", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    const chart = await openCurve(page);
    await expect(chart.locator("figcaption").first()).toContainText("m\u00e1s rebaja no mejora");
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowX).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/v3-curve-zoom200.png" });
    expect(guard.blocked()).toBe(0);
  });
});
