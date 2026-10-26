import { describe, expect, it } from "vitest";
import { evaluationResultSchema, workspaceSchema } from "./schemas";

const tenderBase = {
  raw_snapshot_sha256: "snapshot",
  metadata_evidence: [],
  id: "t1",
  source_id: "s1",
  source_url: "https://example.invalid",
  external_id: "T/1",
  title: "T",
  contracting_body: "Ayto",
  cpv_codes: [],
  status_raw: "open",
  source_updated_at: "2026-10-25T00:00:00+00:00",
  deadline_literal: null,
  deadline_at: null,
  pbl_net: "118336.00",
  pbl_gross: null,
  estimated_value: null,
  scopes: [],
  quality_flags: [],
};

describe("schemas", () => {
  it("accepts a minimal workspace payload", () => {
    const parsed = workspaceSchema.safeParse({
      tender: tenderBase,
      interpretation_revision: 1,
      mode: "demo",
      documents: [],
      claims: [],
      requirements: [
        {
          kind: "group",
          id: "g",
          label: "G",
          operator: "AND",
          children: [
            {
              kind: "leaf",
              id: "req-1",
              label: "R",
              company_field: "manual",
              operator: "manual",
              threshold: null,
              unit: null,
              review_status: "approved",
              evidence_ids: [],
            },
          ],
        },
      ],
      citations: [],
      pricing_rules: [],
      warnings: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a workspace with a bad enum", () => {
    const parsed = workspaceSchema.safeParse({
      tender: tenderBase,
      interpretation_revision: 1,
      mode: "staging",
      documents: [],
      claims: [],
      requirements: [],
      citations: [],
      pricing_rules: [],
      warnings: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a minimal evaluation result", () => {
    const parsed = evaluationResultSchema.safeParse({
      engine_version: "1",
      scope_id: "scope",
      pricing_rule_id: "rule",
      pricing_rule_revision: 1,
      company_revision: 1,
      price_net: "112419.20",
      cost_net: "90000.00",
      profit_net: "22419.20",
      margin_rate: "0.1994",
      score: {
        status: "defined",
        value: "46.4211",
        max_points: "49.0000",
        unknown_variables: [],
        reason_codes: [],
      },
      anomaly: {
        status: "not_flagged_under_assumptions",
        policy_id: "tias-18-5",
        branch: "n3_no_trim",
        reference_mean_net: "109658.56",
        threshold_net: "98692.70",
        reference_offer_count: 3,
        reason_codes: [],
      },
      assumptions: [],
      trace: [{ label: "Precio de oferta", expression: "pbl * (1 - baja)", value: "112419.20" }],
      curve: [],
      source_hashes: [],
      warnings: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an evaluation result missing money fields", () => {
    const parsed = evaluationResultSchema.safeParse({
      engine_version: "1",
      scope_id: "scope",
    });
    expect(parsed.success).toBe(false);
  });
});
