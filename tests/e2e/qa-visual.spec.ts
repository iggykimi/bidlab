import { expect, test, type Page } from "@playwright/test";
import { installOfflineGuard, loadDemo, openTab, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// T30: QA visual + accesibilidad básica. Captura cada pestaña en escritorio y
// móvil, comprueba que no hay desbordamiento horizontal y valida roles,
// nombres accesibles, foco del cajón y lang="es".

async function noHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflowX, `desbordamiento horizontal en ${label}`).toBeLessThanOrEqual(1);
}

test.describe("T30 visual QA desktop 1280x720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("all tabs fit without horizontal overflow", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.screenshot({ path: "test-results/qa-desktop-resumen.png" });
    await noHorizontalOverflow(page, "resumen escritorio");

    await openTab(page, "Requisitos");
    await page.screenshot({ path: "test-results/qa-desktop-requisitos.png" });
    await noHorizontalOverflow(page, "requisitos escritorio");

    await openTab(page, "Precio");
    await expect(page.getByTestId("price-net")).toContainText("112.419,20");
    await page.screenshot({ path: "test-results/qa-desktop-pricing.png" });
    await page.screenshot({ path: "test-results/qa-desktop-pricing-full.png", fullPage: true });
    const curve = page.getByTestId("curve-chart");
    await curve.scrollIntoViewIfNeeded();
    await expect(curve.locator("path.recharts-line-curve")).toHaveCount(2);
    // Sin espera: la animación de trazado está desactivada y las curvas
    // se pintan estáticas en el primer render.
    await curve.screenshot({ path: "test-results/qa-desktop-curve.png" });
    await noHorizontalOverflow(page, "pricing escritorio");

    await openTab(page, "Evidencia");
    await page.screenshot({ path: "test-results/qa-desktop-evidencia.png" });
    await noHorizontalOverflow(page, "evidencia escritorio");

    await openTab(page, "Informe");
    await expect(page.getByTestId("report-note-input")).toHaveAccessibleName(/Comentario/);
    await page.screenshot({ path: "test-results/qa-desktop-informe.png" });
    await noHorizontalOverflow(page, "informe escritorio");
    expect(guard.blocked()).toBe(0);
  });

  test("drawer is labelled, keyboard closable and returns focus", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openTab(page, "Precio");
    await expect(page.getByTestId("price-net")).toContainText("112.419,20");

    const opener = page
      .locator("section[aria-label='Indicadores']")
      .getByRole("button", { name: /página 10/ })
      .first();
    await opener.click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("role", "dialog");
    await expect(page.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await page.screenshot({ path: "test-results/qa-desktop-drawer.png" });
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    expect(guard.blocked()).toBe(0);
  });

  test("tabs, slider, inputs and charts have accessible names", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await openTab(page, "Precio");
    await expect(page.getByTestId("discount-input")).toHaveAccessibleName(/Baja/);
    await expect(page.getByTestId("discount-slider")).toHaveAccessibleName(/Deslizador/);
    await expect(page.getByTestId("rival-a-price")).toHaveAccessibleName(/Hipótesis A/);
    await expect(page.getByTestId("scenario-name")).toHaveAccessibleName(/Nombre del escenario/);
    await expect(
      page.getByRole("img", { name: /Curva precio-puntos/ })
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Curva precio-beneficio/ })
    ).toBeVisible();
    expect(guard.blocked()).toBe(0);
  });
});

test.describe("T30 visual QA mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("all tabs fit without horizontal overflow", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);

    await page.screenshot({ path: "test-results/qa-mobile-resumen.png" });
    await noHorizontalOverflow(page, "resumen móvil");

    await openTab(page, "Requisitos");
    await page.screenshot({ path: "test-results/qa-mobile-requisitos.png" });
    await noHorizontalOverflow(page, "requisitos móvil");

    await openTab(page, "Precio");
    await expect(page.getByTestId("price-net")).toContainText("112.419,20");
    await page.screenshot({ path: "test-results/qa-mobile-pricing.png" });
    await page.screenshot({ path: "test-results/qa-mobile-pricing-full.png", fullPage: true });
    await noHorizontalOverflow(page, "pricing móvil");

    // El cajón ocupa todo el ancho en móvil y sigue siendo usable.
    const opener = page
      .locator("section[aria-label='Indicadores']")
      .getByRole("button", { name: /página 10/ })
      .first();
    await opener.click();
    await expect(page.getByTestId("evidence-drawer")).toBeVisible();
    await page.screenshot({ path: "test-results/qa-mobile-drawer.png" });
    await page.keyboard.press("Escape");

    await openTab(page, "Evidencia");
    await page.screenshot({ path: "test-results/qa-mobile-evidencia.png" });
    await noHorizontalOverflow(page, "evidencia móvil");

    await openTab(page, "Informe");
    await page.screenshot({ path: "test-results/qa-mobile-informe.png" });
    await noHorizontalOverflow(page, "informe móvil");
    expect(guard.blocked()).toBe(0);
  });
});
