// Intake step 2: upload error mapping, client-side prechecks and file state.
// Server codes map to plain Spanish; the raw code stays in `title` only.

import { ApiError, type TenderDocument } from "../../api/client";

/** Visible per-file states from the screen spec. No invented percent. */
export type UploadState = "recibido" | "leyendo" | "requiere revisión" | "error";

const UPLOAD_ES: Record<string, string> = {
  upload_not_pdf: "Ese archivo no es un PDF válido. Elige otro PDF.",
  unsupported_media: "Ese archivo no es un PDF válido. Elige otro PDF.",
  upload_too_large: "El archivo supera el tamaño máximo. Prueba con uno más ligero.",
  pdf_too_large: "El archivo supera el tamaño máximo. Prueba con uno más ligero.",
  pdf_too_many_pages: "El PDF tiene demasiadas páginas. Prueba con uno más corto.",
  pdf_unreadable: "No pudimos leer ese PDF. Prueba con otra copia.",
  pdf_no_pages: "Ese PDF no tiene páginas legibles. Prueba con otra copia.",
  pdf_page_unreadable: "No pudimos leer una página del PDF. Prueba con otra copia.",
  document_duplicate: "Ya recibimos este documento. Puedes continuar sin subirlo de nuevo.",
  tender_not_found: "No encontramos tu licitación. Vuelve a la biblioteca e inténtalo de nuevo.",
};

const FALLBACK_ES = "No pudimos subir tu documento. Tu licitación sigue intacta.";

/** Main Spanish message for any upload failure. Never leaks protocol English. */
export function uploadErrorEs(error: unknown, fallback: string = FALLBACK_ES): string {
  if (error instanceof ApiError) {
    const mapped = UPLOAD_ES[error.code];
    if (mapped) return mapped;
    const http = /^http_(\d+)$/.exec(error.code);
    if (http) return `La aplicación devolvió un error (código ${http[1]}). ${fallback}`;
    return fallback;
  }
  return fallback;
}

/**
 * Client-side precheck against the backend caps. Returns a plain-Spanish
 * error or null when the file may be sent. A null cap skips the size
 * check; the server still validates.
 */
export function precheckFile(file: File, maxBytes: number | null): string | null {
  const pdfName = file.name.toLowerCase().endsWith(".pdf");
  const pdfType = file.type === "application/pdf";
  if (!pdfName && !pdfType) {
    return "Ese archivo no parece un PDF. Elige uno con extensión .pdf.";
  }
  if (maxBytes !== null && file.size > maxBytes) {
    return "Ese archivo supera el tamaño máximo. Prueba con uno más ligero.";
  }
  return null;
}

/** Backend parse status -> visible per-file state. */
export function parseStatusToState(parseStatus: TenderDocument["parse_status"]): UploadState {
  if (parseStatus === "needs_review") return "requiere revisión";
  if (parseStatus === "failed") return "error";
  if (parseStatus === "queued") return "leyendo";
  return "recibido";
}

/**
 * Intake-local byte size for display ("2,4 MB"). lib/format is outside
 * this task's file ownership, so the helper lives here.
 */
export function formatBytesEs(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const comma = (n: number): string => n.toFixed(1).replace(".", ",");
  if (bytes < 1024 * 1024) return `${comma(bytes / 1024)} KB`;
  return `${comma(bytes / (1024 * 1024))} MB`;
}
