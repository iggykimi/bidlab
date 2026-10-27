// Backend assumption -> plain Spanish sentence. The closed set mirrors
// evaluation.py; unknown strings pass through (never raw codes).

import { formatEurosHeadline } from "./format";

/** Backend assumption -> plain sentence (uxgaps C13, exact strings). */
const ASSUMPTION_ES: Record<string, string> = {
  "Precios rivales hipotéticos": "Precios de rivales inventados por ti para probar",
  "Conjunto rival sin calificar": "Rivales de prueba, por verificar",
  "Conjunto completo supuesto": "Das por hecho que estos son todos los rivales",
  "Conjunto incompleto: puntuación sin determinar":
    "Das por hecho parte de los rivales: tus puntos están sin determinar",
  "Grupos independientes supuestos": "Das por hecho que ningún rival es del mismo grupo",
  "Pertenencia a grupos sin confirmar: anormalidad sin determinar":
    "Sin confirmar grupos: aún no sabemos si tu oferta parece sospechosa",
  "Sin coste computable: beneficio y margen sin determinar":
    "Sin tu coste real no podemos calcular tu beneficio",
};

/**
 * Plain assumption text. The demo-cost line carries the backend total via the
 * canonical headline formatter (display only, never recomputed); unknown
 * strings pass through.
 */
export function assumptionEs(text: string, costNet: string | null, noRivals = false): string {
  if (noRivals && text === "Conjunto incompleto: puntuación sin determinar") {
    return "Vas sin rivales: tus puntos están sin determinar";
  }
  if (text === "Coste de empresa sintética") {
    return costNet === null
      ? "Coste inventado para practicar"
      : `Coste inventado para practicar (${formatEurosHeadline(costNet)})`;
  }
  return ASSUMPTION_ES[text] ?? text;
}
