import { describe, expect, it } from "vitest";
import type { Citation, ClaimProposal, TenderDocument } from "../../api/client";
import {
  citaEstadoEs,
  canConfirmClaim,
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

  it("does not borrow an exact match from another quote on the same page", () => {
    const claim = makeClaim({
      citations: [{ document_id: "d1", page_number: 1, verbatim_excerpt: "Un importe inventado: 7." }],
    });
    expect(joinClaimCitations(claim, makeStored())[0]?.verified).toBeNull();
  });
});

describe("canConfirmClaim", () => {
  const documents = [{ id: "d1", sha256: "x" }] as TenderDocument[];

  it("accepts only a proposed value whose complete citation set is current and localized", () => {
    expect(canConfirmClaim(makeClaim(), makeStored(), documents)).toBe(true);
    const stored = makeStored().map((c) => ({ ...c, match_status: "normalized_match" as const }));
    expect(canConfirmClaim(makeClaim(), stored, documents)).toBe(true);
  });

  it("blocks missing values, non-proposed claims and absent citations", () => {
    expect(canConfirmClaim(makeClaim({ normalized_value: null }), makeStored(), documents)).toBe(false);
    expect(canConfirmClaim(makeClaim({ normalized_value: "" }), makeStored(), documents)).toBe(false);
    expect(canConfirmClaim(makeClaim({ normalized_value: "  " }), makeStored(), documents)).toBe(false);
    expect(canConfirmClaim(makeClaim({ status: "ambiguous" }), makeStored(), documents)).toBe(false);
    expect(canConfirmClaim(makeClaim({ citations: [] }), makeStored(), documents)).toBe(false);
  });

  it("blocks an old file hash and an unrelated exact quote", () => {
    expect(canConfirmClaim(makeClaim(), makeStored(), [{ id: "d1", sha256: "new" }] as TenderDocument[])).toBe(false);
    const claim = makeClaim({ citations: [{ document_id: "d1", page_number: 1, verbatim_excerpt: "No consta." }] });
    expect(canConfirmClaim(claim, makeStored(), documents)).toBe(false);
  });

  it("requires every citation and does not promote a manual visual state to text verification", () => {
    const claim = makeClaim();
    claim.citations.push({ document_id: "d1", page_number: 2, verbatim_excerpt: "Sin comprobar." });
    expect(canConfirmClaim(claim, makeStored(), documents)).toBe(false);
    const visual = makeStored().map((c) => ({ ...c, match_status: "manual_visual" as const }));
    expect(canConfirmClaim(makeClaim(), visual, documents)).toBe(false);
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
