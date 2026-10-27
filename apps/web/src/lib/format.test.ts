import { describe, expect, it } from "vitest";
import {
  PRECIO_INPUT_MODE,
  discountPercentToRate,
  formatEUR,
  formatEurosExact,
  formatEurosHeadline,
  formatFechaNormal,
  formatPercent,
  formatPoints,
  formatRate,
  formatSignedEUR,
  parsePrecioInput,
} from "./format";

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

describe("format (canonical, voice guide v1)", () => {
  it("formats headline euros with 0 decimals", () => {
    expect(squashSpace(formatEurosHeadline("118336.00"))).toBe("118.336 €");
    expect(squashSpace(formatEurosHeadline("118336.40"))).toBe("118.336 €");
  });

  it("formats exact euros with 2 decimals", () => {
    expect(squashSpace(formatEurosExact("118336.00"))).toBe("118.336,00 €");
  });

  it("formats points as value de max with 1 decimal", () => {
    expect(formatPoints("46.4211", "49")).toBe("46,4 de 49");
    expect(formatPoints("46.4211", "49.0000")).toBe("46,4 de 49");
  });

  it("formats backend rates as percent with 1 decimal", () => {
    expect(squashSpace(formatPercent("0.0500"))).toBe("5,0 %");
  });

  it("formats ISO dates as day de month de year, HH:MM", () => {
    // Local roundtrip keeps the test timezone-independent.
    const iso = new Date(2026, 10, 25, 23, 59).toISOString();
    expect(formatFechaNormal(iso)).toBe("25 de noviembre de 2026, 23:59");
  });

  it("echoes invalid ISO input back", () => {
    expect(formatFechaNormal("no-fecha")).toBe("no-fecha");
  });

  it("renders non-finite canonical values as an em dash", () => {
    for (const bad of ["NaN", "Infinity", "-Infinity", "abc", ""]) {
      expect(formatEurosHeadline(bad)).toBe("—");
      expect(formatEurosExact(bad)).toBe("—");
      expect(formatPoints(bad, "49")).toBe("—");
      expect(formatPoints("46.4211", bad)).toBe("—");
      expect(formatPercent(bad)).toBe("—");
    }
  });

  it("exposes a decimal keyboard hint for price inputs", () => {
    expect(PRECIO_INPUT_MODE).toBe("decimal");
  });

  it("parses comma and dot decimals into protocol money", () => {
    expect(parsePrecioInput("118336,50")).toBe("118336.50");
    expect(parsePrecioInput("118336.50")).toBe("118336.50");
    expect(parsePrecioInput("118336")).toBe("118336.00");
    expect(parsePrecioInput("100,5")).toBe("100.50");
  });

  it("parses thousands separators on either convention", () => {
    expect(parsePrecioInput("118.336,50")).toBe("118336.50");
    expect(parsePrecioInput("1,118,336.50")).toBe("1118336.50");
    expect(parsePrecioInput("1.118.336")).toBe("1118336.00");
    expect(parsePrecioInput("118.336")).toBe("118336.00");
  });

  it("rejects unusable price input with null", () => {
    for (const bad of ["", "abc", "12,34,56", "12.34.56", "-5", "12,34 €", "1,2.3,4"]) {
      expect(parsePrecioInput(bad)).toBeNull();
    }
  });
});
