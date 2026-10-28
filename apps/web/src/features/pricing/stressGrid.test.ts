import { describe, expect, it } from "vitest";
import { buildCandidateDiscounts, isGridOk, rateToDiscountPercent } from "./stressGrid";

describe("buildCandidateDiscounts", () => {
  it("builds the full 0-40 % grid in 0.5 steps (81 rates)", () => {
    const result = buildCandidateDiscounts(0, 40, 0.5);
    expect(isGridOk(result)).toBe(true);
    if (!isGridOk(result)) return;
    expect(result.rates).toHaveLength(81);
    expect(result.rates[0]).toBe("0.0000");
    expect(result.rates[80]).toBe("0.4000");
  });

  it("builds a single candidate when from equals to", () => {
    const result = buildCandidateDiscounts(5, 5, 0.5);
    expect(result).toEqual({ rates: ["0.0500"] });
  });

  it("rejects grids above 81 candidates", () => {
    const result = buildCandidateDiscounts(0, 40, 0.1);
    expect(result).toEqual({ error: "La malla supera 81 rebajas. Amplía el paso." });
  });

  it("rejects inverted or out-of-range grids", () => {
    expect(buildCandidateDiscounts(10, 5, 0.5)).toEqual({
      error: "La malla va de 0 % a 40 %, de menor a mayor.",
    });
    expect(buildCandidateDiscounts(-1, 5, 0.5)).toEqual({
      error: "La malla va de 0 % a 40 %, de menor a mayor.",
    });
    expect(buildCandidateDiscounts(0, 41, 0.5)).toEqual({
      error: "La malla va de 0 % a 40 %, de menor a mayor.",
    });
  });

  it("rejects a non-positive step", () => {
    expect(buildCandidateDiscounts(0, 10, 0)).toEqual({
      error: "El paso debe ser mayor que cero.",
    });
  });

  it("rejects non-numeric input", () => {
    expect(buildCandidateDiscounts(Number.NaN, 10, 0.5)).toEqual({
      error: "Escribe desde, hasta y paso con números.",
    });
  });
});

describe("rateToDiscountPercent", () => {
  it("round-trips protocol rates to percent", () => {
    expect(rateToDiscountPercent("0.0500")).toBe(5);
    expect(rateToDiscountPercent("0.4000")).toBe(40);
    expect(rateToDiscountPercent("0.0000")).toBe(0);
  });

  it("returns null outside 0..0.40 or when unusable", () => {
    expect(rateToDiscountPercent("0.4100")).toBeNull();
    expect(rateToDiscountPercent("-0.0100")).toBeNull();
    expect(rateToDiscountPercent("no-numero")).toBeNull();
    expect(rateToDiscountPercent("")).toBeNull();
  });
});
