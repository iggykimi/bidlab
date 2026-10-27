import { describe, expect, it } from "vitest";
import { assumptionEs } from "../../lib/assumptions";
import { pendienteEs } from "./ReportTab";

const squashSpace = (s: string) => s.replace(/\s/g, " ");

describe("assumptionEs", () => {
  it("maps every known backend assumption to its plain sentence", () => {
    expect(assumptionEs("Precios rivales hipotéticos", "90000.00")).toBe(
      "Precios de rivales inventados por ti para probar"
    );
    expect(assumptionEs("Conjunto rival sin calificar", "90000.00")).toBe(
      "Rivales de prueba, por verificar"
    );
    expect(assumptionEs("Conjunto completo supuesto", "90000.00")).toBe(
      "Das por hecho que estos son todos los rivales"
    );
    expect(assumptionEs("Grupos independientes supuestos", "90000.00")).toBe(
      "Das por hecho que ningún rival es del mismo grupo"
    );
    expect(
      assumptionEs("Pertenencia a grupos sin confirmar: anormalidad sin determinar", "90000.00")
    ).toBe("Sin confirmar grupos: aún no sabemos si tu oferta parece sospechosa");
    expect(
      assumptionEs("Sin coste computable: beneficio y margen sin determinar", null)
    ).toBe("Sin tu coste real no podemos calcular tu beneficio");
  });

  it("renders the demo-cost line with the backend total, never recomputed", () => {
    expect(squashSpace(assumptionEs("Coste de empresa sintética", "90000.00"))).toBe(
      "Coste inventado para practicar (90.000 €)"
    );
    expect(assumptionEs("Coste de empresa sintética", null)).toBe(
      "Coste inventado para practicar"
    );
  });

  it("maps the incomplete-set assumption to its plain sentence", () => {
    expect(assumptionEs("Conjunto incompleto: puntuación sin determinar", "90000.00")).toBe(
      "Das por hecho parte de los rivales: tus puntos están sin determinar"
    );
  });

  it("names the zero-rival mode instead of a partial set", () => {
    expect(assumptionEs("Conjunto incompleto: puntuación sin determinar", "90000.00", true)).toBe(
      "Vas sin rivales: tus puntos están sin determinar"
    );
  });

  it("passes unknown assumptions through untouched", () => {
    expect(assumptionEs("Algún supuesto futuro del motor", "90000.00")).toBe(
      "Algún supuesto futuro del motor"
    );
  });
});

describe("pendienteEs", () => {
  it("translates known parenthesised codes to plain Spanish", () => {
    expect(pendienteEs("Puntuación sin determinar (incomplete_rival_set): no usar para decidir")).toBe(
      "Puntos sin determinar (faltan ofertas rivales para calcularlos): no decidas con este dato"
    );
    expect(
      pendienteEs("Anormalidad sin determinar (group_membership_unconfirmed): conjunto insuficiente")
    ).toBe(
      "Oferta sospechosa sin determinar (sin confirmar si hay empresas del mismo grupo): tu conjunto es insuficiente"
    );
  });

  it("translates full backend pending strings to plain Spanish", () => {
    expect(pendienteEs("Puntuación no soportada: plantilla fuera del rango autorizado")).toBe(
      "Fórmula no soportada: tu fórmula queda fuera del rango autorizado"
    );
    expect(pendienteEs("Posible anormalidad: preparar justificación de costes")).toBe(
      "Tu oferta parece sospechosa: prepara la justificación de tus costes"
    );
    expect(
      pendienteEs("Coste de empresa sintética: sustituir por el coste real")
    ).toBe("Coste inventado: sustitúyelo por tu coste real");
    expect(pendienteEs("Conjunto rival incompleto: hipótesis parcial")).toBe(
      "Conjunto rival incompleto: supuesto parcial"
    );
    expect(pendienteEs("PDF original no redistribuido: verificado solo por extractos")).toBe(
      "No puedes descargar el PDF original: solo verás las citas."
    );
  });

  it("maps comma-joined code lists and known pricing codes", () => {
    expect(pendienteEs("X (incomplete_rival_set,group_membership_unconfirmed): y")).toBe(
      "X (faltan ofertas rivales para calcularlos; sin confirmar si hay empresas del mismo grupo): y"
    );
    expect(pendienteEs("X (incomplete_scenario): y")).toBe(
      "X (escenario incompleto: falta el conjunto completo de ofertas): y"
    );
  });

  it("drops unknown codes without leaving stray parentheses", () => {
    expect(pendienteEs("X (some_future_code): y")).toBe("X: y");
    expect(pendienteEs("X (): y")).toBe("X: y");
  });

  it("leaves non-code parentheses untouched", () => {
    expect(pendienteEs("Te falta revisar a mano: Patrimonio neto (ap.c) — manual")).toBe(
      "Te falta revisar a mano: Patrimonio neto (ap.c) — manual"
    );
    expect(pendienteEs("Coste inventado para practicar (90.000 €)")).toBe(
      "Coste inventado para practicar (90.000 €)"
    );
    expect(pendienteEs("Sin paréntesis")).toBe("Sin paréntesis");
  });
});
