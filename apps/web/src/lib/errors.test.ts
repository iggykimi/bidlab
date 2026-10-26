import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { ERROR_ES, errorCode, errorEs } from "./errors";

describe("errors", () => {
  it("covers every protocol code in the copy-style list", () => {
    for (const code of [
      "basis_not_approved",
      "rule_not_approved",
      "stale_revision",
      "revision_conflict",
      "discount_out_of_scope",
      "curve_out_of_scope",
      "scope_not_found",
      "company_not_found",
      "document_bytes_unavailable",
      "budget_exhausted",
      "job_not_found",
      "unknown_claim_key",
      "requirements_tree_corrupt",
      "money_unparseable",
      "forbidden",
    ]) {
      expect(ERROR_ES[code], code).toMatch(/.{10,}/);
    }
  });

  it("translates known codes and keeps the raw code aside", () => {
    const err = new ApiError(422, "rule_not_approved", "rule not approved");
    expect(errorEs(err)).toContain("revisada");
    expect(errorEs(err)).not.toContain("rule_not_approved");
    expect(errorCode(err)).toContain("rule_not_approved");
  });

  it("maps http_N codes to a generic Spanish message", () => {
    expect(errorEs(new ApiError(500, "http_500", "boom"))).toContain("código 500");
  });

  it("falls back to Spanish for unknown codes and values", () => {
    expect(errorEs(new ApiError(400, "future_code", "future"))).toContain("API local");
    expect(errorEs(new Error("nope"))).toContain("API local");
    expect(errorEs("nope", "A medida")).toBe("A medida");
    expect(errorCode(new Error("nope"))).toBeNull();
  });
});
