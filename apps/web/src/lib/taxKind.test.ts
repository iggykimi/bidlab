import { describe, expect, it } from "vitest";
import { nombreImpuesto } from "./taxKind";

describe("nombreImpuesto", () => {
  it("names IGIC and IVA, falling back to impuestos", () => {
    expect(nombreImpuesto("IGIC")).toBe("IGIC");
    expect(nombreImpuesto("VAT")).toBe("IVA");
    expect(nombreImpuesto("unknown")).toBe("impuestos");
    expect(nombreImpuesto("")).toBe("impuestos");
  });
});
