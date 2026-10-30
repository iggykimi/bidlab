// Engine request from the Pricing Lab draft. Shared by the simulator and by
// «Pregúntale al pliego», so both evaluate in the same context. No arithmetic:
// the discount is converted to the protocol rate string, figures stay server-side.

import type { EvaluationRequest, Workspace } from "../../api/client";
import { discountPercentToRate, parsePrecioInput } from "../../lib/format";
import type { Hypotheses } from "./hypotheses";

const CURVE_POINTS = 41;

interface RequestParts {
  scope: Workspace["tender"]["scopes"][number] | null;
  rule: Workspace["pricing_rules"][number] | null;
  companyId: string | null;
  companyRevision: number | undefined;
  h: Hypotheses;
}

/** Null until scope, rule and company are known; invalid prices pass through for the server to refuse. */
export function buildEvaluationRequest({
  scope,
  rule,
  companyId,
  companyRevision,
  h,
}: RequestParts): EvaluationRequest | null {
  if (!scope || !rule || !companyId || companyRevision === undefined) return null;
  // Spanish users write "106502,40"; the protocol wants "106502.40".
  const rivalANorm = h.noRivals ? "0.00" : parsePrecioInput(h.rivalAPrice);
  const rivalBNorm = h.noRivals ? "0.00" : parsePrecioInput(h.rivalBPrice);
  return {
    scope_id: scope.id,
    pricing_rule_id: rule.id,
    pricing_rule_revision: rule.revision,
    company_id: companyId,
    company_revision: companyRevision,
    discount_rate: discountPercentToRate(h.discountPct),
    rivals: h.noRivals
      ? { state: "unspecified", complete: false, group_membership_confirmed: false, own_group_id: null, offers: [] }
      : {
          state: h.rivalState,
          complete: h.complete,
          group_membership_confirmed: h.groupsConfirmed,
          own_group_id: h.ownGroup || null,
          offers: [
            { label: "Rival A", price_net: rivalANorm ?? h.rivalAPrice, group_id: h.rivalAGroup || null },
            { label: "Rival B", price_net: rivalBNorm ?? h.rivalBPrice, group_id: h.rivalBGroup || null },
          ],
        },
    curve: { from_discount_rate: "0.0000", to_discount_rate: "0.4000", points: CURVE_POINTS },
  };
}
