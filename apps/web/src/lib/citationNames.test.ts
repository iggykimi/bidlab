import { describe, expect, it } from "vitest";
import { CITATION_ES, citationName, fuenteEs, textoEs } from "./citationNames";

describe("citationName", () => {
  it("maps every known cit-* id to its review-table name", () => {
    expect(citationName("cit-turnover_threshold")).toBe("Volumen de negocio exigido");
    expect(citationName("cit-insurance_threshold")).toBe("Seguro exigido");
    expect(citationName("cit-technical_services_threshold")).toBe(
      "Experiencia exigida en servicios técnicos"
    );
    expect(citationName("cit-estimated_value")).toBe("Valor estimado del contrato");
    expect(citationName("cit-pbl_gross")).toBe("Presupuesto con IGIC");
    expect(citationName("cit-initial_duration_months")).toBe("Duración inicial");
    expect(citationName("cit-price_points")).toBe("Puntos por precio");
    expect(citationName("cit-anomaly_single_discount_gt")).toBe(
      "Cuándo una oferta se considera sospechosa (un licitador)"
    );
    expect(citationName("cit-anomaly_two_discount_gt")).toBe(
      "Cuándo una oferta se considera sospechosa (dos licitadores)"
    );
  });

  it("covers the nine demo citations", () => {
    expect(Object.keys(CITATION_ES)).toHaveLength(9);
  });

  it("never leaks unknown ids to the UI", () => {
    expect(citationName("cit-something_new")).toBe("Dato del pliego");
    expect(citationName("")).toBe("Dato del pliego");
  });
});

describe("textoEs", () => {
  it("maps every match status to its Texto value", () => {
    expect(textoEs("exact")).toBe("Copiado tal cual");
    expect(textoEs("normalized_match")).toBe("Equivalente");
    expect(textoEs("missing")).toBe("No encontrado");
    expect(textoEs("manual_visual")).toBe("Localizado a mano");
  });

  it("falls back to Sin determinar on unknown statuses", () => {
    expect(textoEs("fuzzy_v2")).toBe("Sin determinar");
    expect(textoEs("")).toBe("Sin determinar");
  });
});

describe("fuenteEs", () => {
  it("maps every match status to its Fuentes fragment", () => {
    expect(fuenteEs("exact")).toBe("texto idéntico");
    expect(fuenteEs("normalized_match")).toBe("texto equivalente");
    expect(fuenteEs("missing")).toBe("texto sin localizar");
    expect(fuenteEs("manual_visual")).toBe("texto localizado a mano");
  });

  it("falls back to texto sin localizar on unknown statuses", () => {
    expect(fuenteEs("fuzzy_v2")).toBe("texto sin localizar");
    expect(fuenteEs("")).toBe("texto sin localizar");
  });
});
