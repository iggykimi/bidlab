import { expect, test, type Page } from "@playwright/test";
import { API_BASE, installOfflineGuard, takeConsoleFailures } from "./helpers";

// T12: server-side search over the complete set, URL-kept query/page,
// honest pagination. Setup rows go through the real POST /tenders API.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

function uniqueTag(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function createTender(page: Page, tag: string, n: number): Promise<void> {
  const res = await page.request.post(`${API_BASE}/tenders`, {
    headers: {
      "Content-Type": "application/json",
      "X-BidLab-Client": "local-ui",
      "Idempotency-Key": `lib-${tag}-${n}`,
    },
    data: {
      title: `Biblioteca ${tag} ${n}`,
      external_id: `LIB/${tag}/${n}`,
      contracting_body: "Ayuntamiento de Prueba",
      source_url: null,
      scope_label: null,
      basis: null,
    },
  });
  expect(res.ok()).toBe(true);
}

test("search narrows on the server and survives a detail round-trip", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await createTender(page, tag, 1);
  await createTender(page, tag, 2);
  await createTender(page, tag, 3);

  await page.goto("/");
  await page.getByTestId("library-search").fill(tag);
  await expect(page.getByTestId("library-count")).toContainText("3 resultados");
  await page.getByTestId("library-search").fill(`${tag} 2`);
  await expect(page.getByTestId("library-count")).toContainText("1 resultado");
  await expect(page.getByRole("button", { name: `Biblioteca ${tag} 2` })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("q")).toBe(`${tag} 2`);

  await page.getByRole("button", { name: `Biblioteca ${tag} 2` }).click();
  await expect(page.getByTestId("tender-title")).toContainText(`Biblioteca ${tag} 2`);
  await page.goBack();
  await expect(page.getByTestId("library-search")).toHaveValue(`${tag} 2`);
  await expect(page.getByTestId("library-count")).toContainText("1 resultado");
  await expect(page.getByRole("button", { name: `Biblioteca ${tag} 2` })).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

test("pagination walks real server pages", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  await createTender(page, tag, 1);
  await createTender(page, tag, 2);
  await createTender(page, tag, 3);

  await page.goto(`/?q=${encodeURIComponent(tag)}&page_size=2`);
  await expect(page.getByTestId("library-count")).toContainText("3 resultados");
  await expect(page.getByTestId("library-page")).toContainText("Página 1 de 2");
  await expect(page.getByTestId("library-prev")).toBeDisabled();
  // Page 1 holds any two of the three (id order is opaque by design).
  await expect(page.locator('section[aria-label="Biblioteca local"] li')).toHaveCount(2);

  await page.getByTestId("library-next").click();
  await expect(page.getByTestId("library-page")).toContainText("Página 2 de 2");
  await expect(page.locator('section[aria-label="Biblioteca local"] li')).toHaveCount(1);
  await expect(page.getByTestId("library-next")).toBeDisabled();
  expect(page.url()).toContain("page=2");

  await page.getByTestId("library-prev").click();
  await expect(page.getByTestId("library-page")).toContainText("Página 1 de 2");
  await expect(page.locator('section[aria-label="Biblioteca local"] li')).toHaveCount(2);
  expect(guard.blocked()).toBe(0);
});
