import path from "node:path";
import { expect, test } from "@playwright/test";
import { loadDemo } from "../../tests/e2e/helpers";

// Jury captures for evidence/jury (V5 u1/u2, re-runnable). Real build with
// the seeded demo, fresh storage per run. Run explicitly; never in gates.
const OUT = path.resolve(__dirname, "..", "..", "evidence", "jury");

test.describe("jury shots 1280x720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("capture u1 spotlight and u2 compare results", async ({ page }) => {
    test.setTimeout(240_000);
    await loadDemo(page);
    await expect(page.getByTestId("tender-title")).toContainText("Tías");

    await page.getByRole("tab", { name: "Precio" }).click();
    for (const [discount, name, price] of [
      ["10", "Jury 10", "106.502,40"],
      ["15", "Jury 15", "100.585,60"],
    ] as const) {
      await page.getByTestId("discount-input").fill(discount);
      await expect(page.getByTestId("price-net")).toContainText(price);
      await page.getByTestId("scenario-name").fill(name);
      await page.getByTestId("save-scenario").click();
      await expect(page.getByText(`Prueba «${name}» guardada.`)).toBeVisible();
    }

    await page.getByRole("tab", { name: "Resumen" }).click();
    const spotlight = page.getByTestId("decision-spotlight");
    await expect(spotlight).toContainText("con los mismos puntos");
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState("networkidle");
    await page.mouse.move(20, 20);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "u1-expert-state.png"), animations: "disabled" });

    await page.getByRole("tab", { name: "Informe" }).click();
    await page.getByRole("checkbox", { name: "Comparar Jury 10" }).check();
    await page.getByRole("checkbox", { name: "Comparar Jury 15" }).check();
    await page.getByTestId("compare-run").click();
    const frontier = page.getByTestId("frontier-result");
    await expect(frontier).toBeVisible();
    await frontier.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState("networkidle");
    await page.mouse.move(20, 20);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "u2-compare-10v15.png"), animations: "disabled" });
  });
});
