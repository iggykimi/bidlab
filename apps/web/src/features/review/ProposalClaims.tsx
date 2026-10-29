// Live proposal review: every extracted claim with its value and
// citations, accepted one by one. Nothing is pre-approved.
// T15: the citation line is the machine localization state and the
// checkbox is the human semantic review; the two never share wording.

import { useState } from "react";
import type { Citation, ClaimProposal, Workspace } from "../../api/client";
import { Button, Card } from "../../components/ui";
import { EvidenceDrawer, type EvidenceTarget } from "../evidence/EvidenceDrawer";
import {
  citaEstadoEs,
  canConfirmClaim,
  claimLabel,
  claimStatusEs,
  confidenceEs,
  joinClaimCitations,
} from "./claimHelpers";

interface Props {
  workspace: Workspace;
  approved: string[];
  onToggle: (key: string, checked: boolean) => void;
}

/** Lowercase first letter: "Copiado tal cual" -> "copiado tal cual". */
function minuscula(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function ProposalClaims({ workspace, approved, onToggle }: Props) {
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);
  const claims: ClaimProposal[] = workspace.claims ?? [];
  if (claims.length === 0) return null;
  const stored: Citation[] = workspace.citations ?? [];
  return (
    <Card aria-label="Propuestas automáticas">
      <h2>¿Qué datos confirmas?</h2>
      <p className="mt-1 text-sm text-muted">
        La máquina leyó tu documento. Marca solo lo que esté bien; lo demás se queda fuera.
      </p>
      <ul className="mt-3 grid gap-3">
        {claims.map((claim) => {
          const checked = approved.includes(claim.key);
          const confirmable = canConfirmClaim(claim, stored, workspace.documents);
          const statusNote = claimStatusEs(claim.status);
          return (
            <li key={claim.key} className="rounded-lg border border-line p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid={`claim-approve-${claim.key}`}
                  checked={checked}
                  disabled={!confirmable && !checked}
                  onChange={(e) => onToggle(claim.key, e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong>{claimLabel(claim.key)}</strong>
                  {claim.normalized_value !== null && claim.normalized_value !== undefined
                    ? `: ${String(claim.normalized_value)}${claim.unit ? ` ${claim.unit}` : ""}`
                    : claim.raw_value !== null && claim.raw_value !== undefined
                      ? `: ${String(claim.raw_value)}`
                      : ": sin valor"}
                  <span className="block text-xs text-muted">
                    Confianza {confidenceEs(claim.confidence)}.
                    {statusNote ? ` ${statusNote}` : ""}
                  </span>
                  <span className="block text-xs text-muted" data-testid={`claim-review-state-${claim.key}`}>
                    {checked && confirmable ? "Lo confirmas." : "Por verificar."}
                  </span>
                </span>
              </label>
              {joinClaimCitations(claim, stored).map((joined, i) => (
                <div key={i} className="mt-2 rounded-lg bg-surface p-2 text-sm">
                  <p className="text-xs text-muted">
                    {`Página ${joined.proposal.page_number} · Cita (${minuscula(citaEstadoEs(joined.verified?.match_status ?? null))})`}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    «{joined.proposal.verbatim_excerpt}»
                  </p>
                  {joined.verified && workspace.documents.some((doc) =>
                    doc.id === joined.verified?.document_id && doc.sha256 === joined.verified.document_sha256,
                  ) && (
                    <Button
                      variant="secondary"
                      className="mt-2"
                      onClick={() => joined.verified && setEvidence({ citation: joined.verified })}
                    >
                      Ver página {joined.proposal.page_number} en el documento
                    </Button>
                  )}
                </div>
              ))}
              {claim.citations.length === 0 && (
                <p className="mt-2 text-xs text-muted">Sin cita: revísalo en tu documento.</p>
              )}
              {!confirmable && (
                <p className="mt-2 text-sm text-alert">
                  Corrige las citas o el valor antes de confirmar este dato.
                  {checked ? " Desmarca esta confirmación para continuar con los demás datos." : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {evidence && (
        <EvidenceDrawer
          key={evidence.citation.id}
          workspace={workspace}
          target={evidence}
          onClose={() => setEvidence(null)}
        />
      )}
    </Card>
  );
}
