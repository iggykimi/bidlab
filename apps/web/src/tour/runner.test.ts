// executeTour: progreso, bloqueo honesto con id del paso y cancelación.

import { describe, expect, it } from "vitest";
import { blockedStepOf, executeTour } from "./runner";
import type { VerifiedStep } from "../lib/motion";

function ok(id: string): VerifiedStep {
  return { id, perform: async () => {}, verify: async () => true };
}

describe("blockedStepOf", () => {
  it("extracts the step id from a blocked tour", () => {
    expect(blockedStepOf(new Error("Demo blocked at rebaja-15"))).toBe("rebaja-15");
  });

  it("returns null for anything else", () => {
    expect(blockedStepOf(new Error("boom"))).toBeNull();
    expect(blockedStepOf(null)).toBeNull();
  });
});

describe("executeTour", () => {
  it("reports each started step and finishes done", async () => {
    const seen: number[] = [];
    const outcome = await executeTour([ok("one"), ok("two")], new AbortController().signal, (i) => {
      seen.push(i);
    });
    expect(seen).toEqual([0, 1]);
    expect(outcome).toEqual({ phase: "done", failedStep: null, started: 2 });
  });

  it("stops at the unverified step and names it", async () => {
    const seen: number[] = [];
    const bad: VerifiedStep = { id: "bad", perform: async () => {}, verify: async () => false };
    const outcome = await executeTour([ok("one"), bad, ok("never")], new AbortController().signal, (i) => {
      seen.push(i);
    });
    expect(seen).toEqual([0, 1]);
    expect(outcome).toEqual({ phase: "blocked", failedStep: "bad", started: 2 });
  });

  it("reports cancelled when aborted mid-tour", async () => {
    const controller = new AbortController();
    let after = false;
    const stopper: VerifiedStep = {
      id: "stop",
      perform: async () => {
        controller.abort();
      },
      verify: async () => true,
    };
    const never: VerifiedStep = {
      id: "never",
      perform: async () => {
        after = true;
      },
      verify: async () => true,
    };
    const outcome = await executeTour([ok("one"), stopper, never], controller.signal, () => {});
    expect(outcome.phase).toBe("cancelled");
    expect(outcome.failedStep).toBeNull();
    expect(after).toBe(false);
  });

  it("lets unexpected errors through", async () => {
    const broken: VerifiedStep = {
      id: "broken",
      perform: async () => {
        throw new Error("boom");
      },
      verify: async () => true,
    };
    await expect(executeTour([broken], new AbortController().signal, () => {})).rejects.toThrow("boom");
  });
});
