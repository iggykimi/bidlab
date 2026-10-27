import { describe, expect, it } from "vitest";
import type { Citation, RequirementLeaf, Workspace } from "../../api/client";
import { citationsForLeaf } from "./RequirementsTab";

function citation(id: string, page: number, excerpt: string): Citation {
  return {
    id,
    document_id: "doc-tias-pcap",
    document_sha256: "abc",
    page_number: page,
    printed_label: null,
    verbatim_excerpt: excerpt,
    match_status: "exact",
    normalized_start: 0,
    normalized_end: 10,
    normalization_version: "1",
  };
}

function claim(key: string, normalized: string, cites: { page: number; excerpt: string }[]) {
  return {
    key,
    raw_value: normalized,
    normalized_value: normalized,
    unit: "EUR",
    citations: cites.map((c) => ({
      document_id: "doc-tias-pcap",
      page_number: c.page,
      verbatim_excerpt: c.excerpt,
    })),
    confidence: "high",
    status: "proposed",
    notes: [],
  };
}

function leaf(
  id: string,
  company_field: RequirementLeaf["company_field"],
  threshold: string | null
): RequirementLeaf {
  return {
    kind: "leaf",
    id,
    label: id,
    company_field,
    operator: "gte",
    threshold,
    unit: "EUR",
    review_status: "approved",
    evidence_ids: [],
  };
}

// Turnover, insurance and estimated value share normalized 295840.00.
const workspace = {
  claims: [
    claim("turnover_threshold", "295840.00", [{ page: 5, excerpt: "volumen extracto" }]),
    claim("insurance_threshold", "295840.00", [{ page: 6, excerpt: "seguro extracto" }]),
    claim("estimated_value", "295840.00", [{ page: 8, excerpt: "valor estimado extracto" }]),
    claim("technical_services_threshold", "207088.00", [
      { page: 6, excerpt: "servicios extracto" },
    ]),
  ],
  citations: [
    citation("cit-turnover_threshold", 5, "volumen extracto"),
    citation("cit-insurance_threshold", 6, "seguro extracto"),
    citation("cit-estimated_value", 8, "valor estimado extracto"),
    citation("cit-technical_services_threshold", 6, "servicios extracto"),
  ],
} as unknown as Workspace;

describe("citationsForLeaf", () => {
  it("links each requirement to its own claim, never a numeric coincidence", () => {
    expect(
      citationsForLeaf(
        workspace,
        leaf("req-econ-turnover", "annual_turnover_best_3y_net", "295840.00")
      ).map((c) => c.id)
    ).toEqual(["cit-turnover_threshold"]);
    expect(
      citationsForLeaf(
        workspace,
        leaf("req-econ-insurance", "professional_insurance_net", "295840.00")
      ).map((c) => c.id)
    ).toEqual(["cit-insurance_threshold"]);
    expect(
      citationsForLeaf(
        workspace,
        leaf("req-tech-amount", "annual_similar_services_best_3y_net", "207088.00")
      ).map((c) => c.id)
    ).toEqual(["cit-technical_services_threshold"]);
  });

  it("returns no citations for manual or unmapped fields", () => {
    expect(citationsForLeaf(workspace, leaf("req-manual", "manual", null))).toEqual([]);
    expect(
      citationsForLeaf(workspace, leaf("req-networth", "net_worth_net", "100.00"))
    ).toEqual([]);
  });
});
