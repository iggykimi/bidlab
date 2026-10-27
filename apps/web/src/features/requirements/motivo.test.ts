import { describe, expect, it } from "vitest";
import { motivoEs } from "./RequirementsTab";

describe("motivoEs", () => {
  it("maps every eligibility reason code to its plain fragment", () => {
    expect(motivoEs("value_meets_threshold")).toBe("tu cifra alcanza lo exigido");
    expect(motivoEs("value_below_threshold")).toBe("tu cifra está por debajo de lo exigido");
    expect(motivoEs("value_above_threshold")).toBe("tu cifra supera el máximo permitido");
    expect(motivoEs("value_differs")).toBe("tu dato no coincide con lo exigido");
    expect(motivoEs("text_found")).toBe("dato localizado");
    expect(motivoEs("text_not_found")).toBe("dato no localizado");
    expect(motivoEs("rule_not_approved")).toBe("aún sin revisar");
    expect(motivoEs("manual_review_required")).toBe("tienes que comprobarlo a mano");
    expect(motivoEs("missing_company_evidence")).toBe("tu empresa no aportó este dato");
    expect(motivoEs("evidence_not_reviewed")).toBe("dato de tu empresa aún sin revisar");
    expect(motivoEs("unit_mismatch")).toBe("las unidades no coinciden");
    expect(motivoEs("insufficient_period")).toBe("el periodo acreditado es demasiado corto");
    expect(motivoEs("missing_threshold")).toBe("falta el valor exigido");
    expect(motivoEs("threshold_unparseable")).toBe("no pudimos leer el valor exigido");
    expect(motivoEs("value_unparseable")).toBe("no pudimos leer el dato de tu empresa");
  });

  it("never leaks unknown codes to the UI", () => {
    expect(motivoEs("some_future_code")).toBe("sin determinar");
    expect(motivoEs("")).toBe("sin determinar");
  });
});
