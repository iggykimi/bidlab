// Own-tender detection and recorrido gating (pure logic, no React).
// An own tender is one you created in intake: the backend stores
// feed_id="local" and atom_id=tender_id (services/intake.py), served as
// source_id, while curated seeds carry feed URLs. No approved pricing
// rule also gates, so a tender that lost its rule asks for review first.

import type { PricingRule, Tender, Workspace } from "../../api/client";
import type { StoredSession } from "../../lib/session";

export function isOwnTender(tender: Pick<Tender, "id" | "source_id">): boolean {
  return tender.source_id === tender.id;
}

/** First approved pricing rule, or null when nothing is approved yet. */
export function approvedPricingRule(workspace: Pick<Workspace, "pricing_rules">): PricingRule | null {
  return workspace.pricing_rules.find((r) => r.review_status === "approved") ?? null;
}

/** Stable rule id for the manual review of an own tender. */
export function ruleIdFor(tenderId: string): string {
  return `${tenderId}-rule-1`;
}

/**
 * Next revision for a rule id (1 when new). The backend keys RuleRevision
 * by (rule_id, revision) and rejects duplicates (rule_revision_conflict),
 * so a second manual review must bump, never resend revision 1.
 */
export function nextRuleRevision(
  pricingRules: Pick<PricingRule, "id" | "revision">[],
  ruleId: string,
): number {
  let max = 0;
  for (const rule of pricingRules) {
    if (rule.id === ruleId && Number.isInteger(rule.revision) && rule.revision > max) {
      max = rule.revision;
    }
  }
  return max + 1;
}

/** True when the session points at this tender with your own company. */
export function hasOwnCompany(
  session: StoredSession | null,
  tenderId: string,
): boolean {
  return session !== null && session.mode === "manual" && session.tender_id === tenderId;
}

export interface OwnChecklist {
  company: boolean;
  review: boolean;
  simulated: boolean;
}

/** Empresa -> Revisar -> Simular state for the Resumen checklist. */
export function ownChecklist(input: {
  workspace: Pick<Workspace, "pricing_rules">;
  session: StoredSession | null;
  tenderId: string;
  hasSavedCopy: boolean;
}): OwnChecklist {
  return {
    company: hasOwnCompany(input.session, input.tenderId),
    review: approvedPricingRule(input.workspace) !== null,
    simulated: input.hasSavedCopy,
  };
}

/** Job status -> Spanish label. Unknown codes pass through honestly. */
export function jobStatusEs(status: string): string {
  switch (status) {
    case "queued":
      return "En cola";
    case "running":
      return "En marcha";
    case "succeeded":
      return "Lista";
    case "needs_review":
      return "Lista para revisar";
    case "failed":
      return "Falló";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

/** Terminal job states stop the tracker polling. */
export function isTerminalJobStatus(status: string): boolean {
  return status === "succeeded" || status === "needs_review" || status === "failed" || status === "cancelled";
}

/**
 * Offline/stub warnings -> honest Spanish. Unknown warnings pass through
 * verbatim: inventing a translation would hide what the server said.
 */
export function jobWarningEs(warning: string): string {
  if (warning.startsWith("fixture_stub:")) {
    return "Sin propuestas automáticas; revisa a mano.";
  }
  if (warning.startsWith("demo: proposal is empty")) {
    return "La propuesta viene vacía; revísala a mano.";
  }
  const partial = /^document (.+): (\d+) of (\d+) pages submitted to Meta \(partial coverage\)$/;
  const matchPartial = warning.match(partial);
  if (matchPartial) {
    return `Documento ${matchPartial[1]}: se enviaron ${matchPartial[2]} de ${matchPartial[3]} páginas a Meta. Cobertura parcial.`;
  }
  const local = /^document (.+): (\d+) of (\d+) page records available for local extraction$/;
  const matchLocal = warning.match(local);
  if (matchLocal) {
    return `Documento ${matchLocal[1]}: hay registros locales de ${matchLocal[2]} de ${matchLocal[3]} páginas.`;
  }
  return warning;
}
