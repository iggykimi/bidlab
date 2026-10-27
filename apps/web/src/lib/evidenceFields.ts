// Claves técnicas de datos de empresa -> etiquetas humanas (J1 P1-2).
// La app muestra la etiqueta; la clave viaja solo en el protocolo.
// En la URL viaja el slug (J1 D3): legible y sin inglés.

export interface EvidenceFieldOption {
  key: string;
  label: string;
  slug: string;
}

export const EVIDENCE_FIELD_OPTIONS: EvidenceFieldOption[] = [
  { key: "annual_turnover_best_3y_net", label: "Volumen anual (mejor de 3 años)", slug: "volumen-anual" },
  { key: "professional_insurance_net", label: "Seguro profesional", slug: "seguro-profesional" },
  { key: "net_worth_net", label: "Patrimonio neto", slug: "patrimonio-neto" },
  {
    key: "annual_similar_services_best_3y_net",
    label: "Servicios similares (mejor de 3 años)",
    slug: "servicios-similares",
  },
  { key: "team_feder_years", label: "Años de equipo FEDER", slug: "anos-equipo-feder" },
];

export function isKnownEvidenceKey(key: string): boolean {
  return EVIDENCE_FIELD_OPTIONS.some((o) => o.key === key);
}

/** URL slug -> protocol key. Unknown slugs pass through as null (never blank). */
export function keyForEvidenceSlug(slug: string): string | null {
  return EVIDENCE_FIELD_OPTIONS.find((o) => o.slug === slug)?.key ?? null;
}

export function slugForEvidenceKey(key: string): string {
  return EVIDENCE_FIELD_OPTIONS.find((o) => o.key === key)?.slug ?? key;
}

/** Human label for lists; unknown keys pass through (never blank). */
export function labelForEvidenceKey(key: string): string {
  return EVIDENCE_FIELD_OPTIONS.find((o) => o.key === key)?.label ?? key;
}
