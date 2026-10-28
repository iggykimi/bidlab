import { describe, expect, it } from "vitest";
import { consistencyFieldLabel } from "./radarCopy";

describe("consistencyFieldLabel", () => {
  it("labels every radar field in Spanish", () => {
    expect(consistencyFieldLabel("budget_net")).toBe("Presupuesto sin impuestos");
    expect(consistencyFieldLabel("period_months")).toBe("Duración en meses");
    expect(consistencyFieldLabel("max_price_points")).toBe("Puntos máximos del precio");
    expect(consistencyFieldLabel("pricing_formula_literal")).toBe("Fórmula de puntos");
    expect(consistencyFieldLabel("anomaly_literal")).toBe("Anormalidad");
    expect(consistencyFieldLabel("other_requirement")).toBe("Otro requisito");
  });
});
