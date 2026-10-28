// Plain-Spanish display strings for pliego citations (ux-review §3,
// uxgaps C7/C9/C11). cit-* identifiers never reach the UI: known ids map to
// their review-table names and unknown ids or statuses fall back to neutral
// labels, never raw codes.

/** cit-* id -> plain name (external review §3 table). */
export const CITATION_ES: Record<string, string> = {
  "cit-turnover_threshold": "Volumen de negocio exigido",
  "cit-insurance_threshold": "Seguro exigido",
  "cit-technical_services_threshold": "Experiencia exigida en servicios técnicos",
  "cit-estimated_value": "Valor estimado del contrato",
  "cit-pbl_gross": "Presupuesto con IGIC",
  "cit-initial_duration_months": "Duración inicial",
  "cit-price_points": "Puntos por precio",
  "cit-anomaly_single_discount_gt": "Cuándo una oferta se considera sospechosa (un licitador)",
  "cit-anomaly_two_discount_gt": "Cuándo una oferta se considera sospechosa (dos licitadores)",
};

/** Plain name for a citation id. Unknown ids stay generic, never raw. */
export function citationName(id: string): string {
  return CITATION_ES[id] ?? "Dato del pliego";
}

const TEXTO_ES: Record<string, string> = {
  exact: "Copiado tal cual",
  normalized_match: "Equivalente",
  missing: "No encontrado",
  manual_visual: "Localizado a mano",
};

/** Citation match status -> "Texto" column value (uxgaps C9). */
export function textoEs(status: string): string {
  return TEXTO_ES[status] ?? "Sin determinar";
}

const FUENTE_ES: Record<string, string> = {
  exact: "texto idéntico",
  normalized_match: "texto equivalente",
  missing: "texto sin localizar",
  manual_visual: "texto localizado a mano",
};

/** Citation match status -> Informe "Fuentes" fragment (uxgaps C11). */
export function fuenteEs(status: string): string {
  return FUENTE_ES[status] ?? "texto sin localizar";
}
