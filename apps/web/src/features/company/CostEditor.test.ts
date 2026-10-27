// CostEditor pure helpers: money-field mapping and evidence merge.
// Empty means unknown (null); explicit zero means "0.00". No arithmetic.

import { describe, expect, it } from "vitest";
import {
  buildCompanyUpdate,
  buildEvidenceRow,
  describeCostDrift,
  mergeEvidence,
  moneyFieldToProtocol,
  type CostDraft,
} from "./CostEditor";
import type { Company, CompanyEvidence } from "../../api/client";

function makeCompany(): Company {
  return {
    id: "company-demo",
    revision: 3,
    name: "Pyme de ejemplo",
    synthetic: true,
    scope_id: "tias-whole",
    period_months: 24,
    direct_cost_net: "80000.00",
    overhead_net: "10000.00",
    target_margin_rate: "0.1000",
    evidence: [
      {
        field_key: "annual_turnover_best_3y_net",
        value: "300000.00",
        unit: "EUR",
        period_from: null,
        period_to: null,
        source_type: "user_attestation",
        reference: "cuentas 2024",
        reviewed: true,
      },
    ],
  };
}

describe("moneyFieldToProtocol", () => {
  it("maps empty input to unknown (null)", () => {
    expect(moneyFieldToProtocol("")).toEqual({ ok: true, value: null });
    expect(moneyFieldToProtocol("   ")).toEqual({ ok: true, value: null });
  });

  it("maps explicit zero to 0.00, never to null", () => {
    expect(moneyFieldToProtocol("0")).toEqual({ ok: true, value: "0.00" });
    expect(moneyFieldToProtocol("0,00")).toEqual({ ok: true, value: "0.00" });
  });

  it("normalizes Spanish comma and thousands input", () => {
    expect(moneyFieldToProtocol("1234,56")).toEqual({ ok: true, value: "1234.56" });
    expect(moneyFieldToProtocol("1.234,56")).toEqual({ ok: true, value: "1234.56" });
    expect(moneyFieldToProtocol("80000")).toEqual({ ok: true, value: "80000.00" });
  });

  it("rejects unusable input without guessing an amount", () => {
    expect(moneyFieldToProtocol("abc").ok).toBe(false);
    expect(moneyFieldToProtocol("12,34,56").ok).toBe(false);
    expect(moneyFieldToProtocol("1.2.3").ok).toBe(false);
  });
});

describe("buildEvidenceRow", () => {
  it("stamps new rows as unattested user data pending review", () => {
    const row = buildEvidenceRow({
      field_key: "  annual_turnover_best_3y_net ",
      value: "300000",
      unit: "EUR",
      reference: "cuentas 2024",
    });
    expect(row).toEqual({
      field_key: "annual_turnover_best_3y_net",
      value: "300000",
      unit: "EUR",
      period_from: null,
      period_to: null,
      source_type: "user_attestation",
      reference: "cuentas 2024",
      reviewed: false,
    });
  });
});

describe("mergeEvidence", () => {
  it("keeps untouched evidence first and appends new rows", () => {
    const existing = makeCompany().evidence;
    const added: CompanyEvidence[] = [
      buildEvidenceRow({
        field_key: "professional_insurance_net",
        value: "300000",
        unit: "EUR",
        reference: "póliza",
      }),
    ];
    const merged = mergeEvidence(existing, added);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(existing[0]);
    expect(merged[1]).toEqual(added[0]);
    // Inputs stay untouched: a fresh array, not a mutation.
    expect(existing).toHaveLength(1);
  });
});

describe("buildCompanyUpdate", () => {
  const draft: CostDraft = {
    name: "Mi pyme",
    direct: "70000,00",
    overhead: "",
    addedEvidence: [
      buildEvidenceRow({
        field_key: "professional_insurance_net",
        value: "300000",
        unit: "EUR",
        reference: "póliza",
      }),
    ],
  };

  it("builds the full body from the fetched revision", () => {
    const body = buildCompanyUpdate(makeCompany(), draft, 3);
    expect(body).toEqual({
      expected_revision: 3,
      name: "Mi pyme",
      synthetic: false,
      scope_id: "tias-whole",
      period_months: 24,
      direct_cost_net: "70000.00",
      overhead_net: null,
      target_margin_rate: "0.1000",
      evidence: [
        makeCompany().evidence[0],
        {
          field_key: "professional_insurance_net",
          value: "300000",
          unit: "EUR",
          period_from: null,
          period_to: null,
          source_type: "user_attestation",
          reference: "póliza",
          reviewed: false,
        },
      ],
    });
  });

  it("refuses invalid money or a blank name", () => {
    expect(buildCompanyUpdate(makeCompany(), { ...draft, direct: "abc" }, 3)).toBeNull();
    expect(buildCompanyUpdate(makeCompany(), { ...draft, name: "  " }, 3)).toBeNull();
  });

  it("sends the given base, so a stale draft never confirms itself (R02)", () => {
    const rebased = buildCompanyUpdate(makeCompany(), draft, 5);
    expect(rebased?.expected_revision).toBe(5);
  });
});

describe("describeCostDrift", () => {
  it("names each changed field with current and draft values", () => {
    const lines = describeCostDrift(makeCompany(), {
      name: "Mi pyme",
      direct: "70000,00",
      overhead: "",
      addedEvidence: [],
    });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Pyme de ejemplo");
    expect(lines[0]).toContain("Mi pyme");
    expect(lines[1]).toContain("80000,00");
    expect(lines[1]).toContain("70000,00");
    expect(lines[2]).toContain("10000,00");
  });

  it("stays silent when nothing drifted and skips unparseable input", () => {
    expect(
      describeCostDrift(makeCompany(), {
        name: "Pyme de ejemplo",
        direct: "80000,00",
        overhead: "10000,00",
        addedEvidence: [],
      })
    ).toEqual([]);
    expect(
      describeCostDrift(makeCompany(), {
        name: "Pyme de ejemplo",
        direct: "abc",
        overhead: "10000,00",
        addedEvidence: [],
      })
    ).toEqual([]);
  });
});
