// Frontend translation of API protocol codes to Spanish (copy-style-es:
// "Patrón de mensajes de error"). Structure: what happened (ES) + what to
// do (ES); the raw code stays in `title`/details, never as main text.

import { ApiError } from "../api/client";

/** Protocol code -> Spanish message with an action. Unknown codes fall through. */
export const ERROR_ES: Record<string, string> = {
  basis_not_approved:
    "El presupuesto de salida aún no está revisado. Pide que lo revisen antes de simular.",
  rule_not_approved: "La fórmula de puntos aún no está revisada. No puedes simular hasta su revisión.",
  stale_revision: "Los datos cambiaron mientras trabajabas. Recarga la licitación e inténtalo de nuevo.",
  revision_conflict: "Los datos cambiaron mientras trabajabas. Recarga la licitación e inténtalo de nuevo.",
  discount_out_of_scope: "La rebaja está fuera del rango simulable (0–40 %). Ajusta el valor.",
  curve_out_of_scope: "La curva pedida está fuera del rango simulable. Ajusta los valores.",
  scope_not_found: "No encontramos el ámbito de esta licitación. Recarga la página.",
  company_not_found: "No encontramos la empresa de ejemplo. Vuelve a cargar el ejemplo desde la biblioteca.",
  document_bytes_unavailable:
    "No puedes descargar el PDF original desde aquí. Usa la fuente oficial.",
  budget_exhausted: "Se agotó el presupuesto de análisis. No hemos enviado ningún documento.",
  job_not_found: "No encontramos ese análisis. Inténtalo de nuevo.",
  unknown_claim_key: "Hay un dato sin localizar en esta licitación. Pide que lo revisen.",
  requirements_tree_corrupt: "La lista de requisitos está dañada. Pide que la revisen.",
  money_unparseable: "Tu importe no es válido (usa coma o punto, como 1234,56). Corrige el valor.",
  forbidden: "No tienes permiso para esta acción.",
  nothing_to_review: "Aún no hay nada que revisar. Pide el análisis o rellena el formulario.",
  remote_processing_not_allowed: "El análisis en vivo necesita tu permiso. Marca la casilla o revisa a mano.",
  rule_revision_conflict: "Otra revisión se te adelantó. Recarga la licitación e inténtalo de nuevo.",
  basis_budget_invalid: "El presupuesto debe ser mayor que cero. Corrige el valor.",
  rule_expression_invalid: "La fórmula no es válida. Elige otra e inténtalo de nuevo.",
  rule_scope_mismatch: "El ámbito no es de esta licitación. Recarga la página.",
  invalid_response: "La aplicación devolvió una respuesta inesperada. Vuelve a intentarlo en unos segundos.",
};

const GENERIC_ES = "No pudimos completar la acción. Vuelve a intentarlo en unos segundos.";

/** Main Spanish message for any thrown value. Never leaks protocol English. */
export function errorEs(error: unknown, fallback: string = GENERIC_ES): string {
  if (error instanceof ApiError) {
    const mapped = ERROR_ES[error.code];
    if (mapped) return mapped;
    const http = /^http_(\d+)$/.exec(error.code);
    if (http) return `La aplicación devolvió un error (código ${http[1]}). ${fallback}`;
    return fallback;
  }
  return fallback;
}

/** Raw protocol code for `title`/details, or null when there is none. */
export function errorCode(error: unknown): string | null {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  return null;
}
