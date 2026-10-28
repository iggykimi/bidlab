import fs from "node:fs";
import path from "node:path";

/**
 * Prune E2E storage dirs from previous runs. Each run owns a fresh dir
 * (tests/e2e/playwright.config.ts sets BIDLAB_E2E_RUN_DIR), because the
 * backend opens its sqlite before globalSetup runs, so wiping "the" dir
 * here could never work. Keep the current run's dir, drop the rest plus
 * the legacy fixed dir from before per-run storage.
 */
export default async function globalSetup(): Promise<void> {
  const root = path.resolve(__dirname, "..", "..");
  const current = process.env.BIDLAB_E2E_RUN_DIR ?? "";
  const currentAbs = current === "" ? "" : path.resolve(root, current);
  const results = path.join(root, "test-results");
  let entries: string[];
  try {
    entries = fs.readdirSync(results);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(results, entry);
    const isRunDir = entry.startsWith("bidlab-e2e-storage");
    if (!isRunDir) continue;
    if (full === currentAbs) continue;
    fs.rmSync(full, { recursive: true, force: true });
  }
}
