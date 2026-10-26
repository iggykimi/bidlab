import { defineConfig } from "@playwright/test";

const port = process.env.BIDLAB_PORT ?? "8000";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  reporter: "list",
  use: { baseURL },
  webServer: {
    command: "uv run uvicorn bidlab.main:app --host 127.0.0.1 --port " + port,
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
