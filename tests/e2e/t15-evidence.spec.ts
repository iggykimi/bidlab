import { expect, test } from "@playwright/test";
import { API_BASE, installOfflineGuard, loadDemo, openPricing, openTab, takeConsoleFailures } from "./helpers";

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
    // BL-V2-07: coverage counts come from the workspace, never invented.
    const coverage = page.getByTestId("coverage-card");
    await expect(coverage).toContainText("9 citas en total");
    await expect(coverage).toContainText("9 citas en 6 páginas de 41");
    let imageRequests = 0;
    page.on("request", (req) => {
      if (req.url().includes("/documents/") && req.url().endsWith("/image")) imageRequests += 1;
    });
    const opener = page.getByRole("button", { name: /Ver página \d+ de / }).first();
    await opener.click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    // The curated seed has no render: labeled text, never a fake preview,
    // and no doomed image request is attempted (BL-V2-04).
    await expect(page.getByTestId("evidence-image-curated")).toContainText(
      "El documento original no se incluye en este ejemplo"
    );
    await expect(page.getByTestId("evidence-image")).toHaveCount(0);
    await expect(page.getByTestId("evidence-image-missing")).toHaveCount(0);
    expect(imageRequests, "doomed image requests").toBe(0);
    await expect(page.getByTestId("evidence-provenance")).toContainText(
      "Copia revisada del ejemplo"
    );
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
    // BL-V2-04: the scroll hint matches measured overflow, nothing else.
    const tableOverflows = await page.evaluate(() => {
      const region = document.querySelector(
        '[aria-label="Tabla de citas, desplázate horizontalmente"]'
      );
      if (!(region instanceof HTMLElement)) return null;
      return region.scrollWidth > region.clientWidth + 2;
    });
    expect(tableOverflows, "measured overflow").not.toBeNull();
    await expect(page.getByTestId("citations-scroll-hint")).toHaveCount(
      tableOverflows === true ? 1 : 0
    );
    expect(guard.blocked()).toBe(0);
  });

  test("T15 image load failure shows a real error with retry", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    const tag = uniqueTag();
    const title = `Cotejo propio ${tag}`;

    await page.goto("/");
    await page.getByTestId("nueva-licitacion").click();
    await page.getByTestId("intake-manual").click();
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
    await openTab(page, "Citas");
    // Fail the render fetch once: content exists, the image does not load.
    await page.route("**/documents/*/pages/*/image", (route) => route.abort());
    const opener = page.getByRole("button", { name: /Ver página 1 de / }).first();
    await opener.click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    await expect(page.getByTestId("evidence-image-missing")).toContainText(
      "No se ha podido cargar la vista previa"
    );
    await expect(page.getByTestId("evidence-image-retry")).toBeVisible();
    await page.unroute("**/documents/*/pages/*/image");
    await page.getByTestId("evidence-image-retry").click();
    const img = page.getByTestId("evidence-image");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(
      0
    );
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
    await page.getByTestId("intake-manual").click();
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
    // BL-V2-09: contadores reales e identidad de propuesta.
    await expect(page.getByTestId("claim-counters")).toContainText(
      "1 propuesta · 0 confirmadas · 1 por verificar."
    );
    await expect(page.getByText("propuesta 1 de 1")).toBeVisible();
    const state = page.getByTestId("claim-review-state-pbl_net");
    await expect(state).toContainText("Por verificar");
    const citeLine = page.getByText("Cita (copiado tal cual)");
    await expect(citeLine).toBeVisible();
    await page.getByTestId("claim-approve-pbl_net").check();
    await expect(state).toContainText("Lo confirmas");
    await expect(page.getByTestId("claim-counters")).toContainText(
      "1 propuesta · 1 confirmada · 0 por verificar."
    );
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
    await expect(page.getByTestId("evidence-image-curated")).toContainText(
      "El documento original no se incluye en este ejemplo"
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
test.describe("V3 proof trail", () => {
  test("rule-linked citation shows its exact journey and navigates", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openPricing(page);
    await page.getByRole("button", { name: /Puntos por precio/ }).first().click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    const trail = drawer.getByTestId("evidence-trail");
    await expect(trail.getByTestId("evidence-trail-fuente")).toContainText("Fuente \u00b7 p. 10");
    await expect(trail.getByTestId("evidence-trail-revision")).toContainText(
      "Revisi\u00f3n \u00b7 aprobada (rev. 1)"
    );
    await expect(trail.getByTestId("evidence-trail-regla")).toContainText(
      "Regla \u00b7 m\u00e1x. 49 puntos"
    );
    await expect(trail.getByTestId("evidence-trail-decision")).toContainText(
      "Decisi\u00f3n \u00b7 alimenta el c\u00e1lculo"
    );
    await trail.getByTestId("evidence-trail-revision").click();
    await expect(page).toHaveURL(/tab=revisar/);
    await expect(drawer).toBeHidden();
    expect(guard.blocked()).toBe(0);
  });

  test("decision chip lands on the calculation it feeds", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openPricing(page);
    await page.getByRole("button", { name: /Puntos por precio/ }).first().click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByTestId("evidence-trail-decision").click();
    await expect(page).toHaveURL(/tab=precio/);
    await expect(drawer).toBeHidden();
    await expect(page.locator("#tu-calculo")).toBeVisible();
    expect(guard.blocked()).toBe(0);
  });

  test("unused citation stays honest and fuente scrolls to the quote", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openTab(page, "Requisitos");
    await page.getByRole("button", { name: /Ver página 6 en el pliego/ }).first().click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    const trail = drawer.getByTestId("evidence-trail");
    await expect(trail.getByTestId("evidence-trail-fuente")).toContainText("Fuente \u00b7 p. 6");
    await expect(trail.getByTestId("evidence-trail-revision")).toContainText("sin uso en f\u00f3rmula");
    await expect(trail.getByTestId("evidence-trail-regla")).toContainText("sin f\u00f3rmula");
    await expect(trail.getByTestId("evidence-trail-decision")).toContainText(
      "no alimenta ning\u00fan c\u00e1lculo"
    );
    const region = drawer.locator('[aria-label="Contenido de la cita, desplázate verticalmente"]');
    await region.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await trail.getByTestId("evidence-trail-fuente").click();
    const inView = await drawer.getByTestId("evidence-quote").evaluate((el) => {
      const host = el.closest('[role="region"]');
      if (!(host instanceof HTMLElement)) return false;
      const r = el.getBoundingClientRect();
      const f = host.getBoundingClientRect();
      return r.top >= f.top - 1 && r.bottom <= f.bottom + 1;
    });
    expect(inView).toBe(true);
    expect(guard.blocked()).toBe(0);
  });
});

test.describe("V3 proof trail mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 568 } });

  test("trail wraps without global overflow", async ({ page }) => {
    const guard = await installOfflineGuard(page);
    await loadDemo(page);
    await openTab(page, "Citas");
    await page.getByRole("button", { name: /Ver página \d+ de / }).first().click();
    const drawer = page.getByTestId("evidence-drawer");
    await expect(drawer).toBeVisible();
    const trail = drawer.getByTestId("evidence-trail");
    await expect(trail.locator("li")).toHaveCount(4);
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowX).toBeLessThanOrEqual(1);
    expect(guard.blocked()).toBe(0);
  });
});
