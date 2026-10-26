import { describe, expect, it } from "vitest";
import { discountPercentToRate, formatEUR, formatPoints, formatRate, formatSignedEUR } from "./format";

const squashSpace = (s: string) => s.replace(/\s/g, " ");

describe("format", () => {
  it("formats EUR in es-ES", () => {
    expect(squashSpace(formatEUR("118336.00"))).toBe("118.336,00 €");
  });

  it("formats points with 4 decimals", () => {
    expect(formatPoints("46.4211")).toBe("46,4211");
  });

  it("formats backend rates as percent", () => {
    expect(squashSpace(formatRate("0.0500"))).toBe("5,0 %");
  });

  it("encodes discount percent as protocol rate", () => {
    expect(discountPercentToRate(5)).toBe("0.0500");
    expect(discountPercentToRate(15)).toBe("0.1500");
  });

  it("renders non-finite values as an em dash, never NaN", () => {
    for (const bad of ["NaN", "Infinity", "-Infinity", "abc", ""]) {
      expect(formatEUR(bad)).toBe("—");
      expect(formatSignedEUR(bad)).toBe("—");
      expect(formatPoints(bad)).toBe("—");
      expect(formatRate(bad)).toBe("—");
    }
  });
});
