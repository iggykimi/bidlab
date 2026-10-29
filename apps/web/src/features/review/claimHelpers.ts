// Pure helpers for the live proposal review: human labels for claim
// keys and citation joins. Tested in proposalClaims.test.ts.

import type { Citation, CitationProposal, ClaimProposal, TenderDocument } from "../../api/client";

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

/** A different quote on the same page cannot lend its localization state. */
export function joinClaimCitations(
  claim: ClaimProposal,
  stored: Citation[]
): JoinedCitation[] {
  return claim.citations.map((proposal) => ({
    proposal,
    verified:
      stored.find(
        (c) => c.document_id === proposal.document_id &&
          c.page_number === proposal.page_number &&
          c.verbatim_excerpt === proposal.verbatim_excerpt
      ) ?? null,
  }));
}

/** UI guard only; the backend independently rechecks every source on approval. */
export function canConfirmClaim(
  claim: ClaimProposal,
  stored: Citation[],
  documents: TenderDocument[],
): boolean {
  if (claim.status !== "proposed" || claim.normalized_value === null || claim.normalized_value.trim() === "" || claim.citations.length === 0) {
    return false;
  }
  return joinClaimCitations(claim, stored).every(({ verified }) =>
    verified !== null &&
    (verified.match_status === "exact" || verified.match_status === "normalized_match") &&
    documents.some((doc) => doc.id === verified.document_id && doc.sha256 === verified.document_sha256),
  );
}

/**
 * Localization state of a claim citation in plain Spanish (T15).
 *
 * This is the machine match against the page text, never the human
 * semantic review (the approval checkbox owns that state). A null
 * status means no stored citation was located for the proposal.
 */
export function citaEstadoEs(matchStatus: string | null): string {
  if (matchStatus === "exact") return "Copiado tal cual";
  if (matchStatus === "normalized_match") return "Coincide normalizado";
  if (matchStatus === "manual_visual") return "Localizado a mano";
  return "Sin localizar";
}
