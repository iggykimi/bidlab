import fs from "node:fs";
import path from "node:path";

// Prune previous shots runs' storage dirs, keeping the current one.
export default function shotsGlobalSetup(): void {
  const dir = path.resolve(__dirname);
  const keep = path.basename(process.env.BIDLAB_SHOTS_RUN_DIR ?? "");
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.startsWith(".storage-") || entry === keep) continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}
