import path from "node:path";
import { defineConfig } from "@playwright/test";

// Footage real sin narración para el vídeo de 180 s (T33). No es puerta:
// arranca su propia API + frontal, graba el flujo oro con pausas y deja
// el .webm en test-results (mover a docs/demo/ a mano tras revisar).
const ROOT = path.resolve(__dirname, "..", "..");
const apiPort = process.env.BIDLAB_PORT ?? "8000";
const webPort = process.env.BIDLAB_WEB_PORT ?? "5173";
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;

if (process.env.TEST_WORKER_INDEX === undefined && !process.env.BIDLAB_VIDEO_RUN_DIR) {
  const runId = `run-${Date.now()}-${process.pid}`;
  process.env.BIDLAB_VIDEO_RUN_DIR = `./scripts/demo-video/.storage-${runId}`;
}
const storageDir = process.env.BIDLAB_VIDEO_RUN_DIR ?? "";
if (storageDir === "") throw new Error("[video] BIDLAB_VIDEO_RUN_DIR was not set.");

export default defineConfig({
  testDir: ".",
  globalSetup: "./video-setup.ts",
  timeout: 240_000,
  reporter: "list",
  workers: 1,
  use: {
    baseURL: webBase,
    viewport: { width: 1280, height: 720 },
    video: "on",
    launchOptions: { slowMo: 250 },
    trace: "off",
    screenshot: "off",
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
