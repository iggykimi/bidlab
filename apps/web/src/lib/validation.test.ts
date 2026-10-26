import { describe, expect, it } from "vitest";
import { discountPercentSchema, rivalPriceSchema, scenarioNameSchema } from "./validation";

describe("validation", () => {
  it("accepts protocol money strings", () => {
    expect(rivalPriceSchema.safeParse("106502.40").success).toBe(true);
  });

  it("rejects locale-formatted money", () => {
    expect(rivalPriceSchema.safeParse("106.502,40").success).toBe(false);
    expect(rivalPriceSchema.safeParse("106502.4").success).toBe(false);
    expect(rivalPriceSchema.safeParse("-1.00").success).toBe(false);
  });

  it("bounds discount percent to the P0 scope", () => {
    expect(discountPercentSchema.safeParse(15).success).toBe(true);
    expect(discountPercentSchema.safeParse(41).success).toBe(false);
    expect(discountPercentSchema.safeParse(-1).success).toBe(false);
  });

  it("requires a scenario name", () => {
    expect(scenarioNameSchema.safeParse("  ").success).toBe(false);
    expect(scenarioNameSchema.safeParse("Base 5 %").success).toBe(true);
  });
});
