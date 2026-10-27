import { describe, expect, it } from "vitest";
import {
  EVIDENCE_FIELD_OPTIONS,
  isKnownEvidenceKey,
  labelForEvidenceKey,
} from "./evidenceFields";

describe("evidenceFields", () => {
  it("etiqueta las cinco claves conocidas sin mostrar código", () => {
    expect(EVIDENCE_FIELD_OPTIONS).toHaveLength(5);
    for (const option of EVIDENCE_FIELD_OPTIONS) {
      expect(option.label).not.toContain("_");
      expect(option.label.length).toBeGreaterThan(3);
    }
    expect(labelForEvidenceKey("annual_turnover_best_3y_net")).toBe(
      "Volumen anual (mejor de 3 años)"
    );
  });

  it("reconoce claves conocidas y deja pasar las demás", () => {
    expect(isKnownEvidenceKey("professional_insurance_net")).toBe(true);
    expect(isKnownEvidenceKey("manual")).toBe(false);
    expect(labelForEvidenceKey("future_key")).toBe("future_key");
  });
});
