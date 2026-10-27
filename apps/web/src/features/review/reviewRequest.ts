// Manual ReviewRequest builder for own tenders (pure logic, no React).
// The form collects budget, period, formula template, max points, anomaly
// variant + two flags, and a reason; this module turns them into the
// contract payload (ReviewRequest in docs/API_CONTRACT.yaml) with the
// canonical AST from lib/expressionTemplates. No arithmetic here.

import type { PriceBasis, ReviewRequest } from "../../api/client";
import { templateExpression, type TemplateId } from "../../lib/expressionTemplates";

export type AnomalyVariant = "tias_18_5" | "alfresco_18_5" | "rglcap85_standard" | "unsupported";

export const ANOMALY_VARIANTS: AnomalyVariant[] = [
  "tias_18_5",
  "alfresco_18_5",
  "rglcap85_standard",
  "unsupported",
];

/** Plain question + explanation per anomaly variant (≤20 words each). */
export const ANOMALY_COPY: Record<AnomalyVariant, { question: string; plain: string }> = {
  tias_18_5: {
    question: "¿Tu pliego compara tu oferta con la media?",
    plain: "Como el ejemplo Tías: tu oferta se mide contra la media de las ofertas.",
  },
  alfresco_18_5: {
    question: "¿Tu pliego compara sin el tope de tres ofertas?",
    plain: "Igual que la anterior, pero sin el tope especial cuando hay tres ofertas.",
  },
  rglcap85_standard: {
    question: "¿Tu pliego sigue la regla estándar del reglamento?",
    plain: "La regla general del artículo 85 para detectar ofertas sospechosamente bajas.",
  },
  unsupported: {
    question: "¿Tu pliego no trae esta regla?",
    plain: "No aplica: BidLab no calculará si tu oferta parece sospechosa.",
  },
};

/** Default n=3 absolute-25 flag per variant (backend anomaly.dispatch). */
export function defaultThreeBidderFlag(variant: AnomalyVariant): boolean {
  return variant === "tias_18_5";
}

/**
 * Spanish decimal input -> protocol decimal ("49" -> "49", "49,5" -> "49.5").
 * Max points are a free Decimal, not Money: any non-negative decimal goes.
 */
export function parseDecimalInput(raw: string): string | null {
  const clean = raw.replace(/[\s\u00A0\u202F]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  return clean.replace(/^0+(?=\d)/, "") || "0";
}

/** Period months input -> positive int, or null when unusable. */
export function parsePeriodInput(raw: string): number | null {
  const clean = raw.trim();
  if (!/^\d+$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

export interface ReviewFormInput {
  tenderId: string;
  scopeId: string;
  /** Protocol money ("118336.00") or null when the user left it blank. */
  budgetNet: string | null;
  periodMonths: number | null;
  /** Current scope basis: tax, unit and evidence carry over untouched. */
  existingBasis: PriceBasis;
  templateId: TemplateId;
  /** Protocol decimal ("49" or "49.5"). */
  maxPoints: string;
  anomalyVariant: AnomalyVariant;
  threeBidderAbsolute25: boolean;
  percentageReductionOneThird: boolean;
  /** Fresh interpretation revision from the workspace (the "latest" read). */
  expectedRevision: number;
  /** Next rule revision (1 for the first review; bump on later ones). */
  ruleRevision: number;
  reason: string;
}

/**
 * Form state -> ReviewRequest payload. Claim approvals and requirement
 * trees stay empty: this manual review only approves budget + formula.
 * The anomaly policy carries source_kind "unknown": you typed these
 * values, no citation locates them in the pliego.
 */
export function buildReviewRequest(input: ReviewFormInput): ReviewRequest {
  const basis = input.existingBasis;
  const ruleId = `${input.tenderId}-rule-1`;
  return {
    expected_revision: input.expectedRevision,
    approved_claim_keys: [],
    requirement_trees: [],
    scope_basis: {
      scope_id: input.scopeId,
      budget_net: input.budgetNet,
      ceiling_net: basis.ceiling_net,
      scoring_reference_net: basis.scoring_reference_net ?? input.budgetNet,
      reference_kind: basis.reference_kind !== "unknown" ? basis.reference_kind : input.budgetNet !== null ? "pbl" : "unknown",
      currency: "EUR",
      unit: basis.unit,
      period_months: input.periodMonths,
      tax_kind: basis.tax_kind,
      review_status: "approved",
      evidence_ids: basis.evidence_ids,
      metadata_evidence: basis.metadata_evidence,
    },
    pricing_rule: {
      id: ruleId,
      revision: input.ruleRevision,
      scope_id: input.scopeId,
      template_id: input.templateId,
      max_points: input.maxPoints,
      expression: templateExpression(input.templateId),
      review_status: "approved",
      zero_denominator_policy: "unknown",
      evidence_ids: [],
      anomaly_policy: {
        id: `${ruleId}-anomaly`,
        source_kind: "unknown",
        variant: input.anomalyVariant,
        review_status: "approved",
        three_bidder_absolute_25: input.threeBidderAbsolute25,
        percentage_reduction_one_third: input.percentageReductionOneThird,
        evidence_ids: [],
      },
    },
    corrected_proposal: null,
    actor: "usuario",
    reason: input.reason.trim(),
  };
}
