import { expect, test } from "@playwright/test";
import { API_BASE, installOfflineGuard, loadDemo, openTab, takeConsoleFailures } from "./helpers";

// T15 dato-fuente en revisión: la imagen exacta cuando existe, texto
// rotulado cuando no; cerrar devuelve el foco; cita localizada y
// revisión semántica son estados distintos. Desktop y móvil.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
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

test.describe("T15 desktop 1280x720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("T15 drawer labels text and returns focus", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openTab(page, "Citas");
    const opener = page.getByRole("button", { name: /Ver página \d+ de / }).first();
    await opener.click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    // The curated seed has no render: labeled text, never a fake preview.
    await expect(page.getByTestId("evidence-image-missing")).toContainText(
      "Esta página no tiene imagen"
    );
    await expect(page.getByTestId("evidence-image")).toHaveCount(0);
    await expect(drawer.getByRole("heading", { name: "Texto de la página" })).toBeVisible();
    await expect(page.getByTestId("evidence-quote")).toBeVisible();

    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();

    await opener.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    expect(guard.blocked()).toBe(0);
  });

  test("T15 drawer shows the exact page image and keeps review states apart", async ({
    page,
  }) => {
    const guard = await installOfflineGuard(page);
    const tag = uniqueTag();
    const title = `Cotejo propio ${tag}`;

    await page.goto("/");
    await page.getByTestId("nueva-licitacion").click();
    await page.getByTestId("intake-title").fill(title);
    await page.getByTestId("intake-external-id").fill(`T15/${tag}`);
    await page.getByTestId("intake-body").fill("Ayuntamiento de Prueba");
    await page.getByTestId("intake-pbl-net").fill("50000");
    await page.getByTestId("intake-period").fill("24");
    await page.getByTestId("intake-submit").click();
    await page.getByTestId("intake-file").setInputFiles({
      name: "pliego.pdf",
      mimeType: "application/pdf",
      buffer: twoPagePdf(`Precio neto: 50000.00 euros (${tag})`, `Plazo: 24 meses (${tag})`),
    });
    await page.getByTestId("intake-upload").click();
    await expect(page.getByTestId("intake-open")).toBeVisible();
    await page.getByTestId("intake-open").click();
    await page.getByTestId("intake-skip-company").click();
    await expect(page.getByTestId("tender-title")).toContainText(title);
    const tenderId = page.url().split("/tenders/")[1]?.split(/[?#]/)[0];
    expect(tenderId, "tender id in URL").toBeTruthy();

    // Corrected-proposal review quoting the real page text, so the stored
    // citation is located exactly on the rendered upload.
    const ws = await page.request.get(`${API_BASE}/tenders/${tenderId}/workspace`);
    expect(ws.ok()).toBe(true);
    const docId = (await ws.json()).documents[0].id as string;
    const pageRes = await page.request.get(`${API_BASE}/documents/${docId}/pages/1`);
    expect(pageRes.ok()).toBe(true);
    const excerpt = ((await pageRes.json()).normalized_text as string).trim().slice(0, 600);
    expect(excerpt.length).toBeGreaterThan(10);
    const review = await page.request.post(`${API_BASE}/tenders/${tenderId}/reviews`, {
      headers: { "X-BidLab-Client": "local-ui", "Idempotency-Key": `t15-${tag}` },
      data: {
        expected_revision: 0,
        approved_claim_keys: [],
        requirement_trees: [],
        scope_basis: null,
        pricing_rule: null,
        corrected_proposal: {
          schema_version: "1.0",
          claims: [
            {
              key: "pbl_net",
              raw_value: "50000.00",
              normalized_value: "50000.00",
              unit: "EUR",
              citations: [{ document_id: docId, page_number: 1, verbatim_excerpt: excerpt }],
              confidence: "high",
              status: "proposed",
              notes: [],
            },
          ],
          requirements: [],
          pricing_formula: {
            formula_literal: null,
            template_hint: "unsupported",
            max_points: null,
            variables: [],
            citations: [],
            ambiguities: [],
          },
          anomaly_text: null,
          anomaly_citations: [],
          unread_pages: [],
          warnings: [],
        },
        actor: "e2e-t15",
        reason: "Cotejo imagen-texto.",
      },
    });
    expect(review.ok()).toBe(true);

    await page.reload();
    await expect(page.getByTestId("tender-title")).toContainText(title);
    await openTab(page, "Citas");
    const opener = page.getByRole("button", { name: /Ver página 1 de / }).first();
    await opener.click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    const img = page.getByTestId("evidence-image");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(
      0
    );
    await expect(page.getByTestId("evidence-image-missing")).toHaveCount(0);
    await expect(drawer.getByRole("heading", { name: "Texto de la página" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();

    // Localized citation (machine) and semantic review (human) stay apart:
    // approving the claim never rewrites the localization state.
    await openTab(page, "Revisar");
    const state = page.getByTestId("claim-review-state-pbl_net");
    await expect(state).toContainText("Por verificar");
    const citeLine = page.getByText("Cita (copiado tal cual)");
    await expect(citeLine).toBeVisible();
    await page.getByTestId("claim-approve-pbl_net").check();
    await expect(state).toContainText("Lo confirmas");
    await expect(citeLine).toContainText("Cita (copiado tal cual)");
    expect(guard.blocked()).toBe(0);
  });
});

test.describe("T15 mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("T15 mobile drawer keeps labeled text and focus", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openTab(page, "Citas");
    const opener = page.getByRole("button", { name: /Ver página \d+ de / }).first();
    await opener.click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    await expect(page.getByTestId("evidence-image-missing")).toContainText(
      "Esta página no tiene imagen"
    );
    await expect(page.getByTestId("evidence-image")).toHaveCount(0);
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowX).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    expect(guard.blocked()).toBe(0);
  });
});
