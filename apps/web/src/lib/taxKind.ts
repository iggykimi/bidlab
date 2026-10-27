/** Scope tax, named only. The rate itself is never quoted in the main view. */
export function nombreImpuesto(taxKind: string): string {
  if (taxKind === "IGIC") return "IGIC";
  if (taxKind === "VAT") return "IVA";
  return "impuestos";
}
