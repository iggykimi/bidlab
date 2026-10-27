import { expect, type Page } from "@playwright/test";

export const API_BASE =
  process.env.BIDLAB_API_URL ?? `http://127.0.0.1:${process.env.BIDLAB_PORT ?? "8000"}/api/v1`;

// C10: console.error / pageerror collected per test; specs drain them in
// afterEach and fail on any entry. Module-level because workers:1 runs serially.
let consoleErrors: string[] = [];
let pageErrors: string[] = [];

/** Abort any non-loopback request; the demo must work fully offline. */
export async function installOfflineGuard(page: Page): Promise<{ blocked: () => number }> {
  let blocked = 0;
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Handled document 404s (original bytes not redistributed) surface as UI
    // states by design; only JS-level errors and other resources fail the suite.
    if (msg.text().startsWith("Failed to load resource") && msg.location().url.includes("/documents/")) {
      return;
    }
    consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String((err as Error | null)?.message ?? err)));
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

/** Drain the C10 collectors; call once per test from afterEach. */
export function takeConsoleFailures(): { consoleErrors: string[]; pageErrors: string[] } {
  const out = { consoleErrors, pageErrors };
  consoleErrors = [];
  pageErrors = [];
  return out;
}

/** Fresh demo session from a clean browser context. */
export async function loadDemo(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("demo-load").click();
  await expect(page.getByTestId("tender-title")).toContainText("Tías");
}

export async function openTab(page: Page, name: "Resumen" | "Requisitos" | "Revisar" | "Precio" | "Citas" | "Informe"): Promise<void> {
  await page.getByRole("tab", { name }).click();
}

/** Price tab ready with the default 5 % evaluation painted. */
export async function openPricing(page: Page): Promise<void> {
  await openTab(page, "Precio");
  await expect(page.getByTestId("price-net")).toContainText("112.419,20");
}
