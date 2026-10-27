import { execFileSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const ROOT = path.resolve(__dirname, "..", "..");
const apiPort = process.env.BIDLAB_PORT ?? "8000";
const webPort = process.env.BIDLAB_WEB_PORT ?? "5173";
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;

// This file loads once per worker process too: only the main process (no
// TEST_WORKER_INDEX) probes ports and mints the run dir; workers inherit
// BIDLAB_E2E_RUN_DIR through the environment (and must NOT probe: our own
// servers are already up by the time a worker loads this file).
if (process.env.TEST_WORKER_INDEX === undefined && !process.env.BIDLAB_E2E_RUN_DIR) {
  // Fail fast BEFORE Playwright wipes test-results or boots servers: at main
  // config load no Playwright-owned server exists yet, so any answer here is
  // foreign. (Playwright's own reuseExistingServer:false check runs later
  // and, with a live foreign server holding locked files under
  // test-results/, the run can stall in startup instead of aborting.)
  try {
    execFileSync(
      process.execPath,
      [path.resolve(__dirname, "check-ports.mjs"), apiPort, webPort],
      { stdio: "inherit" },
    );
  } catch {
    throw new Error(
      `[e2e] aborting: a foreign server owns port ${apiPort} and/or ${webPort}; stop it and rerun.`,
    );
  }
  // Hermetic storage: every run gets a FRESH backend dir, because Playwright
  // boots webServer BEFORE globalSetup, so a wipe in globalSetup could never
  // run before the server opened the sqlite file (the old wipe always saw
  // our own server alive and skipped, accumulating rows across runs).
  // global-setup.ts prunes previous runs' dirs.
  const e2eRunId = `run-${Date.now()}-${process.pid}`;
  process.env.BIDLAB_E2E_RUN_DIR = `./test-results/bidlab-e2e-storage-${e2eRunId}`;
}
const e2eStorageDir = process.env.BIDLAB_E2E_RUN_DIR ?? "";
if (e2eStorageDir === "") throw new Error("[e2e] BIDLAB_E2E_RUN_DIR was not set by the main process.");

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
