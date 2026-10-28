// Pure copy for the incoherence radar (T20): Spanish labels for
// observation fields. Tested in radarCopy.test.ts.

import type { ConsistencyFinding } from "../../api/client";

export type ConsistencyField = ConsistencyFinding["field"];

const FIELD_LABELS: Record<ConsistencyField, string> = {
  budget_net: "Presupuesto sin impuestos",
  period_months: "Duración en meses",
  max_price_points: "Puntos máximos del precio",
  pricing_formula_literal: "Fórmula de puntos",
  anomaly_literal: "Anormalidad",
  other_requirement: "Otro requisito",
};

export function consistencyFieldLabel(field: ConsistencyField): string {
  return FIELD_LABELS[field];
}
