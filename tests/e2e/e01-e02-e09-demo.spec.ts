import { expect, test } from "@playwright/test";
import { installOfflineGuard, loadDemo, takeConsoleFailures } from "./helpers";

// C10: any console.error / pageerror fails the test.
test.afterEach(() => {
  const failures = takeConsoleFailures();
  expect(failures.consoleErrors, "console.error calls").toEqual([]);
  expect(failures.pageErrors, "page errors").toEqual([]);
});

// E01: cargar ejemplo -> título Tías, badge de ejemplo, presupuesto neto, 0 llamadas externas.
test("E01 demo load shows Tías with example badge and stays offline", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await page.goto("/");
  await page.getByTestId("demo-load").click();
  await expect(page.getByTestId("tender-title")).toContainText("Tías");
  await expect(page.getByTestId("demo-badge")).toContainText("Datos de ejemplo");
  await expect(page.getByTestId("demo-banner")).toContainText(
    "Los precios de los rivales y tu coste son inventados"
  );
  await expect(page.locator("main")).toContainText("118.336");
  await expect(page.getByRole("link", { name: /Volver a mis licitaciones/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver publicación/ })).toBeVisible();
  expect(guard.blocked()).toBe(0);
});

// V2 BL-V2-12: el rastro demo muestra estados verdaderos (ejemplo preparado,
// nunca Meta live) y enlaza a secciones reales.
test("trace bar shows true demo states with real links", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  const trace = page.getByTestId("decision-trace");
  await expect(trace).toBeVisible();
  await expect(trace.locator("li")).toHaveCount(5);
  await expect(trace).toContainText("41 páginas");
  await expect(trace).toContainText("Ejemplo preparado.");
  await expect(trace).not.toContainText("Analizando con Meta");
  await expect(trace).toContainText("Fórmula aprobada");
  await expect(trace.getByRole("link", { name: "Fuente" })).toHaveAttribute("href", /tab=evidencia/);
  await expect(trace.getByRole("link", { name: "Decisión" })).toHaveAttribute("href", /tab=informe/);
  expect(guard.blocked()).toBe(0);
});

// V2 BL-V2-07: cobertura honesta en demo curada, sin porcentajes inventados.
test("coverage card shows curated pages without fake claims", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await page.getByRole("tab", { name: "Citas" }).click();
  const card = page.getByTestId("coverage-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Esta es una demostración curada.");
  await expect(card).toContainText("9 citas en total");
  await expect(card).toContainText("6 páginas de 41");
  await expect(card).toContainText("Páginas:");
  await expect(card).toContainText("No sustituye una revisión integral.");
  await expect(card).not.toContainText("100");
  expect(guard.blocked()).toBe(0);
});

// E02: abrir requisito técnico -> por verificar; drawer en página 6 de 41 con la cita.
test("E02 technical requirement is unknown with page 6 of 41 evidence", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  await page.getByRole("tab", { name: "Requisitos" }).click();
  const row = page.getByTestId("requirement-tech-services");
  await expect(row).toContainText("Por verificar");
  await row.getByRole("button", { name: /Ver página 6 en el pliego/ }).click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await expect(page.getByTestId("evidence-page")).toContainText("Página 6 de 41");
  await expect(page.getByTestId("evidence-quote")).toContainText("207.088");
  expect(guard.blocked()).toBe(0);
});

// Resumen UX-1: "Lo esencial" con plazo dinámico, presupuesto, duración y qué puntúa.
test("Resumen shows Lo esencial with a dynamic deadline", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);
  const esencial = page.getByTestId("lo-esencial");
  await expect(esencial).toBeVisible();
  // Fecha neutral ante husos horarios: mes y año son estables en cualquier zona.
  await expect(esencial).toContainText("noviembre de 2026");
  await expect(esencial).toContainText(/Quedan \d+ días|Queda 1 día|Último día: hoy|Plazo cerrado/);
  await expect(esencial).toContainText("24 meses");
  await expect(esencial).toContainText("hasta 49 puntos");
  await expect(page.locator("main")).toContainText("Datos del 25 de octubre de 2026");
  await expect(page.locator("main")).toContainText("Publicada");
  await expect(page.locator("main")).toContainText("¿Cómo suma puntos tu oferta?");
  await expect(page.locator("main")).toContainText("Cuanto más barata tu oferta");
  await expect(page.getByTestId("live-unavailable")).toContainText(
    "El asistente de IA no está disponible en esta demo: aquí los datos ya vienen revisados"
  );
  expect(guard.blocked()).toBe(0);
});

// Tab-state (revisión UX §2): la pestaña resaltada y el panel visible siempre
// coinciden, también tras cambios rápidos. El resaltado y el panel derivan del
// mismo ?tab= de la URL, así que un descuadre exigiría dos renders distintos:
// este test fija el estado asentado de cada cambio y refuta el fallo.
test("tabs keep highlight and panel in sync after quick switches", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await loadDemo(page);

  await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("lo-esencial")).toBeVisible();

  await page.getByRole("tab", { name: "Citas" }).click();
  await expect(page.getByRole("tab", { name: "Citas" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "false");
  await expect(page.locator("section[aria-label='Documentos']")).toBeVisible();
  await expect(page.getByTestId("lo-esencial")).toHaveCount(0);

  // Dos cambios seguidos: el estado final asentado sigue siendo coherente.
  await page.getByRole("tab", { name: "Informe" }).click();
  await page.getByRole("tab", { name: "Requisitos" }).click();
  await expect(page.getByRole("tab", { name: "Requisitos" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("requirement-tech-services")).toBeVisible();
  await expect(page.locator("section[aria-label='Nuevo informe']")).toHaveCount(0);
  await expect(page).toHaveURL(/tab=requisitos/);
  expect(guard.blocked()).toBe(0);
});

// E09: sin clave, la vista muestra una sola línea honesta y no llama a análisis.
test("E09 demo shows the assistant as unavailable without analysis calls", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  let analysisCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("/analysis")) analysisCalls += 1;
  });
  await loadDemo(page);
  await expect(page.getByTestId("live-unavailable")).toContainText(
    "El asistente de IA no está disponible en esta demo: aquí los datos ya vienen revisados"
  );
  await expect(page.getByTestId("live-attempt")).toHaveCount(0);
  expect(analysisCalls).toBe(0);
  expect(guard.blocked()).toBe(0);
});

// B3 (uxgaps): sin API, la biblioteca explica y ofrece Reintentar; al volver, recupera.
test("Library API-down explains and recovers through Reintentar", async ({ page }) => {
  const guard = await installOfflineGuard(page);
  await page.route("**/api/v1/tenders?page=*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "internal", message: "boom" }),
    })
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "No pudimos cargar la biblioteca. Comprueba que el programa está en marcha y pulsa Reintentar."
  );
  // El 500 registra un "Failed to load resource" esperado: se drena aquí para
  // no disparar C10; el afterEach sigue vigilando todo lo posterior.
  takeConsoleFailures();
  await page.unroute("**/api/v1/tenders?page=*");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  // La misma API sirve a todo el fichero: puede haber ejemplo o lista vacía.
  // La ficha del ejemplo menciona "Tías" en título y organismo (dos nodos),
  // así que la recuperación se afirma sobre la ficha entera o el vacío.
  const recovered = page
    .getByRole("button", { name: /Tías/ })
    .or(page.getByText("Sin resultados"));
  await expect(recovered).toBeVisible();
  expect(guard.blocked()).toBe(0);
});
