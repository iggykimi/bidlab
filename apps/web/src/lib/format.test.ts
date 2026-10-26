import { describe, expect, it } from "vitest";
import { formatEUR, formatPoints } from "./format";

const squashSpace = (s: string) => s.replace(/\s/g, " ");

describe("format", () => {
  it("formats EUR in es-ES", () => {
    expect(squashSpace(formatEUR("118336.00"))).toBe("118.336,00 €");
  });

  it("formats points with 4 decimals", () => {
    expect(formatPoints("46.4211")).toBe("46,4211");
  });
});
