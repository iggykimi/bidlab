import path from "node:path";
import { defineConfig } from "@playwright/test";

const ROOT = path.resolve(__dirname, "..", "..");
const apiPort = process.env.BIDLAB_PORT ?? "8000";
const webPort = process.env.BIDLAB_WEB_PORT ?? "5173";
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;

// Hermetic storage: every run gets a FRESH backend dir, because Playwright
// boots webServer BEFORE globalSetup, so a wipe in globalSetup can never run
// before the server opens the sqlite file (the old wipe always saw our own
// server alive and skipped, accumulating rows across runs). global-setup.ts
// prunes previous runs' dirs; it reads the current one from this variable.
const e2eRunId = `run-${Date.now()}-${process.pid}`;
const e2eStorageDir = `./test-results/bidlab-e2e-storage-${e2eRunId}`;
process.env.BIDLAB_E2E_RUN_DIR = e2eStorageDir;

export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
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
      // Fail fast if a foreign server already owns the port: silently
      // reusing it would test against stale storage instead of our fresh dir.
      reuseExistingServer: false,
      timeout: 120_000,
      env: { BIDLAB_STORAGE_DIR: e2eStorageDir },
    },
    {
      command:
        `npm run build -w apps/web && npm run preview -w apps/web -- ` +
        `--host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webBase,
      cwd: ROOT,
      // Same fail-fast as the API server: never test against a stale preview.
      reuseExistingServer: false,
      timeout: 180_000,
      // C14: the preview build bakes VITE_API_URL at build time; point it at
      // the same API the suite boots so a custom BIDLAB_PORT keeps working.
      env: { VITE_API_URL: `${apiBase}/api/v1` },
    },
  ],
});
