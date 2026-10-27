// Fail-fast port probe for the E2E suite (plain node, no deps).
// Usage: node check-ports.mjs <port> [<port> ...]
// Exits 0 when every port is free, 1 when any answers HTTP (or accepts and
// stays silent, which would equally break our own server bind).
import http from "node:http";

function probe(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/", timeout: 2000 },
      (res) => {
        res.resume();
        resolve({ port, alive: true, status: res.statusCode });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ port, alive: true, status: "silent-accept" });
    });
    req.on("error", () => resolve({ port, alive: false }));
  });
}

const ports = process.argv.slice(2).map(Number);
const results = await Promise.all(ports.map(probe));
const alive = results.filter((r) => r.alive);
if (alive.length > 0) {
  console.error(
    `[e2e] ports already in use by a live server: ${alive
      .map((r) => `${r.port} (http ${r.status})`)
      .join(", ")}. Stop it before running the suite.`,
  );
  process.exit(1);
}
console.log(`[e2e] ports free: ${ports.join(", ")}`);
