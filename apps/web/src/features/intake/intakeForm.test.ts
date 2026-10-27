import { describe, expect, it } from "vitest";
import {
  buildTenderCreate,
  EMPTY_INTAKE_FORM,
  validateIntake,
  type IntakeForm,
} from "./intakeForm";

const BASE: IntakeForm = {
  ...EMPTY_INTAKE_FORM,
  title: "Servicio de limpieza",
  externalId: "2026/00009999X",
  contractingBody: "Ayuntamiento de Ejemplo",
};

describe("validateIntake", () => {
  it("accepts a minimal manual form", () => {
    expect(validateIntake(BASE)).toEqual({});
  });

  it("requires title, reference and body with plain errors", () => {
    const errors = validateIntake(EMPTY_INTAKE_FORM);
    expect(errors.title).toBe("Escribe el título de la licitación.");
    expect(errors.externalId).toBe("Escribe la referencia o expediente.");
    expect(errors.contractingBody).toBe("Escribe el organismo que convoca.");
  });

  it("rejects unusable money and period entries", () => {
    const errors = validateIntake({ ...BASE, pblNet: "abc", pblGross: "12,34,56", periodMonths: "2.5" });
    expect(errors.pblNet).toBe("Escribe un importe válido, como 1234,56.");
    expect(errors.pblGross).toBe("Escribe un importe válido, como 1234,56.");
    expect(errors.periodMonths).toBe("Escribe los meses como un número entero.");
  });

  it("rejects non-positive or non-integer periods", () => {
    for (const bad of ["0", "-3", "dos"]) {
      expect(validateIntake({ ...BASE, periodMonths: bad }).periodMonths).toBeDefined();
    }
    expect(validateIntake({ ...BASE, periodMonths: "24" })).toEqual({});
  });

  it("rejects source urls outside http(s) and long scope labels", () => {
    expect(validateIntake({ ...BASE, sourceUrl: "ftp://x" }).sourceUrl).toBeDefined();
    expect(validateIntake({ ...BASE, sourceUrl: "no-es-url" }).sourceUrl).toBeDefined();
    expect(validateIntake({ ...BASE, scopeLabel: "x".repeat(81) }).scopeLabel).toBeDefined();
    expect(validateIntake({ ...BASE, sourceUrl: "https://example.invalid/a" })).toEqual({});
  });
});

describe("buildTenderCreate", () => {
  it("maps a minimal form with null optionals and no basis", () => {
    expect(buildTenderCreate(BASE)).toEqual({
      title: "Servicio de limpieza",
      external_id: "2026/00009999X",
      contracting_body: "Ayuntamiento de Ejemplo",
      source_url: null,
      scope_label: null,
      basis: null,
    });
  });

  it("maps a full form through parsePrecioInput with EUR currency", () => {
    const payload = buildTenderCreate({
      ...BASE,
      sourceUrl: "https://example.invalid/anuncio",
      scopeLabel: "Lote único",
      pblNet: "118.336,50",
      pblGross: "126619.52",
      taxKind: "IGIC",
      periodMonths: "24",
    });
    expect(payload.source_url).toBe("https://example.invalid/anuncio");
    expect(payload.scope_label).toBe("Lote único");
    expect(payload.basis).toEqual({
      pbl_net: "118336.50",
      pbl_gross: "126619.52",
      tax_kind: "IGIC",
      period_months: 24,
      currency: "EUR",
    });
  });

  it("never infers tax from a single amount", () => {
    const payload = buildTenderCreate({ ...BASE, pblNet: "118336", taxKind: "unknown" });
    expect(payload.basis).toEqual({
      pbl_net: "118336.00",
      pbl_gross: null,
      tax_kind: "unknown",
      period_months: null,
      currency: "EUR",
    });
  });

  it("passes an explicit VAT choice through with a single amount", () => {
    const payload = buildTenderCreate({ ...BASE, pblGross: "100", taxKind: "VAT" });
    expect(payload.basis?.tax_kind).toBe("VAT");
    expect(payload.basis?.pbl_net).toBeNull();
    expect(payload.basis?.pbl_gross).toBe("100.00");
  });

  it("trims surrounding whitespace from text fields", () => {
    const payload = buildTenderCreate({
      ...BASE,
      title: "  Limpieza  ",
      externalId: " 2026/X ",
      contractingBody: " Pleno ",
      sourceUrl: "   ",
      scopeLabel: "  ",
    });
    expect(payload.title).toBe("Limpieza");
    expect(payload.external_id).toBe("2026/X");
    expect(payload.contracting_body).toBe("Pleno");
    expect(payload.source_url).toBeNull();
    expect(payload.scope_label).toBeNull();
  });
});
