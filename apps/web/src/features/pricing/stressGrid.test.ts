import { describe, expect, it } from "vitest";
import {
  buildCandidateDiscounts,
  isGridOk,
  rateToDiscountPercent,
  stressDetailsEs,
  stressInputKey,
} from "./stressGrid";

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

describe("stressDetailsEs", () => {
  it("numbers hypotheses and rebates from zero-based paths", () => {
    expect(stressDetailsEs(["hypotheses[1].cost_net"])).toEqual([
      "Hipótesis 2: revisa tu coste (mayor que cero).",
    ]);
    expect(stressDetailsEs(["candidate_discounts[0]"])).toEqual([
      "Rebaja 1: fuera de 0–40 %.",
    ]);
  });

  it("translates constraint fields and drops unknown paths", () => {
    expect(
      stressDetailsEs(["constraints.min_price_points", "constraints.min_profit_net"])
    ).toEqual([
      "Revisa tus puntos mínimos (mayores que cero).",
      "Revisa tu beneficio mínimo (mayor que cero).",
    ]);
    expect(stressDetailsEs(["body.hypotheses"])).toEqual([]);
    expect(stressDetailsEs([])).toEqual([]);
  });
});

describe("stressInputKey", () => {
  const base = {
    scopeId: "tias-whole",
    ruleId: "rule-1",
    ruleRevision: 2,
    companyId: "company-demo",
    companyRevision: 1,
    rates: ["0.0500", "0.1000"],
    drafts: [
      {
        label: "Base",
        cost: "80000,00",
        period: "24",
        rivalA: "110000,00",
        rivalB: "115000,00",
        complete: true,
        groups: true,
      },
    ],
    minPoints: "40",
    minProfit: "1000",
  };

  it("is stable for identical normalized inputs", () => {
    const a = stressInputKey(base);
    expect(a).not.toBeNull();
    // "1000" and "1000,00" normalize to the same protocol figure.
    expect(stressInputKey({ ...base, minProfit: "1000,00" })).toBe(a);
    expect(stressInputKey({ ...base })).toBe(a);
  });

  it("changes when any field drifts", () => {
    const a = stressInputKey(base);
    expect(stressInputKey({ ...base, minProfit: "9000" })).not.toBe(a);
    expect(stressInputKey({ ...base, minPoints: "41" })).not.toBe(a);
    expect(stressInputKey({ ...base, rates: ["0.0500"] })).not.toBe(a);
    expect(
      stressInputKey({
        ...base,
        drafts: [{ ...base.drafts[0]!, rivalA: "1", complete: false }],
      })
    ).not.toBe(a);
    expect(stressInputKey({ ...base, ruleRevision: 3 })).not.toBe(a);
    expect(stressInputKey({ ...base, companyRevision: 2 })).not.toBe(a);
  });

  it("returns null for invalid drafts or missing context", () => {
    expect(stressInputKey({ ...base, scopeId: null })).toBeNull();
    expect(stressInputKey({ ...base, minPoints: "abc" })).toBeNull();
    expect(
      stressInputKey({ ...base, drafts: [{ ...base.drafts[0]!, label: "  " }] })
    ).toBeNull();
  });
});

