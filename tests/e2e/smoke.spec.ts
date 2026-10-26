import { expect, test } from "@playwright/test";
import { API_BASE } from "./helpers";

test("api health is reachable", async ({ request }) => {
  const res = await request.get(`${API_BASE}/health`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
});
