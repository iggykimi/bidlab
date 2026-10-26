import path from "node:path";
import { defineConfig } from "@playwright/test";

const ROOT = path.resolve(__dirname, "..", "..");
const apiPort = process.env.BIDLAB_PORT ?? "8000";
const webPort = process.env.BIDLAB_WEB_PORT ?? "5173";
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  reporter: "list",
  workers: 1,
  use: {
    baseURL: webBase,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `uv run uvicorn bidlab.main:app --host 127.0.0.1 --port ${apiPort}`,
      url: `${apiBase}/api/v1/health`,
      cwd: ROOT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { BIDLAB_STORAGE_DIR: "./test-results/bidlab-e2e-storage" },
    },
    {
      command:
        `npm run build -w apps/web && npm run preview -w apps/web -- ` +
        `--host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webBase,
      cwd: ROOT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // C14: the preview build bakes VITE_API_URL at build time; point it at
      // the same API the suite boots so a custom BIDLAB_PORT keeps working.
      env: { VITE_API_URL: `${apiBase}/api/v1` },
    },
  ],
});
