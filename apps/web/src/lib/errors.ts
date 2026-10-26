// Frontend translation of API protocol codes to Spanish (copy-style-es:
// "Patrón de mensajes de error"). Structure: what happened (ES) + what to
// do (ES); the raw code stays in `title`/details, never as main text.

import { ApiError } from "../api/client";

/** Protocol code -> Spanish message with an action. Unknown codes fall through. */
export const ERROR_ES: Record<string, string> = {
  basis_not_approved: "La base de precio aún no está revisada. Pide su revisión antes de simular.",
  rule_not_approved: "La regla de precio aún no está revisada. No se puede simular hasta su revisión.",
  stale_revision: "Los datos cambiaron mientras trabajabas. Recarga la licitación e inténtalo de nuevo.",
  revision_conflict: "Los datos cambiaron mientras trabajabas. Recarga la licitación e inténtalo de nuevo.",
  discount_out_of_scope: "La baja está fuera del rango simulable (0–40 %). Ajusta el valor.",
  curve_out_of_scope: "La curva pedida está fuera del rango simulable. Ajusta los valores.",
  scope_not_found: "No se encontró el ámbito de esta licitación. Recarga la página.",
  company_not_found: "No se encontró la empresa demo. Vuelve a cargar el ejemplo desde la biblioteca.",
  document_bytes_unavailable:
    "El PDF original no se redistribuye; usa la fuente oficial y los extractos curados.",
  budget_exhausted: "Se agotó el presupuesto de análisis. No se ha enviado ningún documento.",
  job_not_found: "No se encontró el trabajo de análisis. Inténtalo de nuevo.",
  unknown_claim_key: "Hay un dato sin localizar en la interpretación. Pide una revisión.",
  requirements_tree_corrupt: "El árbol de requisitos está dañado. Pide una revisión.",
  money_unparseable: "Un importe no tiene el formato 1234.56. Corrige el valor.",
  forbidden: "No tienes permiso para esta acción.",
  invalid_response: "La API devolvió una respuesta inesperada. Reintenta cuando la API local responda.",
};

const GENERIC_ES = "No se pudo completar la acción. Reintenta cuando la API local responda.";

/** Main Spanish message for any thrown value. Never leaks protocol English. */
export function errorEs(error: unknown, fallback: string = GENERIC_ES): string {
  if (error instanceof ApiError) {
    const mapped = ERROR_ES[error.code];
    if (mapped) return mapped;
    const http = /^http_(\d+)$/.exec(error.code);
    if (http) return `La API devolvió un error (código ${http[1]}). ${fallback}`;
    return fallback;
  }
  return fallback;
}

/** Raw protocol code for `title`/details, or null when there is none. */
export function errorCode(error: unknown): string | null {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  return null;
}
