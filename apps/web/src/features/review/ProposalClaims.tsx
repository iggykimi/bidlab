// Live proposal review: every extracted claim with its value and
// citations, accepted one by one. Nothing is pre-approved.

import type { Citation, ClaimProposal, Workspace } from "../../api/client";
import { Card } from "../../components/ui";
import { claimLabel, claimStatusEs, confidenceEs, joinClaimCitations } from "./claimHelpers";

interface Props {
  workspace: Workspace;
  approved: string[];
  onToggle: (key: string, checked: boolean) => void;
}

function matchEs(matchStatus: string): string {
  if (matchStatus === "exact") return "Copiado tal cual";
  if (matchStatus === "normalized_match") return "Coincide normalizado";
  if (matchStatus === "manual_visual") return "Verificación visual";
  return "Sin localizar";
}

export function ProposalClaims({ workspace, approved, onToggle }: Props) {
  const claims: ClaimProposal[] = workspace.claims ?? [];
  if (claims.length === 0) return null;
  const stored: Citation[] = workspace.citations ?? [];
  return (
    <Card aria-label="Propuestas automáticas">
      <h2 className="text-lg font-semibold">¿Qué datos confirmas?</h2>
      <p className="mt-1 text-sm text-muted">
        La máquina leyó tu documento. Marca solo lo que esté bien; lo demás se queda fuera.
      </p>
      <ul className="mt-3 grid gap-3">
        {claims.map((claim) => {
          const checked = approved.includes(claim.key);
          const statusNote = claimStatusEs(claim.status);
          return (
            <li key={claim.key} className="rounded-lg border border-line p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid={`claim-approve-${claim.key}`}
                  checked={checked}
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
                </span>
              </label>
              {joinClaimCitations(claim, stored).map((joined, i) => (
                <div key={i} className="mt-2 rounded-lg bg-surface p-2 text-sm">
                  <p className="text-xs text-muted">
                    Página {joined.proposal.page_number} ·{" "}
                    {joined.verified ? matchEs(joined.verified.match_status) : "Sin verificar"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    «{joined.proposal.verbatim_excerpt}»
                  </p>
                </div>
              ))}
              {claim.citations.length === 0 && (
                <p className="mt-2 text-xs text-muted">Sin cita: revísalo en tu documento.</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
