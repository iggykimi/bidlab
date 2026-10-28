import { expect, test } from "@playwright/test";
import { installOfflineGuard, takeConsoleFailures } from "./helpers";

// T14: la ruta visual del diseno_anterior vive en los estilos computados.
// Sin piezas nuevas: solo tokens (color, interlineado, foco).
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

test("prototype tokens are live in computed styles", async ({ page }) => {
  await installOfflineGuard(page);
  await page.goto("/");
  const body = page.locator("body");
  await expect(body).toHaveCSS("background-color", "rgb(247, 248, 250)");
  await expect(body).toHaveCSS("color", "rgb(24, 36, 59)");
  await expect(body).toHaveCSS("line-height", "24.8px");
  await expect(page.locator("header p").first()).toHaveCSS("color", "rgb(76, 93, 115)");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS("outline-offset", "4px");
  await expect(skip).toHaveCSS("outline-width", "3px");
});
