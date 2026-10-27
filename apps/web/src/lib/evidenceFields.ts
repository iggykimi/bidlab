// Claves técnicas de datos de empresa -> etiquetas humanas (J1 P1-2).
// La app muestra la etiqueta; la clave viaja solo en el protocolo.

export interface EvidenceFieldOption {
  key: string;
  label: string;
}

export const EVIDENCE_FIELD_OPTIONS: EvidenceFieldOption[] = [
  { key: "annual_turnover_best_3y_net", label: "Volumen anual (mejor de 3 años)" },
  { key: "professional_insurance_net", label: "Seguro profesional" },
  { key: "net_worth_net", label: "Patrimonio neto" },
  { key: "annual_similar_services_best_3y_net", label: "Servicios similares (mejor de 3 años)" },
  { key: "team_feder_years", label: "Años de equipo FEDER" },
];

export function isKnownEvidenceKey(key: string): boolean {
  return EVIDENCE_FIELD_OPTIONS.some((o) => o.key === key);
}

/** Human label for lists; unknown keys pass through (never blank). */
export function labelForEvidenceKey(key: string): string {
  return EVIDENCE_FIELD_OPTIONS.find((o) => o.key === key)?.label ?? key;
}
