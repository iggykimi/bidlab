import fs from "node:fs";
import path from "node:path";

/**
 * Prune E2E storage leftovers from PREVIOUS runs only.
 *
 * Why not wipe the current run's dir here: Playwright boots `webServer`
 * BEFORE `globalSetup`, so by the time this runs the API server has already
 * opened its sqlite file. The old "wipe unless a server is alive" check
 * therefore always saw our own freshly-started server and skipped the wipe,
 * accumulating scenario rows across runs (duplicate names -> strict-mode
 * violations). Hermeticity now comes from playwright.config.ts, which points
 * each run at a fresh `test-results/bidlab-e2e-storage-run-<ts>-<pid>` dir;
 * this setup just deletes previous runs' dirs (plus the legacy fixed
 * `bidlab-e2e-storage` dir), never the current one from BIDLAB_E2E_RUN_DIR.
 * Fail-fast against foreign live servers is handled by
 * `reuseExistingServer: false` in the config: Playwright aborts if either
 * port is already taken instead of testing against stale state.
 */
export default async function globalSetup(): Promise<void> {
  const root = path.resolve(__dirname, "..", "..");
  const current = process.env.BIDLAB_E2E_RUN_DIR;
  if (!current) {
    console.log("[e2e setup] BIDLAB_E2E_RUN_DIR not set; skipping prune.");
    return;
  }
  const currentAbs = path.resolve(root, current);
  const resultsDir = path.resolve(root, "test-results");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resultsDir, { withFileTypes: true });
  } catch {
    return; // No test-results yet: nothing to prune.
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name !== "bidlab-e2e-storage" && !entry.name.startsWith("bidlab-e2e-storage-run-")) {
      continue;
    }
    const abs = path.join(resultsDir, entry.name);
    if (abs === currentAbs) continue;
    fs.rmSync(abs, { recursive: true, force: true });
    console.log(`[e2e setup] pruned stale storage ${abs}`);
  }
}
