import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { EvidenceDrawer, type EvidenceTarget } from "../evidence/EvidenceDrawer";

interface Props {
  workspace: Workspace;
}

export function verdictEs(verdict: string): string {
  if (verdict === "met") return "Cumple";
  if (verdict === "not_met") return "No cumple";
  return "Por verificar · unknown";
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

/** Data-driven link: leaf threshold -> claim with equal normalized value -> its citations. */
export function citationsForLeaf(workspace: Workspace, leaf: RequirementLeaf): Citation[] {
  if (leaf.threshold == null) return [];
  const needle = leaf.threshold.trim();
  if (!needle) return [];
  const matches: Citation[] = [];
  for (const claim of workspace.claims) {
    if (claim.normalized_value == null) continue;
    const same = Number(claim.normalized_value) === Number(needle) && claim.normalized_value.trim() !== "";
    if (!same) continue;
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
  }
  return matches;
}

export function requirementTestId(leafId: string): string | undefined {
  if (leafId === "req-tech-amount") return "requirement-tech-services";
  return undefined;
}

export function RequirementsTab({ workspace }: Props) {
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);
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
      <p role="status" className="rounded-xl bg-white p-4 shadow-sm">
        Carga el ejemplo desde la biblioteca para evaluar los requisitos con la empresa demo.
      </p>
    );
  }

  return (
    <section aria-label="Matriz de requisitos" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Requisitos y elegibilidad</h2>
      {companyQuery.isPending || eligibilityQuery.isPending ? (
        <p className="mt-2 text-sm" role="status">
          Evaluando requisitos con la revisión de empresa…
        </p>
      ) : null}
      {companyQuery.isError || eligibilityQuery.isError ? (
        <p role="alert" className="mt-2 text-sm text-[#B42318]">
          No se pudo evaluar la elegibilidad. Reintenta cuando la API local responda.
        </p>
      ) : null}
      {eligibilityQuery.data && (
        <p className="mt-2 text-sm" data-testid="eligibility-summary">
          Resultado global: <strong>{verdictEs(eligibilityQuery.data.verdict)}</strong> · evaluados{" "}
          {eligibilityQuery.data.assessed_count} de{" "}
          {eligibilityQuery.data.assessed_count + eligibilityQuery.data.unassessed_count}
          {eligibilityQuery.data.hypothetical_company ? " · empresa sintética (hipótesis)" : ""}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="border-b border-[#C9D2E8] p-2">Requisito</th>
              <th className="border-b border-[#C9D2E8] p-2">Grupo</th>
              <th className="border-b border-[#C9D2E8] p-2">Umbral</th>
              <th className="border-b border-[#C9D2E8] p-2">Resultado empresa</th>
              <th className="border-b border-[#C9D2E8] p-2">Evidencia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ leaf, groupLabel }) => {
              const item = verdictById.get(leaf.id);
              const citations = citationsForLeaf(workspace, leaf);
              return (
                <tr key={leaf.id} data-testid={requirementTestId(leaf.id)} data-requirement-id={leaf.id}>
                  <td className="border-b border-[#E5E9F2] p-2 font-medium">{leaf.label}</td>
                  <td className="border-b border-[#E5E9F2] p-2">{groupLabel || "—"}</td>
                  <td className="tnum border-b border-[#E5E9F2] p-2">
                    {leaf.threshold ?? "manual"}
                    {leaf.unit ? ` ${leaf.unit}` : ""}
                  </td>
                  <td className="border-b border-[#E5E9F2] p-2">
                    {item ? (
                      <>
                        <strong>{verdictEs(item.verdict)}</strong>
                        {item.reason_codes.length > 0 && (
                          <span className="block text-xs text-[#3A4560]">{item.reason_codes.join(", ")}</span>
                        )}
                      </>
                    ) : (
                      "…"
                    )}
                  </td>
                  <td className="border-b border-[#E5E9F2] p-2">
                    {citations.length === 0 ? (
                      <span className="text-[#3A4560]">Sin citas vinculadas</span>
                    ) : (
                      <span className="flex flex-wrap gap-2">
                        {citations.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setEvidence({ citation: c })}
                            className="rounded-lg border border-[#3159D9] px-2 py-1 text-[#3159D9]"
                            aria-label={`Ver evidencia ${c.id}, página ${c.page_number}`}
                          >
                            p. {c.page_number}
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[#3A4560]">
        El resultado se refiere solo a requisitos revisados y evidencias acreditadas de esta empresa. Los grupos
        OR/AND se pliegan con lógica trivaluada en el backend.
      </p>

      {evidence && (
        <EvidenceDrawer workspace={workspace} target={evidence} onClose={() => setEvidence(null)} />
      )}
    </section>
  );
}
