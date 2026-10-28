// Pure helpers for the live proposal review: human labels for claim
// keys and citation joins. Tested in proposalClaims.test.ts.

import type { Citation, CitationProposal, ClaimProposal } from "../../api/client";

/** Known extractor keys -> Spanish label; unknown keys show verbatim. */
const CLAIM_LABELS: Record<string, string> = {
  pbl_net: "Presupuesto sin impuestos",
  pbl_gross: "Presupuesto con impuestos",
  estimated_value: "Valor estimado",
  initial_duration_months: "Duración inicial",
  price_points: "Puntos por precio",
  presupuesto_base_licitacion: "Presupuesto base de licitación",
  duracion_contrato: "Duración del contrato",
  puntuacion_oferta_economica: "Puntos por oferta económica",
};

export function claimLabel(key: string): string {
  return CLAIM_LABELS[key] ?? key;
}

export function confidenceEs(confidence: string): string {
  if (confidence === "high") return "alta";
  if (confidence === "medium") return "media";
  return "baja";
}

export function claimStatusEs(status: string): string | null {
  if (status === "proposed") return null;
  if (status === "not_found") return "No lo encuentra en el documento.";
  if (status === "ambiguous") return "El documento lo dice de varias formas.";
  return "Tu pliego no trae este dato.";
}

export interface JoinedCitation {
  proposal: CitationProposal;
  /** Verified stored citation when the page matches, else null. */
  verified: Citation | null;
}

/** Join proposal citations with verified stored rows by doc + page. */
export function joinClaimCitations(
  claim: ClaimProposal,
  stored: Citation[]
): JoinedCitation[] {
  return claim.citations.map((proposal) => ({
    proposal,
    verified:
      stored.find(
        (c) => c.document_id === proposal.document_id && c.page_number === proposal.page_number
      ) ?? null,
  }));
}
