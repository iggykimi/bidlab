// Port de ingenieria/test-motion.cjs: orden, fallo, cancelación,
// valor real y reduced-motion.

import { describe, expect, it } from "vitest";
import { commitResult, highlight, reveal, runVerifiedTour } from "./motion";

function fakeNode(): { textContent: string; animate: () => never } {
  return {
    textContent: "old",
    animate: () => {
      throw new Error("reduced motion must skip animation");
    },
  };
}

describe("runVerifiedTour", () => {
  it("runs action before verification, in order", async () => {
    const order: string[] = [];
    const controller = new AbortController();
    await runVerifiedTour(
      [
        {
          id: "one",
          perform: async () => {
            order.push("action");
          },
          verify: async () => {
            order.push("verify");
            return true;
          },
        },
      ],
      controller.signal,
    );
    expect(order).toEqual(["action", "verify"]);
  });

  it("halts on failed proof and never runs later steps", async () => {
    const controller = new AbortController();
    let after = false;
    await expect(
      runVerifiedTour(
        [
          { id: "bad", perform: async () => {}, verify: async () => false },
          {
            id: "never",
            perform: async () => {
              after = true;
            },
            verify: async () => true,
          },
        ],
        controller.signal,
      ),
    ).rejects.toThrow("Demo blocked at bad");
    expect(after).toBe(false);
  });

  it("does not start when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    let ran = false;
    await expect(
      runVerifiedTour(
        [
          {
            id: "no",
            perform: async () => {
              ran = true;
            },
            verify: async () => true,
          },
        ],
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(ran).toBe(false);
  });
});

describe("reduced motion", () => {
  it("commits the actual final value without animating", async () => {
    const node = fakeNode();
    await commitResult(node as unknown as HTMLElement, "106.502,40 €", {
      reducedMotion: true,
    });
    expect(node.textContent).toBe("106.502,40 €");
  });

  it("skips reveal without animating", async () => {
    const node = fakeNode();
    await reveal(node as unknown as HTMLElement, { reducedMotion: true });
  });

  it("skips highlight without animating", async () => {
    const node = fakeNode();
    await highlight(node as unknown as HTMLElement, { reducedMotion: true });
  });
});
