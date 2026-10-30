import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/client";
import { importErrorEs } from "./importErrors";

describe("importErrorEs", () => {
  it("explains a browser address-bar link instead of the generic refusal", () => {
    const portal = new ApiError(422, "unsupported_url", "x", ["portal_session_url"]);
    expect(importErrorEs(portal)).toContain("barra del navegador");
    const other = new ApiError(422, "unsupported_url", "x", ["other_host"]);
    expect(importErrorEs(other)).toContain("«Enlace a la licitación»");
  });

  it("offers the manual path when the source fails and never leaks codes", () => {
    expect(importErrorEs(new ApiError(502, "source_unavailable", "x"))).toContain("créala a mano");
    expect(importErrorEs(new ApiError(500, "internal", "internal error"))).not.toContain("internal");
    expect(importErrorEs(new Error("boom"))).not.toContain("boom");
  });
});
