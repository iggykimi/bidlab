import { describe, expect, it } from "vitest";
import {
  EVIDENCE_FIELD_OPTIONS,
  isKnownEvidenceKey,
  keyForEvidenceSlug,
  labelForEvidenceKey,
  slugForEvidenceKey,
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

  it("mapea slugs de URL legibles a claves de protocolo (J1 D3)", () => {
    for (const option of EVIDENCE_FIELD_OPTIONS) {
      expect(option.slug).not.toContain("_");
      expect(keyForEvidenceSlug(option.slug)).toBe(option.key);
      expect(slugForEvidenceKey(option.key)).toBe(option.slug);
    }
    expect(keyForEvidenceSlug("volumen-anual")).toBe("annual_turnover_best_3y_net");
    expect(keyForEvidenceSlug("no-existe")).toBeNull();
    expect(slugForEvidenceKey("future_key")).toBe("future_key");
  });
});
