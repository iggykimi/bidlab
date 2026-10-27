import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  checkEligibility,
  getCompany,
  type Citation,
  type RequirementGroup,
  type RequirementLeaf,
  type RequirementNode,
  type Workspace,
} from "../../api/client";
import { loadSession } from "../../lib/session";
import { formatEUR } from "../../lib/format";
import { Button } from "../../components/ui";
import { TechnicalDetails } from "../../components/TechnicalDetails";
import { EvidenceDrawer, type EvidenceTarget } from "../evidence/EvidenceDrawer";

interface Props {
  workspace: Workspace;
}

export function verdictEs(verdict: string): string {
  if (verdict === "met") return "Cumple";
  if (verdict === "not_met") return "No cumple";
  return "Por verificar";
}

/** Eligibility reason code -> plain fragment (uxgaps C1, exact strings). */
const MOTIVO_ES: Record<string, string> = {
  value_meets_threshold: "tu cifra alcanza lo exigido",
  value_below_threshold: "tu cifra está por debajo de lo exigido",
  value_above_threshold: "tu cifra supera el máximo permitido",
  value_differs: "tu dato no coincide con lo exigido",
  text_found: "dato localizado",
  text_not_found: "dato no localizado",
  rule_not_approved: "aún sin revisar",
  manual_review_required: "tienes que comprobarlo a mano",
  missing_company_evidence: "tu empresa no aportó este dato",
  evidence_not_reviewed: "dato de tu empresa aún sin revisar",
  unit_mismatch: "las unidades no coinciden",
  insufficient_period: "el periodo acreditado es demasiado corto",
  missing_threshold: "falta el valor exigido",
  threshold_unparseable: "no pudimos leer el valor exigido",
  value_unparseable: "no pudimos leer el dato de tu empresa",
};

export function motivoEs(code: string): string {
  return MOTIVO_ES[code] ?? "sin determinar";
}

function unidadEs(unit: string): string {
  switch (unit) {
    case "months":
      return "meses";
    case "points":
      return "puntos";
    case "rate":
      return "%";
    default:
      return unit;
  }
}

/** Protocol threshold -> display (uxgaps C2); euros use the canonical formatter. */
function umbralEs(threshold: string | null | undefined, unit: string | null | undefined): string {
  if (threshold == null || threshold === "") return "Tienes que comprobarlo a mano";
  if (unit == null || unit === "EUR") return formatEUR(threshold);
  return `${threshold} ${unidadEs(unit)}`;
}

interface LeafRow {
  leaf: RequirementLeaf;
  groupLabel: string;
  depth: number;
}

function collectLeaves(node: RequirementNode, groupLabel: string, depth: number, out: LeafRow[]): RequirementGroup | null {
  if (node.kind === "leaf") {
    out.push({ leaf: node, groupLabel, depth });
    return null;
  }
  for (const child of node.children) collectLeaves(child, node.label, depth + 1, out);
  return node;
}

/**
 * Claim-key link: each requirement resolves its own claim by company_field.
 * Numeric matching is wrong here: turnover, insurance and estimated_value
 * share normalized 295840.00 with different meanings and pages (5, 6, 8).
 */
const CLAIM_KEY_BY_FIELD: Record<string, string> = {
  annual_turnover_best_3y_net: "turnover_threshold",
  professional_insurance_net: "insurance_threshold",
  annual_similar_services_best_3y_net: "technical_services_threshold",
};

export function citationsForLeaf(workspace: Workspace, leaf: RequirementLeaf): Citation[] {
  const key = CLAIM_KEY_BY_FIELD[leaf.company_field];
  if (!key) return [];
  const claim = workspace.claims.find((c) => c.key === key);
  if (!claim) return [];
  const matches: Citation[] = [];
  for (const proposal of claim.citations) {
    const full = workspace.citations.find(
      (c) =>
        c.document_id === proposal.document_id &&
        c.page_number === proposal.page_number &&
        (c.verbatim_excerpt === proposal.verbatim_excerpt ||
          proposal.verbatim_excerpt.startsWith(c.verbatim_excerpt.slice(0, 40)))
    );
    if (full && !matches.some((m) => m.id === full.id)) matches.push(full);
  }
  return matches;
}

export function requirementTestId(leafId: string): string | undefined {
  if (leafId === "req-tech-amount") return "requirement-tech-services";
  return undefined;
}

export function RequirementsTab({ workspace }: Props) {
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);
  const navigate = useNavigate();
  const session = loadSession();
  const scope = workspace.tender.scopes[0] ?? null;
  const companyId = session?.company_id ?? null;

  const companyQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: ({ signal }) => getCompany(companyId ?? "", signal),
    enabled: companyId !== null,
  });

  const companyRevision = companyQuery.data?.revision;
  const eligibilityQuery = useQuery({
    queryKey: ["eligibility", workspace.tender.id, scope?.id, companyId, companyRevision, workspace.interpretation_revision],
    queryFn: ({ signal }) =>
      checkEligibility(
        {
          tender_id: workspace.tender.id,
          scope_id: scope?.id ?? "",
          company_id: companyId ?? "",
          company_revision: companyRevision ?? 1,
          interpretation_revision: workspace.interpretation_revision,
        },
        signal
      ),
    enabled: companyId !== null && companyRevision !== undefined && workspace.interpretation_revision >= 1 && scope !== null,
  });

  const rows: LeafRow[] = [];
  const groups: RequirementGroup[] = [];
  for (const node of workspace.requirements) {
    const group = collectLeaves(node, "", 0, rows);
    if (group) groups.push(group);
  }

  const verdictById = new Map((eligibilityQuery.data?.items ?? []).map((i) => [i.requirement_id, i]));

  if (!session || !companyId) {
    return (
      <section aria-label="Requisitos" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <p role="status" className="text-sm">
          Para comprobar los requisitos, primero abre el ejemplo.
        </p>
        <Button onClick={() => navigate("/")} className="mt-3">
          Ir a la biblioteca
        </Button>
      </section>
    );
  }

  const assessed = eligibilityQuery.data?.assessed_count ?? 0;
  const total = assessed + (eligibilityQuery.data?.unassessed_count ?? 0);
  const rawReasons = [...new Set((eligibilityQuery.data?.items ?? []).flatMap((i) => i.reason_codes))];

  return (
    <section aria-label="Requisitos" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">¿Puedes presentarte?</h2>
      {companyQuery.isPending || eligibilityQuery.isPending ? (
        <p className="mt-2 text-sm" role="status">
          Comprobando si tu empresa cumple los requisitos…
        </p>
      ) : null}
      {companyQuery.isError || eligibilityQuery.isError ? (
        <div className="mt-2">
          <p role="alert" className="text-sm text-error">
            No pudimos comprobar si tu empresa cumple los requisitos. Comprueba tu conexión e
            inténtalo de nuevo.
          </p>
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => {
              companyQuery.refetch();
              eligibilityQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      ) : null}
      {eligibilityQuery.data && (
        <p className="mt-2 text-sm" data-testid="eligibility-summary">
          Resultado general: <strong>{verdictEs(eligibilityQuery.data.verdict)}</strong>. Hemos
          podido comprobar {assessed} de los {total} requisitos
          {eligibilityQuery.data.hypothetical_company
            ? " (datos de ejemplo de una empresa ficticia)."
            : "."}
        </p>
      )}

      <p className="mt-3 text-sm">Desliza a la derecha para ver más →</p>
      <div className="table-scroll mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className="border-b border-border p-2">
                Lo que te piden
              </th>
              <th scope="col" className="border-b border-border p-2">
                Dónde lo pone el pliego de condiciones (PCAP)
              </th>
              <th scope="col" className="border-b border-border p-2">
                Apartado
              </th>
              <th scope="col" className="border-b border-border p-2">
                Cuánto te piden
              </th>
              <th scope="col" className="border-b border-border p-2">
                Tu empresa
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted">
                  Esta licitación aún no tiene requisitos revisados.
                </td>
              </tr>
            )}
            {rows.map(({ leaf, groupLabel }) => {
              const item = verdictById.get(leaf.id);
              const citations = citationsForLeaf(workspace, leaf);
              const apartado = groupLabel.replace(/\bOR\b/g, "o").replace(/\bAND\b/g, "y");
              return (
                <tr key={leaf.id} data-testid={requirementTestId(leaf.id)} data-requirement-id={leaf.id}>
                  <td className="border-b border-line p-2 font-medium">{leaf.label}</td>
                  <td className="border-b border-line p-2">
                    {citations.length === 0 ? (
                      <span className="text-muted">Sin página del pliego localizada</span>
                    ) : (
                      <span className="flex flex-wrap gap-2">
                        {citations.map((c) => (
                          <Button
                            key={c.id}
                            variant="chip"
                            className="min-h-[48px]"
                            onClick={() => setEvidence({ citation: c })}
                            aria-label={`Ver página ${c.page_number} en el pliego`}
                          >
                            Ver página {c.page_number}
                          </Button>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-line p-2">{apartado || "—"}</td>
                  <td className="tnum border-b border-line p-2">
                    {umbralEs(leaf.threshold, leaf.unit)}
                  </td>
                  <td className="border-b border-line p-2">
                    {item ? (
                      <>
                        <strong>{verdictEs(item.verdict)}</strong>
                        {item.reason_codes.length > 0 && (
                          <span className="block text-xs text-muted">
                            {item.reason_codes.map(motivoEs).join("; ")}
                          </span>
                        )}
                      </>
                    ) : (
                      "…"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">
        Este resultado solo cuenta los requisitos ya comprobados. Cuando basta con cumplir una de
        varias opciones, con una es suficiente.
      </p>
      <p className="mt-2 text-sm text-muted">
        La empresa de ejemplo trae datos fijos. Si falta un dato, compruébalo a mano con tus
        cuentas.
      </p>
      <TechnicalDetails
        className="mt-3"
        items={[
          {
            label: "Requisitos evaluados",
            value: rows.map((r) => r.leaf.id).join(", ") || "ninguno",
          },
          {
            label: "Empresa evaluada",
            value:
              companyRevision !== undefined
                ? `${companyId} rev. ${companyRevision}`
                : String(companyId),
          },
          { label: "Revisión de interpretación", value: String(workspace.interpretation_revision) },
          { label: "Ámbito", value: scope?.id ?? "sin ámbito" },
          ...(rawReasons.length > 0
            ? [{ label: "Motivos internos", value: rawReasons.join(", ") }]
            : []),
        ]}
      />

      {evidence && (
        <EvidenceDrawer
          key={evidence.citation.id}
          workspace={workspace}
          target={evidence}
          onClose={() => setEvidence(null)}
        />
      )}
    </section>
  );
}
