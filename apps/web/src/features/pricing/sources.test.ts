import { describe, expect, it } from "vitest";
import type { Workspace } from "../../api/client";
import {
  anomalyEs,
  anomalyVerdictEs,
  branchEs,
  citationsByIds,
  errorCodeOnly,
  hashOrigin,
  matchStatusEs,
  metadataForKey,
  parseStatusEs,
  reasonEs,
  rightsStatusEs,
  variableEs,
} from "./sources";

function workspaceStub(): Workspace {
  return {
    tender: {
      raw_snapshot_sha256: "snapshot-hash",
      metadata_evidence: [
        {
          key: "pbl_net",
          source_url: "https://example.invalid/atom",
          snapshot_sha256: "snapshot-hash",
          field_path: "a:feed/a:entry",
          raw_value: "118336",
          source_updated_at: "2026-10-25T14:12:11.227+01:00",
        },
      ],
    },
    documents: [
      {
        id: "doc-tias-pcap",
        display_name: "PCAP Tías",
        sha256: "doc-hash",
        pages_count: 41,
      },
    ],
    citations: [
      {
        id: "cit-price_points",
        document_id: "doc-tias-pcap",
        document_sha256: "doc-hash",
        page_number: 10,
        verbatim_excerpt: "Precio 49 puntos",
        match_status: "exact",
      },
      {
        id: "cit-anomaly_single_discount_gt",
        document_id: "doc-tias-pcap",
        document_sha256: "doc-hash",
        page_number: 20,
        verbatim_excerpt: "más de 25 unidades",
        match_status: "exact",
      },
    ],
  } as unknown as Workspace;
}

describe("sources", () => {
  it("resolves evidence ids to citations in order, skipping unknown ids", () => {
    const ws = workspaceStub();
    const found = citationsByIds(ws, ["cit-price_points", "cit-missing"]);
    expect(found.map((c) => c.id)).toEqual(["cit-price_points"]);
    expect(found[0]?.page_number).toBe(10);
  });

  it("finds tender metadata by key", () => {
    const ws = workspaceStub();
    expect(metadataForKey(ws.tender, "pbl_net")?.raw_value).toBe("118336");
    expect(metadataForKey(ws.tender, "nope")).toBeNull();
  });

  it("translates backend reason codes to Spanish", () => {
    expect(reasonEs("incomplete_rival_set")).toContain("incompleto");
    expect(reasonEs("group_membership_unconfirmed")).toContain("sin confirmar");
    expect(reasonEs("below_relative_threshold")).toContain("90 %");
    expect(reasonEs("absolute_25_close")).toContain("25 %");
    expect(reasonEs("zero_denominator")).toContain("cero");
    expect(reasonEs("future_code_xyz")).toBe("future_code_xyz");
  });

  it("translates anomaly branches to Spanish", () => {
    expect(branchEs("n3_no_trim")).toContain("tres");
    expect(branchEs("n1")).toContain("75 %");
    expect(branchEs(null)).toBe("sin caso aplicable");
    expect(branchEs("n9")).toBe("n9");
  });

  it("translates formula variables to Spanish", () => {
    expect(variableEs("best_price")).toBe("la oferta más barata");
    expect(variableEs("own_price")).toBe("tu oferta");
  });

  it("answers the suspicious-offer question with Sí/No text", () => {
    expect(anomalyVerdictEs("possible_justification_required")).toBe("Sí");
    expect(anomalyVerdictEs("not_flagged_under_assumptions")).toBe("No, en este supuesto");
    expect(anomalyVerdictEs("not_applicable")).toBe("No aplicable");
    expect(anomalyVerdictEs("unknown")).toBe("Sin determinar");
    expect(anomalyVerdictEs("future_status")).toBe("Sin determinar");
  });

  it("keeps only the code for the (código: …) suffix", () => {
    expect(errorCodeOnly("basis_not_approved: base not approved")).toBe("basis_not_approved");
    expect(errorCodeOnly("http_500")).toBe("http_500");
    expect(errorCodeOnly(null)).toBeNull();
  });

  it("translates anomaly statuses to Spanish", () => {
    expect(anomalyEs("possible_justification_required")).toBe("Posible necesidad de justificación");
    expect(anomalyEs("not_flagged_under_assumptions")).toBe("No, en este supuesto");
    expect(anomalyEs("not_applicable")).toBe("No aplicable");
    expect(anomalyEs("unknown")).toBe("Sin determinar");
  });

  it("translates evidence codes to Spanish", () => {
    expect(matchStatusEs("exact")).toBe("literal");
    expect(matchStatusEs("normalized_match")).toBe("normalizada");
    expect(rightsStatusEs("reviewed_for_demo")).toBe("revisada para la demo");
    expect(rightsStatusEs("unknown")).toBe("sin determinar");
    expect(parseStatusEs("ready")).toBe("lista");
    expect(parseStatusEs("needs_review")).toBe("por revisar");
  });

  it("matches source hashes to the snapshot or a document", () => {
    const ws = workspaceStub();
    expect(hashOrigin(ws, "snapshot-hash").kind).toBe("snapshot");
    expect(hashOrigin(ws, "doc-hash").label).toBe("PCAP Tías");
    expect(hashOrigin(ws, "other").kind).toBe("unknown");
  });
});
