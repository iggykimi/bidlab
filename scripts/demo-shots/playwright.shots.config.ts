import path from "node:path";
import { defineConfig } from "@playwright/test";

// Presentation shots live OUTSIDE tests/e2e: this config boots its own API
// (fresh storage per run) + built web preview, mirroring the E2E pattern.
const ROOT = path.resolve(__dirname, "..", "..");
const apiPort = process.env.BIDLAB_PORT ?? "8000";
const webPort = process.env.BIDLAB_WEB_PORT ?? "5173";
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;

if (process.env.TEST_WORKER_INDEX === undefined && !process.env.BIDLAB_SHOTS_RUN_DIR) {
  const runId = `run-${Date.now()}-${process.pid}`;
  process.env.BIDLAB_SHOTS_RUN_DIR = `./scripts/demo-shots/.storage-${runId}`;
}
const storageDir = process.env.BIDLAB_SHOTS_RUN_DIR ?? "";
if (storageDir === "") throw new Error("[shots] BIDLAB_SHOTS_RUN_DIR was not set.");

export default defineConfig({
  testDir: ".",
  globalSetup: "./shots-setup.ts",
  timeout: 180_000,
  reporter: "list",
  workers: 1,
  use: {
    baseURL: webBase,
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `uv run uvicorn bidlab.main:app --host 127.0.0.1 --port ${apiPort}`,
      url: `${apiBase}/api/v1/health`,
      cwd: ROOT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { BIDLAB_STORAGE_DIR: storageDir },
    },
    {
      command:
        `npm run build -w apps/web && npm run preview -w apps/web -- ` +
        `--host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webBase,
      cwd: ROOT,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { VITE_API_URL: `${apiBase}/api/v1` },
    },
  ],
});
