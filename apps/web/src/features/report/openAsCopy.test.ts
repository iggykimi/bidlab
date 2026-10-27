import { describe, expect, it } from "vitest";
import { DEFAULTS } from "../pricing/hypotheses";
import type { Scenario } from "../../api/client";
import { rateToDiscountPct, scenarioToDraft } from "./openAsCopy";

function scenarioWith(input: Record<string, unknown>): Scenario {
  return { name: "Base", input } as unknown as Scenario;
}

const RIVALS = {
  state: "assumed",
  complete: true,
  group_membership_confirmed: true,
  own_group_id: "c",
  offers: [
    { label: "Rival A", price_net: "100585.60", group_id: "a" },
    { label: "Rival B", price_net: "110052.48", group_id: "b" },
  ],
};

describe("rateToDiscountPct", () => {
  it("convierte la tasa decimal a tanto por ciento", () => {
    expect(rateToDiscountPct("0.1300")).toBe(13);
    expect(rateToDiscountPct("0.0500")).toBe(5);
  });

  it("limita al rango del deslizador y rechaza basura", () => {
    expect(rateToDiscountPct("0.9999")).toBe(40);
    expect(rateToDiscountPct("-0.5")).toBe(0);
    expect(rateToDiscountPct("no-número")).toBeNull();
  });
});

describe("scenarioToDraft", () => {
  it("copia rebaja, rivales y grupos, y renombra", () => {
    const patch = scenarioToDraft(scenarioWith({ discount_rate: "0.1300", rivals: RIVALS }), DEFAULTS);
    expect(patch.h.discountPct).toBe(13);
    expect(patch.h.rivalAPrice).toBe("100585.60");
    expect(patch.h.rivalBGroup).toBe("b");
    expect(patch.h.ownGroup).toBe("c");
    expect(patch.h.complete).toBe(true);
    expect(patch.h.noRivals).toBe(false);
    expect(patch.scenarioName).toBe("Base (copia)");
  });

  it("sin ofertas activa el modo sin rivales", () => {
    const patch = scenarioToDraft(
      scenarioWith({ discount_rate: "0.10", rivals: { ...RIVALS, state: "unspecified", offers: [] } }),
      DEFAULTS
    );
    expect(patch.h.noRivals).toBe(true);
    expect(patch.h.rivalState).toBe("unspecified");
    expect(patch.h.rivalAPrice).toBe(DEFAULTS.rivalAPrice);
  });

  it("conserva el borrador actual cuando falta un dato", () => {
    const patch = scenarioToDraft(
      scenarioWith({
        discount_rate: "zzz",
        rivals: { ...RIVALS, own_group_id: null, offers: [{ label: "A", price_net: "1.00", group_id: null }] },
      }),
      { ...DEFAULTS, discountPct: 7 }
    );
    expect(patch.h.discountPct).toBe(7);
    expect(patch.h.rivalAPrice).toBe("1.00");
    expect(patch.h.rivalAGroup).toBe(DEFAULTS.rivalAGroup);
    expect(patch.h.rivalBPrice).toBe(DEFAULTS.rivalBPrice);
    expect(patch.h.ownGroup).toBe(DEFAULTS.ownGroup);
  });
});
