import { expect, test, type Page } from "@playwright/test";
import { installOfflineGuard, openTab, takeConsoleFailures } from "./helpers";

// R05: own-tender journey from intake to decision without the demo session.
// C10: any console.error / pageerror fails the test. The 409 below is
// injected on purpose (conflict UI path) and asserted, so only that exact
// resource line is exempt here.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  const unexpected = failures.consoleErrors.filter(
    (m) => !(m.startsWith("Failed to load resource") && m.includes("409"))
  );
  expect(unexpected, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

function uniqueTag(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/** Minimal 2-page PDF, ported from apps/api/tests/integration/test_intake_api.py. */
function twoPagePdf(first: string, second: string): Buffer {
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>", "ascii"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
      "ascii"
    ),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
      "ascii"
    ),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "ascii"),
  ];
  for (const text of [first, second]) {
    const stream = Buffer.from(`BT /F1 12 Tf 10 180 Td (${text}) Tj ET`, "latin1");
    objects.push(
      Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "ascii"),
        stream,
        Buffer.from("\nendstream", "ascii"),
      ])
    );
  }
  const out: Buffer[] = [Buffer.from("%PDF-1.4\n", "ascii")];
  objects.forEach((body, i) => {
    out.push(Buffer.from(`${i + 1} 0 obj\n`, "ascii"), body, Buffer.from("\nendobj\n", "ascii"));
  });
  out.push(Buffer.from("trailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n", "ascii"));
  return Buffer.concat(out);
}

/** Step 1 of intake with budget + period; lands on step 2 ("añadir el pliego"). */
async function createTenderToStep2(
  page: Page,
  title: string,
  externalId: string,
  pblNet: string,
  period: string
): Promise<void> {
  await page.goto("/");
  await page.getByTestId("nueva-licitacion").click();
  await expect(page.getByRole("heading", { name: "¿Qué licitación quieres dar de alta?" })).toBeVisible();
  await page.getByTestId("intake-title").fill(title);
  await page.getByTestId("intake-external-id").fill(externalId);
  await page.getByTestId("intake-body").fill("Ayuntamiento de Prueba");
  await page.getByTestId("intake-pbl-net").fill(pblNet);
  await page.getByTestId("intake-period").fill(period);
  await page.getByTestId("intake-submit").click();
  await expect(page.getByRole("heading", { name: "¿Quieres añadir el pliego en PDF?" })).toBeVisible();
}

async function fillReviewForm(page: Page, maxPoints: string, reason: string): Promise<void> {
  await page.getByTestId("review-template-proportional_inverse").check();
  await page.getByTestId("review-maxpoints").fill(maxPoints);
  await page.getByTestId("review-anomaly-rglcap85_standard").check();
  await page.getByTestId("review-reason").fill(reason);
}

// Full journey: intake + PDF + company + offline analysis + manual review +
// simulate + save + report + export, all on own ids, demo never involved.
test("R05 own tender travels from intake to exported report", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  const title = `Jardinería propia ${tag}`;
  const externalId = `OWN/${tag}`;

  await createTenderToStep2(page, title, externalId, "50000", "24");

  await page.getByTestId("intake-file").setInputFiles({
    name: "pliego.pdf",
    mimeType: "application/pdf",
    buffer: twoPagePdf(`Precio neto: 50000.00 euros (${tag})`, `Plazo: 24 meses (${tag})`),
  });
  await page.getByTestId("intake-upload").click();
  await expect(page.getByTestId("intake-open")).toBeVisible();
  await page.getByTestId("intake-open").click();

  await expect(page.getByRole("heading", { name: "¿Quién eres en esta licitación?" })).toBeVisible();
  await page.getByTestId("company-create-name").fill("Mi empresa E2E");
  await page.getByTestId("company-create-direct").fill("30000");
  await page.getByTestId("company-create-overhead").fill("5000");
  await page.getByTestId("company-create-period").fill("24");
  await page.getByTestId("company-create-submit").click();

  // Lands on Revisar with own data; the demo is never requested.
  await expect(page.getByTestId("tender-title")).toContainText(title);
  await expect(page.getByRole("heading", { name: "¿Pides propuestas automáticas?" })).toBeVisible();
  await expect(page.getByTestId("demo-badge")).toContainText("Tus datos");
  await expect(page.getByText("Carga el ejemplo")).toHaveCount(0);

  // Offline analysis: stub job succeeds with honest "no proposals" warnings.
  await page.getByTestId("analysis-start").click();
  await expect(page.getByTestId("analysis-status")).toContainText("Lista");
  await expect(page.getByText("Sin propuestas automáticas; revisa a mano.")).toBeVisible();

  // P0-4: the analysis moved the revision under the seeded draft.
  await expect(page.getByTestId("review-stale-base")).toBeVisible();
  await page.getByTestId("review-rebase").click();
  await expect(page.getByTestId("review-stale-base")).toHaveCount(0);

  // Manual review: budget prefilled from intake, then approve.
  await expect(page.getByTestId("review-budget")).toHaveValue(/50000/);
  await fillReviewForm(page, "49", "Reviso mi pliego a mano.");
  await page.getByTestId("review-submit").click();
  await expect(page.getByTestId("review-success")).toContainText("Ya guardamos tu revisión");
  await page.getByTestId("review-go-pricing").click();

  // Simulate, save, export: price 50000 x (1 - 10 %) = 45000.00.
  await page.getByTestId("discount-input").fill("10");
  await expect(page.getByTestId("price-net")).toContainText("45.000,00");
  await page.getByTestId("scenario-name").fill("Propia diez");
  await page.getByTestId("save-scenario").click();
  await expect(page.getByText("Prueba «Propia diez» guardada.")).toBeVisible();
  // Zeigarnik/H1: the Precio step counts saved pruebas without a reload.
  await expect(page.getByRole("tab", { name: "Precio" })).toContainText("(1)");
  const href = await page.getByRole("link", { name: "Verla en el informe" }).getAttribute("href");
  const savedId = new URL(href ?? "", "http://x/").searchParams.get("prueba");
  expect(savedId, "saved prueba id in link").toBeTruthy();

  await page.getByRole("link", { name: "Verla en el informe" }).click();
  await expect(page.getByRole("button", { name: /Abrir prueba Propia diez/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  let exportedId: string | null = null;
  await page.route("**/api/v1/reports", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      exportedId = request.postDataJSON()?.scenario_id ?? null;
    }
    await route.continue();
  });
  await page.getByRole("radio", { name: "Preparar oferta" }).check();
  await page.getByTestId("export-report").click();
  await expect(page.getByTestId("report-detail")).toBeVisible();
  expect(exportedId, "exported scenario is the own one").toBe(savedId);
  // Zeigarnik/H1: the Informe step counts created informes without a reload.
  await expect(page.getByRole("tab", { name: "Informe" })).toContainText("(1)");

  await page.reload();
  await expect(page.getByTestId("tender-title")).toContainText(title);
  await expect(page.getByText("Carga el ejemplo")).toHaveCount(0);
  // V2 BL-V2-12: el rastro resume el recorrido real con estados verdaderos.
  await openTab(page, "Resumen");
  const trace = page.getByTestId("decision-trace");
  await expect(trace).toContainText("pliego.pdf");
  await expect(trace).toContainText("Prueba simulada.");
  await expect(trace).toContainText("Fórmula aprobada");
  await expect(trace).toContainText("1 prueba guardada.");
  await expect(trace).toContainText("Última: preparar oferta.");
  // Cada nodo enlaza a su sección real.
  await expect(trace.getByRole("link", { name: "Cálculo" })).toHaveAttribute("href", /tab=precio/);
  // V2 BL-V2-07: cobertura del documento propio subido.
  await openTab(page, "Revisar");
  const coverage = page.getByTestId("coverage-job");
  await expect(coverage).toContainText("pliego.pdf");
  await expect(coverage).toContainText("2 páginas");
  await expect(coverage).toContainText("No sustituye una revisión integral.");
  expect(guard.blocked()).toBe(0);
});

// Pricing without a company links to Revisar to create it (company gate).
test("R05 pricing without a company links to Revisar", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  const title = `Sin empresa ${tag}`;

  await createTenderToStep2(page, title, `NOR/${tag}`, "60000", "12");
  await page.getByTestId("intake-skip").click();
  await page.getByTestId("intake-skip-company").click();
  await expect(page.getByTestId("tender-title")).toContainText(title);

  await openTab(page, "Precio");
  await expect(page.locator('section[aria-label="Precio bloqueado"]')).toBeVisible();
  await expect(page.getByText("Carga el ejemplo")).toHaveCount(0);
  await page.getByRole("link", { name: "Crea tu empresa en Revisar" }).click();
  await expect(page.getByRole("heading", { name: "¿Pides propuestas automáticas?" })).toBeVisible();
  await expect(page.getByText("Esta licitación no tiene documento.")).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

// A 409 on review keeps every word and succeeds on resend. The conflict is
// injected (first POST fails); the real server-side conflict is covered by
// backend tests, this pins the client path deterministically.
test("R05 review conflict keeps input and succeeds on resend", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  const title = `Conflicto ${tag}`;

  await createTenderToStep2(page, title, `CNF/${tag}`, "70000", "12");
  await page.getByTestId("intake-skip").click();
  await page.getByTestId("company-create-name").fill("Empresa CNF");
  await page.getByTestId("company-create-direct").fill("40000");
  await page.getByTestId("company-create-overhead").fill("4000");
  await page.getByTestId("company-create-submit").click();
  await expect(page.getByTestId("tender-title")).toContainText(title);

  // Rule gate first: with a company but no approved rule, Precio links back.
  await openTab(page, "Precio");
  await expect(page.locator('section[aria-label="Precio bloqueado"]')).toBeVisible();
  await page.getByRole("link", { name: "Revisa tu fórmula" }).click();
  await expect(page.getByRole("heading", { name: "¿Pides propuestas automáticas?" })).toBeVisible();

  await expect(page.getByTestId("review-budget")).toHaveValue(/70000/);
  await fillReviewForm(page, "40", "Mi motivo se conserva.");
  let first = true;
  await page.route("**/api/v1/tenders/*/reviews", async (route) => {
    if (first && route.request().method() === "POST") {
      first = false;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ code: "revision_conflict", message: "expected interpretation revision 1, got 0" }),
      });
      return;
    }
    await route.continue();
  });
  await page.getByTestId("review-submit").click();
  await expect(page.getByTestId("review-conflict")).toBeVisible();
  await expect(page.getByTestId("review-budget")).toHaveValue(/70000/);
  await expect(page.getByTestId("review-reason")).toHaveValue("Mi motivo se conserva.");

  await page.getByTestId("review-submit").click();
  await expect(page.getByTestId("review-success")).toContainText("Ya guardamos tu revisión");
  expect(guard.blocked()).toBe(0);
});

// T09: reload keeps the tracked analysis run (one GET, no second POST)
// and the invocation stays verifiable in the technical details.
test("R05 reload keeps the analysis run without a second call", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  const tag = uniqueTag();
  const title = `Recarga ${tag}`;

  await createTenderToStep2(page, title, `RLD/${tag}`, "80000", "12");
  await page.getByTestId("intake-file").setInputFiles({
    name: "pliego.pdf",
    mimeType: "application/pdf",
    buffer: twoPagePdf(`Precio neto: 80000.00 euros (${tag})`, `Plazo: 12 meses (${tag})`),
  });
  await page.getByTestId("intake-upload").click();
  await expect(page.getByTestId("intake-open")).toBeVisible();
  await page.getByTestId("intake-open").click();
  await page.getByTestId("company-create-name").fill("Empresa RLD");
  await page.getByTestId("company-create-direct").fill("50000");
  await page.getByTestId("company-create-overhead").fill("5000");
  await page.getByTestId("company-create-submit").click();
  await expect(page.getByRole("heading", { name: "¿Pides propuestas automáticas?" })).toBeVisible();

  let posts = 0;
  await page.route("**/api/v1/tenders/*/analysis", async (route) => {
    if (route.request().method() === "POST") posts += 1;
    await route.continue();
  });

  await page.getByTestId("analysis-start").click();
  await expect(page.getByTestId("analysis-status")).toContainText("Lista");
  await expect(page.getByTestId("analysis-run-kind")).toContainText("no llamó al servicio");

  const card = page.locator('section[aria-label="Análisis automático"]');
  await card.getByText("Detalles técnicos").click();
  const details = card.locator("details");
  await expect(details.locator("dt", { hasText: /^Ejecución$/ })).toBeVisible();
  await expect(details.locator("code", { hasText: /^inv-/ })).toBeVisible();
  await expect(details.locator("dt", { hasText: /^Modo$/ })).toBeVisible();
  await expect(details.locator("code", { hasText: /^fixture$/ })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("analysis-status")).toContainText("Lista");
  await expect(page.getByTestId("analysis-run-kind")).toContainText("no llamó al servicio");
  await expect(page.getByTestId("analysis-start")).toHaveCount(0);
  expect(posts).toBe(1);
  expect(guard.blocked()).toBe(0);
});
