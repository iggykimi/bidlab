import type { Citation, ClaimProposal, Job, TenderDocument } from "../../api/client";

/**
 * Cobertura documental BL-V2-07 (§9): qué páginas respaldan propuestas y
 * cuántas se enviaron al modelo. Sin backend nuevo (§22.4): el manifiesto
 * por página vive solo en el servidor, así que la UI muestra lo que sabe
 * (citas + contadores del trabajo) con descripciones exactas. Nunca
 * inventa confirmadas ni porcentajes.
 */
export interface DocumentCoverage {
  document: TenderDocument;
  /** Páginas citadas por propuestas o citas aprobadas, únicas y ordenadas. */
  citedPages: number[];
}

export interface CoverageModel {
  documents: DocumentCoverage[];
  /** Páginas enviadas al modelo según el trabajo seguido, si lo hay. */
  delivered: { sent: number; total: number } | null;
  trackedJob: Job | null;
}

export interface CoverageInput {
  documents: TenderDocument[];
  claims: ClaimProposal[];
  citations: Citation[];
  trackedJob: Job | null;
}

export function buildCoverageModel(input: CoverageInput): CoverageModel {
  const byDoc = new Map<string, Set<number>>();
  for (const d of input.documents) byDoc.set(d.id, new Set());
  for (const c of input.claims) {
    for (const cit of c.citations) byDoc.get(cit.document_id)?.add(cit.page_number);
  }
  for (const cit of input.citations) {
    byDoc.get(cit.document_id)?.add(cit.page_number);
  }
  return {
    documents: input.documents.map((document) => ({
      document,
      citedPages: [...(byDoc.get(document.id) ?? [])].sort((a, b) => a - b),
    })),
    delivered:
      input.trackedJob === null
        ? null
        : { sent: input.trackedJob.processed_pages, total: input.trackedJob.total_pages },
    trackedJob: input.trackedJob,
  };
}
