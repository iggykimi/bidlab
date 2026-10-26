import { test, expect } from "@playwright/test";

// T05 scaffold placeholder. Real E2E (E01–E12) lands in T29.
test("api health is reachable", async ({ request }) => {
  const res = await request.get("/api/v1/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
});
