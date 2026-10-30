// Intake import from the Plataforma de Contratación: plain-Spanish copy for
// server codes and per-document reasons. The raw code stays in `title`.

import { ApiError, type ImportedDocument } from "../../api/client";

const IMPORT_ES: Record<string, string> = {
  unsupported_url:
    "Ese enlace no sirve. En la ficha de la licitación, copia el «Enlace a la licitación» y pégalo aquí.",
  not_found: "No encontramos esa licitación en la Plataforma. Revisa que el enlace esté completo.",
  source_unavailable: "La Plataforma no responde ahora. Prueba en unos minutos o créala a mano.",
  document_too_large:
    "El pliego pasa de 20 MB o de 120 páginas. Créala a mano y sube un PDF más corto.",
  no_documents: "Esta licitación aún no tiene pliegos en PDF. Créala a mano y añade el PDF después.",
  pdf_unreadable: "No pudimos leer el pliego de la Plataforma. Créala a mano y sube tu copia.",
  pdf_no_pages: "No pudimos leer el pliego de la Plataforma. Créala a mano y sube tu copia.",
  pdf_page_unreadable: "No pudimos leer el pliego de la Plataforma. Créala a mano y sube tu copia.",
  upload_not_pdf: "El pliego de la Plataforma no es un PDF. Créala a mano y sube tu copia.",
};

// Finer copy when the server says why the link was refused.
const UNSUPPORTED_DETAIL_ES: Record<string, string> = {
  portal_session_url:
    "Ese es el enlace de la barra del navegador. En la ficha, copia el «Enlace a la licitación».",
  numeric_id_not_resolvable:
    "Con ese número no podemos encontrarla. Pega el enlace completo de la ficha.",
};

const FALLBACK_ES = "No pudimos importar la licitación. Vuelve a intentarlo o créala a mano.";

/** Main Spanish message for an import failure. Never leaks protocol English. */
export function importErrorEs(error: unknown): string {
  if (!(error instanceof ApiError)) return FALLBACK_ES;
  if (error.code === "unsupported_url") {
    const specific = error.details.map((d) => UNSUPPORTED_DETAIL_ES[d]).find(Boolean);
    if (specific) return specific;
  }
  return IMPORT_ES[error.code] ?? FALLBACK_ES;
}

const KIND_ES: Record<ImportedDocument["kind"], string> = {
  pcap: "Pliego de cláusulas administrativas",
  ppt: "Pliego técnico",
  other: "Otro documento",
};

export function documentKindEs(kind: ImportedDocument["kind"]): string {
  return KIND_ES[kind];
}

const REASON_ES: Record<NonNullable<ImportedDocument["reason"]>, string> = {
  not_requested: "No lo descargamos.",
  too_large: "Es muy grande para descargarlo aquí.",
  too_many_pages: "Tiene más de 120 páginas.",
  not_pdf: "No es un PDF.",
  unreadable: "No pudimos leerlo.",
  other_host: "Está en otra web.",
  hash_mismatch: "No coincide con la copia publicada.",
  download_failed: "No se pudo descargar ahora.",
};

/** Why a listed document stayed on the Plataforma. */
export function documentReasonEs(reason: ImportedDocument["reason"]): string {
  return reason ? REASON_ES[reason] : "No lo descargamos.";
}
