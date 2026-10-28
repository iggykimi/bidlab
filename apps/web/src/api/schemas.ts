// Boundary validation for the two API payloads the UI renders most.
// getWorkspace / evaluateScenario parse through these schemas; anything else
// fails closed as ApiError("invalid_response"), never as a half-rendered page.

import { z } from "zod";
import type { components } from "./generated";
import type {
  Citation,
  ConsistencyEvidence,
  ConsistencyFinding,
  ConsistencyReport,
  CurvePoint,
  EvaluationResult,
  PageText,
  PricingRule,
  RequirementGroup,
  RequirementLeaf,
  RequirementNode,
  Tender,
  Workspace,
} from "./client";

type Document = components["schemas"]["Document"];
type PriceBasis = components["schemas"]["PriceBasis"];
type Scope = components["schemas"]["Scope"];

const metadataEvidenceSchema = z.object({
  key: z.string(),
  source_url: z.string(),
  snapshot_sha256: z.string(),
  field_path: z.string(),
  raw_value: z.string(),
  source_updated_at: z.string(),
});

const priceBasisSchema: z.ZodType<PriceBasis> = z.object({
  scope_id: z.string(),
  budget_net: z.string().nullable(),
  ceiling_net: z.string().nullable(),
  scoring_reference_net: z.string().nullable(),
  reference_kind: z.enum(["pbl", "vec", "custom", "unknown"]),
  currency: z.enum(["EUR"]),
  unit: z.enum(["lump_sum", "unit_price", "percentage", "framework_cap", "unknown"]),
  period_months: z.number().nullable(),
  tax_kind: z.enum(["VAT", "IGIC", "other", "unknown"]),
  review_status: z.enum(["pending", "approved", "blocked"]),
  evidence_ids: z.array(z.string()),
  metadata_evidence: z.array(metadataEvidenceSchema),
});

const scopeSchema: z.ZodType<Scope> = z.object({
  id: z.string(),
  tender_id: z.string(),
  lot_id: z.string().nullable(),
  label: z.string(),
  basis: priceBasisSchema,
});

const tenderSchema: z.ZodType<Tender> = z.object({
  raw_snapshot_sha256: z.string(),
  metadata_evidence: z.array(metadataEvidenceSchema),
  id: z.string(),
  source_id: z.string(),
  source_url: z.string(),
  external_id: z.string(),
  title: z.string(),
  contracting_body: z.string(),
  cpv_codes: z.array(z.string()),
  status_raw: z.string(),
  source_updated_at: z.string(),
  deadline_literal: z.string().nullable(),
  deadline_at: z.string().nullable(),
  pbl_net: z.string().nullable(),
  pbl_gross: z.string().nullable(),
  estimated_value: z.string().nullable(),
  scopes: z.array(scopeSchema),
  quality_flags: z.array(z.string()),
});

const documentSchema: z.ZodType<Document> = z.object({
  id: z.string(),
  tender_id: z.string(),
  kind: z.enum(["pcap", "ppt", "other"]),
  display_name: z.string(),
  sha256: z.string(),
  pages_count: z.number(),
  source_url: z.string().nullable(),
  rights_status: z.enum(["research_only", "reviewed_for_demo", "redistribution_allowed", "unknown"]),
  parse_status: z.enum(["queued", "ready", "needs_review", "failed"]),
});

export const pageTextSchema: z.ZodType<PageText> = z.object({
  document_id: z.string(),
  page_number: z.number(),
  printed_label: z.string().nullable(),
  raw_text: z.string(),
  normalized_text: z.string(),
  text_sha256: z.string(),
  extractor_version: z.string(),
  quality_flags: z.array(z.string()),
});

const citationSchema: z.ZodType<Citation> = z.object({
  id: z.string(),
  document_id: z.string(),
  document_sha256: z.string(),
  page_number: z.number(),
  printed_label: z.string().nullable(),
  verbatim_excerpt: z.string(),
  match_status: z.enum(["exact", "normalized_match", "missing", "manual_visual"]),
  normalized_start: z.number().nullable(),
  normalized_end: z.number().nullable(),
  normalization_version: z.string(),
});

const citationProposalSchema = z.object({
  document_id: z.string(),
  page_number: z.number(),
  verbatim_excerpt: z.string(),
});

const claimProposalSchema = z.object({
  key: z.string(),
  raw_value: z.string().nullable(),
  normalized_value: z.string().nullable(),
  unit: z.string().nullable(),
  citations: z.array(citationProposalSchema),
  confidence: z.enum(["high", "medium", "low"]),
  status: z.enum(["proposed", "not_found", "ambiguous", "unsupported"]),
  notes: z.array(z.string()),
});

const requirementLeafSchema: z.ZodType<RequirementLeaf> = z.object({
  kind: z.enum(["leaf"]),
  id: z.string(),
  label: z.string(),
  company_field: z.enum([
    "annual_turnover_best_3y_net",
    "professional_insurance_net",
    "net_worth_net",
    "annual_similar_services_best_3y_net",
    "team_feder_years",
    "manual",
  ]),
  operator: z.enum(["gte", "lte", "eq", "contains", "manual"]),
  threshold: z.string().nullable(),
  unit: z.string().nullable(),
  review_status: z.enum(["pending", "approved", "blocked"]),
  evidence_ids: z.array(z.string()),
});

// Recursive: groups nest nodes. The lazy annotation keeps the type exact.
const requirementNodeSchema: z.ZodType<RequirementNode> = z.lazy(() =>
  z.union([requirementLeafSchema, requirementGroupSchema])
);

const requirementGroupSchema: z.ZodType<RequirementGroup> = z.object({
  kind: z.enum(["group"]),
  id: z.string(),
  label: z.string(),
  operator: z.enum(["AND", "OR"]),
  children: z.array(requirementNodeSchema),
});

type ExprNode =
  | { kind: "const"; value: string }
  | { kind: "var"; name: "own_price" | "best_price" | "reference_price" | "max_points" }
  | { kind: "call"; op: "add" | "sub" | "mul" | "div" | "min" | "max" | "log10"; args: ExprNode[] };

const exprSchema: z.ZodType<ExprNode> = z.lazy(() =>
  z.union([
    z.object({ kind: z.enum(["const"]), value: z.string() }),
    z.object({
      kind: z.enum(["var"]),
      name: z.enum(["own_price", "best_price", "reference_price", "max_points"]),
    }),
    z.object({
      kind: z.enum(["call"]),
      op: z.enum(["add", "sub", "mul", "div", "min", "max", "log10"]),
      args: z.array(exprSchema),
    }),
  ])
);

const anomalyPolicySchema = z.object({
  id: z.string(),
  source_kind: z.enum(["explicit_pcap", "verified_supplementary", "unknown"]),
  variant: z.enum(["tias_18_5", "alfresco_18_5", "rglcap85_standard", "unsupported"]),
  review_status: z.enum(["pending", "approved", "blocked"]),
  three_bidder_absolute_25: z.boolean(),
  percentage_reduction_one_third: z.boolean(),
  evidence_ids: z.array(z.string()),
});

const pricingRuleSchema: z.ZodType<PricingRule> = z.object({
  id: z.string(),
  revision: z.number(),
  scope_id: z.string(),
  template_id: z.enum(["proportional_inverse", "linear_discount", "log_ratio", "unsupported"]),
  max_points: z.string(),
  expression: exprSchema.nullable(),
  review_status: z.enum(["pending", "approved", "blocked"]),
  zero_denominator_policy: z.enum(["unknown"]),
  evidence_ids: z.array(z.string()),
  anomaly_policy: anomalyPolicySchema,
});

const consistencyEvidenceSchema: z.ZodType<ConsistencyEvidence> = z.object({
  observation_id: z.string(),
  document_id: z.string(),
  document_sha256: z.string(),
  physical_page: z.number(),
  verbatim_excerpt: z.string().nullable(),
  value: z.string().nullable(),
});

const consistencyFindingSchema: z.ZodType<ConsistencyFinding> = z.object({
  field: z.enum([
    "budget_net",
    "period_months",
    "max_price_points",
    "pricing_formula_literal",
    "anomaly_literal",
    "other_requirement",
  ]),
  same_document: z.boolean(),
  evidence_a: consistencyEvidenceSchema,
  evidence_b: consistencyEvidenceSchema,
  question: z.string(),
  synthetic: z.boolean(),
});

const consistencyReportSchema: z.ZodType<ConsistencyReport> = z.object({
  items: z.array(consistencyFindingSchema),
  synthetic_example: consistencyFindingSchema,
});

export const workspaceSchema: z.ZodType<Workspace> = z.object({
  tender: tenderSchema,
  interpretation_revision: z.number(),
  mode: z.enum(["demo", "live", "manual"]),
  documents: z.array(documentSchema),
  claims: z.array(claimProposalSchema),
  requirements: z.array(requirementNodeSchema),
  citations: z.array(citationSchema),
  pricing_rules: z.array(pricingRuleSchema),
  warnings: z.array(z.string()),
  consistency: consistencyReportSchema,
});

const scoreResultSchema = z.object({
  status: z.enum(["defined", "unknown", "unsupported"]),
  value: z.string().nullable(),
  max_points: z.string(),
  unknown_variables: z.array(z.string()),
  reason_codes: z.array(z.string()),
});

const anomalyResultSchema = z.object({
  status: z.enum([
    "unknown",
    "not_applicable",
    "possible_justification_required",
    "not_flagged_under_assumptions",
  ]),
  policy_id: z.string(),
  branch: z.string().nullable(),
  reference_mean_net: z.string().nullable(),
  threshold_net: z.string().nullable(),
  reference_offer_count: z.number(),
  reason_codes: z.array(z.string()),
});

const traceStepSchema = z.object({
  label: z.string(),
  expression: z.string(),
  value: z.string().nullable(),
});

const curvePointSchema: z.ZodType<CurvePoint> = z.object({
  discount_rate: z.string(),
  price_net: z.string(),
  profit_net: z.string().nullable(),
  margin_rate: z.string().nullable(),
  score: scoreResultSchema,
  anomaly_status: z.enum([
    "unknown",
    "not_applicable",
    "possible_justification_required",
    "not_flagged_under_assumptions",
  ]),
});

export const evaluationResultSchema: z.ZodType<EvaluationResult> = z.object({
  engine_version: z.string(),
  scope_id: z.string(),
  pricing_rule_id: z.string(),
  pricing_rule_revision: z.number(),
  company_revision: z.number(),
  price_net: z.string(),
  cost_net: z.string().nullable(),
  profit_net: z.string().nullable(),
  margin_rate: z.string().nullable(),
  score: scoreResultSchema,
  anomaly: anomalyResultSchema,
  assumptions: z.array(z.string()),
  trace: z.array(traceStepSchema),
  curve: z.array(curvePointSchema),
  source_hashes: z.array(z.string()),
  warnings: z.array(z.string()),
});

