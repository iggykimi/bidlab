// Presentación de las cifras de una respuesta. Solo formato: el valor es la
// cadena exacta que devolvió una herramienta de BidLab.

import type { AssistantFigure } from "../../api/client";
import { formatEurosExact, formatPercent, formatPoints1 } from "../../lib/format";
import { anomalyVerdictEs } from "../pricing/sources";

const ELIGIBILITY_ES: Record<string, string> = {
  met: "Cumples",
  not_met: "No cumples",
  unknown: "Sin determinar",
};

export function figureValueEs(figure: AssistantFigure): string {
  switch (figure.unit) {
    case "eur":
      return formatEurosExact(figure.value);
    case "points":
      return `${formatPoints1(figure.value)} puntos`;
    case "rate":
      return formatPercent(figure.value);
    case "anomaly":
      return anomalyVerdictEs(figure.value);
    case "eligibility":
      return ELIGIBILITY_ES[figure.value] ?? "Sin determinar";
    case "text":
      return figure.value;
  }
}

export function figureSourceEs(figure: AssistantFigure): string {
  if (figure.source === "engine") return "Calculado por BidLab";
  return figure.page !== null ? `Pliego, p. ${figure.page}` : "Pliego";
}
