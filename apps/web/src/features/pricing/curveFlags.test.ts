import { describe, expect, it } from "vitest";
import { splitFlaggedRuns } from "./CurveChart";

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
