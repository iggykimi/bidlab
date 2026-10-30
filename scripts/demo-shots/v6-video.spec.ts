import path from "node:path";
import { expect, test } from "@playwright/test";
import { loadDemo } from "../../tests/e2e/helpers";

// V6 180s video capture: real app, paced storyboard, 1280x720 video.
// Output to test-results/v6-video (gitignored). Run explicitly; never gates.
const OUT = path.resolve(__dirname, "..", "..", "test-results", "v6-video");

test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: "on", size: { width: 1280, height: 720 } },
  launchOptions: { slowMo: 120 },
});

test.describe("v6 video capture", () => {
  test("storyboard 180s", async ({ page }) => {
    test.setTimeout(300_000);
    // S1 hook (0-20): spotlight.
    await loadDemo(page);
    await expect(page.getByTestId("tender-title")).toContainText("Tías");
    await page.waitForTimeout(18_000);

    // S2 evidence (20-50): citations.
    await page.getByRole("tab", { name: "Citas" }).click();
    await page.waitForTimeout(8_000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(8_000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(12_000);

    // S3 curve + trials (50-80).
    await page.getByRole("tab", { name: "Precio" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(4_000);
    await page.getByTestId("discount-input").fill("10");
    await expect(page.getByTestId("price-net")).toContainText("106.502,40");
    await page.waitForTimeout(4_000);
    await page.getByTestId("scenario-name").fill("Vid 10");
    await page.getByTestId("save-scenario").click();
    await expect(page.getByText("Prueba «Vid 10» guardada.")).toBeVisible();
    await page.waitForTimeout(4_000);
    await page.getByTestId("discount-input").fill("15");
    await expect(page.getByTestId("price-net")).toContainText("100.585,60");
    await page.getByTestId("scenario-name").fill("Vid 15");
    await page.getByTestId("save-scenario").click();
    await expect(page.getByText("Prueba «Vid 15» guardada.")).toBeVisible();
    await page.waitForTimeout(4_000);

    // S4 compare + frontier (80-110).
    await page.getByRole("tab", { name: "Informe" }).click();
    await page.getByRole("checkbox", { name: "Comparar Vid 10" }).check();
    await page.getByRole("checkbox", { name: "Comparar Vid 15" }).check();
    await page.waitForTimeout(3_000);
    await page.getByTestId("compare-run").click();
    await expect(page.getByTestId("frontier-result")).toBeVisible();
    await page.waitForTimeout(8_000);
    await page.getByTestId("frontier-result").scrollIntoViewIfNeeded();
    await page.waitForTimeout(10_000);
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(6_000);

    // S5 report + export (110-140).
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /Abrir prueba Vid 10/ }).click();
    await page.getByRole("radio", { name: "Preparar oferta" }).check();
    await page.waitForTimeout(3_000);
    await page.getByTestId("report-note-input").fill("Ten keeps the profit.");
    await page.waitForTimeout(3_000);
    await page.getByTestId("export-report").click();
    await expect(page.getByTestId("report-archive")).toContainText("Archivado el");
    await page.waitForTimeout(8_000);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("download-report").click(),
    ]);
    await download.saveAs(path.join(OUT, "video-export.html"));
    await page.waitForTimeout(8_000);

    // S6 Meta opt-in flow (140-170): own tender + PDF + consent screen.
    await page.goto("/");
    await page.getByTestId("nueva-licitacion").click();
    await page.getByTestId("intake-title").fill("Video own tender");
    await page.getByTestId("intake-external-id").fill("VID/180");
    await page.getByTestId("intake-body").fill("Video Body");
    await page.getByTestId("intake-submit").click();
    await page.waitForTimeout(3_000);
    await page.getByTestId("intake-skip").click();
    await page.waitForTimeout(2_000);
    await page.getByTestId("intake-skip-company").click();
    await expect(page.getByTestId("tender-title")).toContainText("Video own tender");
    await page.getByRole("tab", { name: "Revisar" }).click();
    await page.waitForTimeout(6_000);
    await page.getByText("Envío al modelo").scrollIntoViewIfNeeded();
    await page.waitForTimeout(14_000);

    // S7 close (170-180): hold.
    await page.waitForTimeout(10_000);

    const video = page.video();
    expect(video).not.toBeNull();
    const videoPath = await video!.path();
    console.log(`VIDEO_PATH=${videoPath}`);
  });
});
