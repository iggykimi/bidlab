import { expect, type Page } from "@playwright/test";

export const API_BASE =
  process.env.BIDLAB_API_URL ?? `http://127.0.0.1:${process.env.BIDLAB_PORT ?? "8000"}/api/v1`;

/** Abort any non-loopback request; the demo must work fully offline. */
export async function installOfflineGuard(page: Page): Promise<{ blocked: () => number }> {
  let blocked = 0;
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") {
      return route.continue();
    }
    blocked += 1;
    return route.abort("blockedbyclient");
  });
  return { blocked: () => blocked };
}

/** Fresh demo session from a clean browser context. */
export async function loadDemo(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("demo-load").click();
  await expect(page.getByTestId("tender-title")).toContainText("Tías");
}

export async function openTab(page: Page, name: "Resumen" | "Requisitos" | "Pricing Lab" | "Evidencia" | "Informe"): Promise<void> {
  await page.getByRole("tab", { name }).click();
}

/** Pricing Lab ready with the default 5 % evaluation painted. */
export async function openPricing(page: Page): Promise<void> {
  await openTab(page, "Pricing Lab");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
}
