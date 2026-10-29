import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, openPricing, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// T06: dos copias guardadas se comparan con deltas del backend.
test("CMP-01 two saved scenarios compare with backend deltas", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("scenario-name").fill("CMP base 5");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP base 5» guardada.")).toBeVisible();

  await page.getByTestId("discount-input").fill("15");
  await expect(page.getByTestId("price-net")).toContainText("100.585,60");
  await page.getByTestId("scenario-name").fill("CMP base 15");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP base 15» guardada.")).toBeVisible();

  await page.getByRole("tab", { name: "Informe" }).click();
  await page.getByRole("checkbox", { name: "Comparar CMP base 5" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP base 15" }).check();
  await page.getByTestId("compare-run").click();

  const result = page.getByTestId("compare-result");
  await expect(result).toContainText("Puedes compararlas: comparten contexto.");
  await expect(result).toContainText("CMP base 5");
  await expect(result).toContainText("CMP base 15");
  await expect(result).toContainText("-11.833,60 €");
  await expect(result).toContainText("+2,6");
  await expect(result).toContainText(/cede .* de beneficio/);
  // BL-V2-13: los rivales comparados se etiquetan como supuestos.
  await expect(result).toContainText("tus supuestos de rivales, no ofertas reales");
  // BL-V3 P0-04: el resumen destaca el veredicto del backend con cifras y CTAs.
  await page.getByRole("tab", { name: "Resumen" }).click();
  const hero = page.getByTestId("decision-spotlight");
  await expect(hero).toContainText("CMP base 5");
  await expect(hero).toContainText("CMP base 15");
  await expect(hero).toContainText("de 49");
  await expect(hero.getByRole("link", { name: "Explorar comparación" })).toHaveAttribute("href", /tab=informe/);
  await expect(hero.getByRole("link", { name: "Ver regla de precio" })).toHaveAttribute("href", /tab=revisar/);
  await expect(hero.getByRole("link", { name: "Abrir evidencia" })).toHaveAttribute("href", /tab=evidencia/);
  // BL-V3 P1-01: duelo editorial lado a lado con dos pruebas.
  // (Las pestañas desmontan: se vuelve a marcar y comparar.)
  await page.getByRole("tab", { name: "Informe" }).click();
  await page.getByRole("checkbox", { name: "Comparar CMP base 5" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP base 15" }).check();
  await page.getByTestId("compare-run").click();
  const duel = page.getByTestId("compare-duel");
  await expect(duel).toBeVisible();
  await expect(duel).toContainText("CMP base 5");
  await expect(duel).toContainText("CMP base 15");
  await expect(duel).toContainText("de 49");
  expect(guard.blocked()).toBe(0);
});

// T06: el caso oro 10 % frente a 15 % da los mismos puntos con más beneficio.
test("CMP-02 golden 10 vs 15 keeps 49 points with higher profit", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("discount-input").fill("10");
  await expect(page.getByTestId("economic-score")).toContainText("49,0 de 49");
  await page.getByTestId("scenario-name").fill("CMP oro 10");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP oro 10» guardada.")).toBeVisible();

  await page.getByTestId("discount-input").fill("15");
  await page.getByTestId("scenario-name").fill("CMP oro 15");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP oro 15» guardada.")).toBeVisible();

  await page.getByRole("tab", { name: "Informe" }).click();
  await page.getByRole("checkbox", { name: "Comparar CMP oro 10" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP oro 15" }).check();
  await page.getByTestId("compare-run").click();

  const result = page.getByTestId("compare-result");
  await expect(result).toContainText("Puedes compararlas: comparten contexto.");
  await expect(result).toContainText("-5916,80 €");
  await expect(result).toContainText("con los mismos puntos");
  expect(guard.blocked()).toBe(0);
});

// U2: el hero del comparador en Precio muestra el delta del backend (10/15).
test("CMP-03 pricing compare hero shows 10 vs 15 backend delta", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  await page.getByTestId("discount-input").fill("10");
  await expect(page.getByTestId("economic-score")).toContainText("49,0 de 49");
  await page.getByTestId("scenario-name").fill("CMP hero 10");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP hero 10» guardada.")).toBeVisible();

  await page.getByTestId("discount-input").fill("15");
  await page.getByTestId("scenario-name").fill("CMP hero 15");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «CMP hero 15» guardada.")).toBeVisible();

  await page.getByRole("checkbox", { name: "Comparar CMP hero 10" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP hero 15" }).check();
  await page.getByTestId("compare-run").click();

  const hero = page.getByTestId("decision-comparison-hero");
  await expect(hero).toBeVisible();
  await expect(hero).toContainText("5916,80");
  await expect(hero).toContainText(/mismos puntos/);
  expect(guard.blocked()).toBe(0);
});

// BL-V2-08: with 3 scenarios the hero follows the chosen pair, never an
// arbitrary first delta.
test("CMP-04 compare hero follows the selected pair", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  for (const [discount, name] of [
    ["10", "CMP par 10"],
    ["15", "CMP par 15"],
    ["20", "CMP par 20"],
  ]) {
    await page.getByTestId("discount-input").fill(discount);
    await page.getByTestId("scenario-name").fill(name);
    await page.getByTestId("save-scenario").click();
    await expect(page.getByText(`Prueba «${name}» guardada.`)).toBeVisible();
  }

  await page.getByRole("checkbox", { name: "Comparar CMP par 10" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP par 15" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP par 20" }).check();
  await page.getByTestId("compare-run").click();

  const hero = page.getByTestId("decision-comparison-hero");
  await expect(hero).toBeVisible();
  const pairs = page.getByRole("radio", { name: /frente a/ });
  await expect(pairs).toHaveCount(2);
  const before = await hero.textContent();
  await pairs.nth(1).check();
  await expect(hero).not.toHaveText(before ?? "");
  // BL-V3 P1-01: con tres pruebas no hay duelo (la tabla manda).
  await expect(page.getByTestId("compare-duel")).toHaveCount(0);
  expect(guard.blocked()).toBe(0);
});

// BL-V2-05: the frontier classifies 10/15 from backend Decimal dominance.
test("CMP-05 frontier puts 10 ahead of 15 with backend motivos", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await openPricing(page);

  for (const [discount, name] of [
    ["10", "CMP front 10"],
    ["15", "CMP front 15"],
  ]) {
    await page.getByTestId("discount-input").fill(discount);
    await page.getByTestId("scenario-name").fill(name);
    await page.getByTestId("save-scenario").click();
    await expect(page.getByText(`Prueba «${name}» guardada.`)).toBeVisible();
  }

  await page.getByRole("checkbox", { name: "Comparar CMP front 10" }).check();
  await page.getByRole("checkbox", { name: "Comparar CMP front 15" }).check();
  await page.getByTestId("compare-run").click();

  const frontier = page.getByTestId("frontier-result");
  await expect(frontier).toBeVisible();
  await expect(frontier).toContainText("«CMP front 10» está en la frontera");
  await expect(frontier).toContainText("«CMP front 15» queda dominada");
  // BL-V3 P1-01: equal points are named as equal, never as less.
  await expect(frontier).toContainText("con los mismos puntos");
  expect(guard.blocked()).toBe(0);
});
