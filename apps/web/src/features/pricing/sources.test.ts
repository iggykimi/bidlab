import { describe, expect, it } from "vitest";
import type { Workspace } from "../../api/client";
import {
  anomalyEs,
  branchEs,
  citationsByIds,
  hashOrigin,
  metadataForKey,
  reasonEs,
  scoreStatusEs,
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
    expect(branchEs(null)).toContain("unknown");
    expect(branchEs("n9")).toBe("n9");
  });

  it("translates score status and formula variables", () => {
    expect(scoreStatusEs("defined")).toBe("definida");
    expect(scoreStatusEs("unknown")).toContain("unknown");
    expect(variableEs("best_price")).toBe("mejor oferta");
    expect(variableEs("own_price")).toBe("precio propio");
  });

  it("translates anomaly statuses to Spanish", () => {
    expect(anomalyEs("possible_justification_required")).toBe("Posible necesidad de justificación");
    expect(anomalyEs("not_flagged_under_assumptions")).toBe("Sin presunción bajo estos supuestos");
    expect(anomalyEs("not_applicable")).toBe("No aplicable");
    expect(anomalyEs("unknown")).toContain("unknown");
  });

  it("matches source hashes to the snapshot or a document", () => {
    const ws = workspaceStub();
    expect(hashOrigin(ws, "snapshot-hash").kind).toBe("snapshot");
    expect(hashOrigin(ws, "doc-hash").label).toBe("PCAP Tías");
    expect(hashOrigin(ws, "other").kind).toBe("unknown");
  });
});
