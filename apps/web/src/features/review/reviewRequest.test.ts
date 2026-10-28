import { describe, expect, it } from "vitest";
import type { PriceBasis } from "../../api/client";
import { proportionalInverseTemplate } from "../../lib/expressionTemplates";
import {
  ANOMALY_COPY,
  ANOMALY_VARIANTS,
  buildReviewRequest,
  defaultThreeBidderFlag,
  parseDecimalInput,
  parsePeriodInput,
} from "./reviewRequest";

function makeBasis(): PriceBasis {
  return {
    scope_id: "t1-whole",
    budget_net: "118336.00",
    ceiling_net: null,
    scoring_reference_net: null,
    reference_kind: "pbl",
    currency: "EUR",
    unit: "lump_sum",
    period_months: 24,
    tax_kind: "IGIC",
    review_status: "pending",
    evidence_ids: [],
    metadata_evidence: [],
  };
}

describe("parseDecimalInput", () => {
  it("accepts integers and comma/dot decimals", () => {
    expect(parseDecimalInput("49")).toBe("49");
    expect(parseDecimalInput("49,5")).toBe("49.5");
    expect(parseDecimalInput("49.50")).toBe("49.50");
    expect(parseDecimalInput(" 49 ")).toBe("49");
  });

  it("rejects blanks, negatives and junk", () => {
    for (const bad of ["", "abc", "-3", "4,5,6", "1.2.3"]) {
      expect(parseDecimalInput(bad)).toBeNull();
    }
  });
});

describe("parsePeriodInput", () => {
  it("accepts positive integers only", () => {
    expect(parsePeriodInput("24")).toBe(24);
    for (const bad of ["", "0", "-3", "2.5", "dos"]) {
      expect(parsePeriodInput(bad)).toBeNull();
    }
  });
});

describe("buildReviewRequest", () => {
  it("builds the full manual payload with canonical AST and approved statuses", () => {
    const payload = buildReviewRequest({
      tenderId: "t1",
      scopeId: "t1-whole",
      budgetNet: "100000.00",
      periodMonths: 12,
      referenceSame: true,
      referenceNet: null,
      existingBasis: makeBasis(),
      templateId: "proportional_inverse",
      maxPoints: "49",
      anomalyVariant: "tias_18_5",
      threeBidderAbsolute25: true,
      percentageReductionOneThird: false,
      expectedRevision: 2,
      ruleRevision: 1,
      approvedClaimKeys: [],
      reason: "  Revisado contra el pliego  ",
    });
    expect(payload.expected_revision).toBe(2);
    expect(payload.approved_claim_keys).toEqual([]);
    expect(payload.requirement_trees).toEqual([]);
    expect(payload.corrected_proposal).toBeNull();
    expect(payload.actor).toBe("usuario");
    expect(payload.reason).toBe("Revisado contra el pliego");
    expect(payload.scope_basis).toMatchObject({
      scope_id: "t1-whole",
      budget_net: "100000.00",
      review_status: "approved",
      tax_kind: "IGIC",
      currency: "EUR",
    });
    expect(payload.pricing_rule).toMatchObject({
      id: "t1-rule-1",
      revision: 1,
      scope_id: "t1-whole",
      template_id: "proportional_inverse",
      max_points: "49",
      review_status: "approved",
      zero_denominator_policy: "unknown",
      evidence_ids: [],
    });
    expect(payload.pricing_rule?.expression).toEqual(proportionalInverseTemplate());
    expect(payload.pricing_rule?.anomaly_policy).toMatchObject({
      variant: "tias_18_5",
      review_status: "approved",
      three_bidder_absolute_25: true,
      percentage_reduction_one_third: false,
      evidence_ids: [],
    });
  });

  it("carries tax, unit and evidence over from the existing basis", () => {
    const basis = { ...makeBasis(), tax_kind: "VAT" as const, unit: "unknown" as const };
    const payload = buildReviewRequest({
      tenderId: "t1",
      scopeId: "t1-whole",
      budgetNet: null,
      periodMonths: null,
      referenceSame: true,
      referenceNet: null,
      existingBasis: basis,
      templateId: "log_ratio",
      maxPoints: "10",
      anomalyVariant: "unsupported",
      threeBidderAbsolute25: false,
      percentageReductionOneThird: false,
      expectedRevision: 0,
      ruleRevision: 3,
      approvedClaimKeys: [],
      reason: "Sin presupuesto conocido",
    });
    expect(payload.scope_basis?.tax_kind).toBe("VAT");
    expect(payload.scope_basis?.unit).toBe("unknown");
    expect(payload.scope_basis?.budget_net).toBeNull();
    expect(payload.scope_basis?.period_months).toBeNull();
    expect(payload.pricing_rule?.template_id).toBe("log_ratio");
    expect(payload.pricing_rule?.anomaly_policy.variant).toBe("unsupported");
    expect(payload.pricing_rule?.revision).toBe(3);
  });

  it("P0-3: same-as-budget reference is confirmed, never defaulted", () => {
    const basis = { ...makeBasis(), scoring_reference_net: "90000.00", reference_kind: "custom" as const };
    const payload = buildReviewRequest({
      tenderId: "t1",
      scopeId: "t1-whole",
      budgetNet: "100000.00",
      periodMonths: 12,
      referenceSame: true,
      referenceNet: null,
      existingBasis: basis,
      templateId: "linear_discount",
      maxPoints: "49",
      anomalyVariant: "unsupported",
      threeBidderAbsolute25: false,
      percentageReductionOneThird: false,
      expectedRevision: 0,
      ruleRevision: 1,
      approvedClaimKeys: [],
      reason: "Confirmo referencia",
    });
    expect(payload.scope_basis?.scoring_reference_net).toBe("100000.00");
    expect(payload.scope_basis?.reference_kind).toBe("pbl");
  });

  it("P0-3: custom reference flows with custom kind", () => {
    const payload = buildReviewRequest({
      tenderId: "t1",
      scopeId: "t1-whole",
      budgetNet: "100000.00",
      periodMonths: 12,
      referenceSame: false,
      referenceNet: "110000.00",
      existingBasis: makeBasis(),
      templateId: "linear_discount",
      maxPoints: "49",
      anomalyVariant: "unsupported",
      threeBidderAbsolute25: false,
      percentageReductionOneThird: false,
      expectedRevision: 0,
      ruleRevision: 1,
      approvedClaimKeys: [],
      reason: "Referencia aparte",
    });
    expect(payload.scope_basis?.scoring_reference_net).toBe("110000.00");
    expect(payload.scope_basis?.reference_kind).toBe("custom");
  });

  it("flows the user-confirmed claim keys, defaulting to none", () => {
    const base = {
      tenderId: "t1",
      scopeId: "t1-whole",
      budgetNet: "100000.00",
      periodMonths: 12,
      referenceSame: true,
      referenceNet: null,
      existingBasis: makeBasis(),
      templateId: "proportional_inverse" as const,
      maxPoints: "49",
      anomalyVariant: "unsupported" as const,
      threeBidderAbsolute25: false,
      percentageReductionOneThird: false,
      expectedRevision: 0,
      ruleRevision: 1,
      reason: "Claves",
    };
    expect(buildReviewRequest({ ...base, approvedClaimKeys: [] }).approved_claim_keys).toEqual([]);
    expect(
      buildReviewRequest({ ...base, approvedClaimKeys: ["presupuesto_base_licitacion"] })
        .approved_claim_keys
    ).toEqual(["presupuesto_base_licitacion"]);
  });
});

describe("anomaly copy and flags", () => {
  it("covers the four variants with short plain questions", () => {
    expect(ANOMALY_VARIANTS).toEqual(["tias_18_5", "alfresco_18_5", "rglcap85_standard", "unsupported"]);
    for (const variant of ANOMALY_VARIANTS) {
      const copy = ANOMALY_COPY[variant];
      expect(copy.question.endsWith("?")).toBe(true);
      for (const text of [copy.question, copy.plain]) {
        expect(text.split(/\s+/).length).toBeLessThanOrEqual(20);
      }
      expect(`${copy.question} ${copy.plain}`).not.toContain(variant);
    }
  });

  it("defaults the n=3 absolute-25 flag on only for tias_18_5", () => {
    expect(defaultThreeBidderFlag("tias_18_5")).toBe(true);
    expect(defaultThreeBidderFlag("alfresco_18_5")).toBe(false);
    expect(defaultThreeBidderFlag("rglcap85_standard")).toBe(false);
    expect(defaultThreeBidderFlag("unsupported")).toBe(false);
  });
});
