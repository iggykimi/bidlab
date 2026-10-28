import { describe, expect, it } from "vitest";
import type { Citation, ClaimProposal } from "../../api/client";
import {
  citaEstadoEs,
  claimLabel,
  claimStatusEs,
  confidenceEs,
  joinClaimCitations,
} from "./claimHelpers";

function makeClaim(overrides: Partial<ClaimProposal> = {}): ClaimProposal {
  return {
    key: "presupuesto_base_licitacion",
    raw_value: "120000 euros netos",
    normalized_value: "120000",
    unit: "EUR",
    citations: [
      { document_id: "d1", page_number: 1, verbatim_excerpt: "Presupuesto base: 120000." },
    ],
    confidence: "high",
    status: "proposed",
    notes: [],
    ...overrides,
  } as ClaimProposal;
}

function makeStored(): Citation[] {
  return [
    {
      id: "c1",
      document_id: "d1",
      document_sha256: "x",
      page_number: 1,
      printed_label: null,
      verbatim_excerpt: "Presupuesto base: 120000.",
      match_status: "exact",
      normalized_start: null,
      normalized_end: null,
      normalization_version: "v1",
    } as Citation,
  ];
}

describe("claimLabel", () => {
  it("translates known keys and shows unknown ones verbatim", () => {
    expect(claimLabel("presupuesto_base_licitacion")).toBe("Presupuesto base de licitación");
    expect(claimLabel("pbl_net")).toBe("Presupuesto sin impuestos");
    expect(claimLabel("alguna_clave_futura")).toBe("alguna_clave_futura");
  });
});

describe("confidenceEs and claimStatusEs", () => {
  it("renders plain Spanish without inventing certainty", () => {
    expect(confidenceEs("high")).toBe("alta");
    expect(confidenceEs("medium")).toBe("media");
    expect(confidenceEs("low")).toBe("baja");
    expect(claimStatusEs("proposed")).toBeNull();
    expect(claimStatusEs("not_found")).toContain("No lo encuentra");
    expect(claimStatusEs("ambiguous")).toContain("varias formas");
    expect(claimStatusEs("unsupported")).toContain("no trae");
  });
});

describe("joinClaimCitations", () => {
  it("joins verified rows by document and page", () => {
    const joined = joinClaimCitations(makeClaim(), makeStored());
    expect(joined).toHaveLength(1);
    expect(joined[0]?.verified?.id).toBe("c1");
  });

  it("marks unmatched citations as unverified", () => {
    const claim = makeClaim({
      citations: [{ document_id: "d9", page_number: 7, verbatim_excerpt: "Otra." }],
    });
    const joined = joinClaimCitations(claim, makeStored());
    expect(joined).toHaveLength(1);
    expect(joined[0]?.verified).toBeNull();
  });
});

describe("citaEstadoEs", () => {
  it("names the machine localization state, never the human review", () => {
    expect(citaEstadoEs("exact")).toBe("Copiado tal cual");
    expect(citaEstadoEs("normalized_match")).toBe("Coincide normalizado");
    expect(citaEstadoEs("manual_visual")).toBe("Localizado a mano");
  });

  it("stays Sin localizar without a match or a stored row", () => {
    expect(citaEstadoEs("missing")).toBe("Sin localizar");
    expect(citaEstadoEs(null)).toBe("Sin localizar");
    expect(citaEstadoEs("fuzzy_v2")).toBe("Sin localizar");
  });
});
