import { describe, expect, it } from "vitest";
import { findPlateau, splitFlaggedRuns } from "./CurveChart";

function rows(flags: boolean[]): { price: number; flagged: boolean }[] {
  return flags.map((flagged, i) => ({ price: 100 + i, flagged }));
}

describe("splitFlaggedRuns", () => {
  it("returns no runs and no isolated points when nothing is flagged", () => {
    expect(splitFlaggedRuns(rows([false, false, false]))).toEqual({ runs: [], isolated: [] });
    expect(splitFlaggedRuns([])).toEqual({ runs: [], isolated: [] });
  });

  it("hatches contiguous runs of 2+ distinct prices", () => {
    expect(splitFlaggedRuns(rows([true, true, false, true, true, true]))).toEqual({
      runs: [
        { x1: 100, x2: 101 },
        { x1: 103, x2: 105 },
      ],
      isolated: [],
    });
  });

  it("dots a lone flagged point instead of hatching it", () => {
    expect(splitFlaggedRuns(rows([false, true, false]))).toEqual({
      runs: [],
      isolated: [101],
    });
  });

  it("splits a run plus an isolated tail point", () => {
    expect(splitFlaggedRuns(rows([true, true, false, true]))).toEqual({
      runs: [{ x1: 100, x2: 101 }],
      isolated: [103],
    });
  });

  it("treats a single repeated price as isolated (no zero-width run)", () => {
    const same = [
      { price: 100, flagged: true },
      { price: 100, flagged: true },
    ];
    expect(splitFlaggedRuns(same)).toEqual({ runs: [], isolated: [100, 100] });
  });
});

function scored(scores: (number | null)[]): { price: number; rawPrice: string; score: number | null }[] {
  return scores.map((score, i) => ({ price: 100 + i, rawPrice: `${100 + i}.00`, score }));
}

describe("findPlateau", () => {
  it("returns null without at least two defined scores", () => {
    expect(findPlateau([])).toBeNull();
    expect(findPlateau(scored([49]))).toBeNull();
    expect(findPlateau(scored([null, null]))).toBeNull();
    expect(findPlateau(scored([49, null]))).toBeNull();
  });

  it("finds the plateau start as the highest price keeping the max", () => {
    // Display order is price ascending: the run anchors at the
    // lowest price (highest discount) and starts at 101.
    expect(findPlateau(scored([49, 49, 46, 40]))).toEqual({
      price: 101,
      rawPrice: "101.00",
      score: 49,
    });
  });

  it("returns null when the cheapest point is below the max", () => {
    expect(findPlateau(scored([48, 49, 46]))).toBeNull();
  });

  it("returns null when the plateau is not anchored (unknown first)", () => {
    expect(findPlateau(scored([null, 49, 49]))).toBeNull();
  });

  it("needs a run of 2+: a lone max point is not a plateau", () => {
    expect(findPlateau(scored([49, 46, 40]))).toBeNull();
  });

  it("accepts a flat curve as a plateau from the highest price", () => {
    expect(findPlateau(scored([49, 49, 49]))).toEqual({
      price: 102,
      rawPrice: "102.00",
      score: 49,
    });
  });
});
