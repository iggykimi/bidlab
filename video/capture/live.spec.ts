import fs from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loadDemo, openTab } from "../../tests/e2e/helpers";

// Live Meta captures for the video. They run only with a configured
// provider (BIDLAB_MODE=live, MODEL_API_KEY, META_API_URL) and spend real,
// bounded budget: one import (no model), one extraction job, one
// clarification draft and one voice question. Nothing here is mocked; if a
// step fails, the scene falls back to the offline captures.
//
// Optional inputs:
//   BIDLAB_PLACSP_URL  tender link on contrataciondelestado.es to import
//   BIDLAB_VOICE_WAV   your recorded question (WAV); Chromium plays it as
//                      the microphone, so the transcription is real
const LIVE = process.env.BIDLAB_MODE === "live" && !!process.env.MODEL_API_KEY && !!process.env.META_API_URL;
const PLACSP_URL =
  process.env.BIDLAB_PLACSP_URL ??
  "https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=5a%2FQilm%2BBmc2wEhQbcAqug%3D%3D";
const VOICE_WAV = process.env.BIDLAB_VOICE_WAV ? path.resolve(process.env.BIDLAB_VOICE_WAV) : null;

const OUT = path.resolve(__dirname, "..", "public", "shots");
const SCALE = 1.5;
type Box = { x: number; y: number; w: number; h: number };
const manifest: Record<string, Record<string, Box>> = {};

test.skip(!LIVE, "live captures need BIDLAB_MODE=live, MODEL_API_KEY and META_API_URL");

async function snap(page: Page, name: string, focus: Record<string, Locator> = {}): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.mouse.move(4, 4);
  await page.waitForTimeout(500);
  const boxes: Record<string, Box> = {};
  for (const [key, locator] of Object.entries(focus)) {
    const b = await locator.boundingBox();
    if (b) boxes[key] = { x: b.x * SCALE, y: b.y * SCALE, w: b.width * SCALE, h: b.height * SCALE };
  }
  manifest[name] = boxes;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: "disabled" });
}

async function top(locator: Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: "start" }));
}

test.afterAll(() => {
  const file = path.join(OUT, "boxes.json");
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  fs.writeFileSync(file, `${JSON.stringify({ ...previous, ...manifest }, null, 2)}\n`);
});

test("live: import a published tender and let Muse Spark read it", async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto("/");
  await page.getByTestId("nueva-licitacion").click();
  await page.getByTestId("import-url").fill(PLACSP_URL);
  await snap(page, "live-import-paste", { field: page.getByTestId("import-url") });
  await page.getByTestId("import-submit").click();
  await expect(page.getByTestId("import-summary")).toBeVisible({ timeout: 240_000 });
  await snap(page, "live-import", { summary: page.getByTestId("import-summary") });

  await page.getByTestId("import-continue").click();
  await page.getByTestId("intake-skip-company").click();
  await expect(page.getByTestId("tender-title")).toBeVisible();
  await openTab(page, "Revisar");
  const consent = page.getByTestId("analysis-consent");
  await consent.scrollIntoViewIfNeeded();
  await consent.check();
  await snap(page, "live-consent", { consent: page.locator("section[aria-label='Análisis automático']") });
  await page.getByTestId("analysis-start").click();
  await expect(page.getByTestId("analysis-status")).toContainText("Lista", { timeout: 420_000 });
  const claims = page.locator("section[aria-label='Propuestas automáticas']");
  await expect(claims).toBeVisible();
  await top(claims);
  await snap(page, "live-proposal", { claims });

  const firstPage = claims.getByRole("button", { name: /Ver página \d+/ }).first();
  if (await firstPage.isVisible()) {
    await firstPage.click();
    await expect(page.getByTestId("evidence-drawer")).toBeVisible();
    await snap(page, "live-evidence", { drawer: page.getByTestId("evidence-drawer") });
  }
});

test.describe("live: clarification and voice on the reviewed example", () => {
  test.use(
    VOICE_WAV
      ? {
          launchOptions: {
            args: [
              "--use-fake-ui-for-media-stream",
              "--use-fake-device-for-media-stream",
              `--use-file-for-fake-audio-capture=${VOICE_WAV}%noloop`,
            ],
          },
          permissions: ["microphone"],
        }
      : {}
  );

  test("clarification draft and a spoken question", async ({ page }) => {
    test.setTimeout(300_000);
    await loadDemo(page);
    await openTab(page, "Requisitos");
    await page.getByTestId("clarify-req-tech-amount").click();
    const panel = page.getByTestId("clarification-panel");
    await panel.getByRole("checkbox").check();
    await panel.getByTestId("clarification-draft-run").click();
    await expect(panel.getByTestId("clarification-draft")).toBeVisible({ timeout: 120_000 });
    await top(panel);
    await snap(page, "live-clarify", { panel, draft: panel.getByTestId("clarification-draft") });

    await openTab(page, "Precio");
    await expect(page.getByTestId("price-net")).toBeVisible();
    const ask = page.getByTestId("ask-panel");
    await top(ask);
    await ask.getByTestId("ask-consent").check();
    if (VOICE_WAV) {
      await ask.getByTestId("ask-mic").click();
      await snap(page, "live-voice-recording", { mic: ask.getByTestId("ask-mic") });
      await page.waitForTimeout(Number(process.env.BIDLAB_VOICE_SECONDS ?? "5") * 1000);
      await ask.getByTestId("ask-mic").click();
      await expect(ask.getByText("¿Es esto lo que has dicho?")).toBeVisible({ timeout: 90_000 });
      await snap(page, "live-voice-transcript", { question: ask.getByTestId("ask-question") });
    } else {
      await ask.getByTestId("ask-question").fill("¿Y si bajo un 12 %? ¿Cuántos puntos y cuánto beneficio me quedan?");
    }
    await ask.getByTestId("ask-submit").click();
    await expect(ask.getByTestId("ask-answer")).toBeVisible({ timeout: 180_000 });
    await top(ask.getByTestId("ask-answer"));
    await snap(page, "live-voice-answer", { answer: ask.getByTestId("ask-answer") });
  });
});
