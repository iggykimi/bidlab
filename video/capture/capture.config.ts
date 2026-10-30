import path from "node:path";
import { defineConfig } from "@playwright/test";

// Captures for the Remotion video. Same pattern as scripts/demo-shots: own
// API (fresh storage per run) + built web preview on loopback. A 1280x720
// viewport at deviceScaleFactor 1.5 yields exact 1920x1080 frames, so the
// video shows the real UI at native resolution with no upscaling.
//
// Live Meta scenes are optional: export BIDLAB_MODE=live, MODEL_API_KEY and
// META_API_URL before `npm run capture` and they are captured for real;
// without them those scenes are skipped, never mocked.
const ROOT = path.resolve(__dirname, "..", "..");
// The API's CORS allowlist is the dev origin 127.0.0.1:5173 only.
const apiPort = process.env.BIDLAB_PORT ?? "8000";
const webPort = "5173";
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;

if (process.env.TEST_WORKER_INDEX === undefined && !process.env.BIDLAB_CAPTURE_RUN_DIR) {
  process.env.BIDLAB_CAPTURE_RUN_DIR = path.join(ROOT, "video", "capture", `.storage-${Date.now()}`);
}

export default defineConfig({
  testDir: ".",
  timeout: 240_000,
  reporter: "list",
  workers: 1,
  use: {
    baseURL: webBase,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `uv run uvicorn bidlab.main:app --host 127.0.0.1 --port ${apiPort}`,
      url: `${apiBase}/api/v1/health`,
      cwd: ROOT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { BIDLAB_STORAGE_DIR: process.env.BIDLAB_CAPTURE_RUN_DIR ?? "" },
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
