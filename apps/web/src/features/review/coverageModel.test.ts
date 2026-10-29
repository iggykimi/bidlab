import { describe, expect, it } from "vitest";
import type { Citation, ClaimProposal, Job, TenderDocument } from "../../api/client";
import { buildCoverageModel } from "./coverageModel";

function doc(over: Partial<TenderDocument> = {}): TenderDocument {
  return {
    id: "d1",
    tender_id: "t1",
    kind: "pcap",
    display_name: "pliego.pdf",
    sha256: "00".repeat(32),
    pages_count: 41,
    source_url: null,
    rights_status: "unknown",
    parse_status: "ready",
    ...over,
  };
}

function claim(pages: number[], docId = "d1"): ClaimProposal {
  return {
    key: "k",
    raw_value: null,
    normalized_value: null,
    unit: null,
    citations: pages.map((page_number) => ({ document_id: docId, page_number, verbatim_excerpt: "x" })),
    confidence: "high",
    status: "proposed",
    notes: [],
  };
}

function citation(page_number: number, docId = "d1"): Citation {
  return {
    id: "c1",
    document_id: docId,
    document_sha256: "00".repeat(32),
    page_number,
    printed_label: null,
    verbatim_excerpt: "x",
    match_status: "exact",
    normalized_start: 0,
    normalized_end: 1,
    normalization_version: "v1",
  };
}

function job(over: Partial<Job> = {}): Job {
  return {
    id: "j1",
    tender_id: "t1",
    status: "succeeded",
    stage: "done",
    processed_pages: 2,
    total_pages: 2,
    result_revision: 1,
    error_code: null,
    warnings: [],
    invocation_id: null,
    mode: "fixture",
    model: null,
    prompt_tokens: null,
    completion_tokens: null,
    estimated_cost_usd: null,
    provider_request_id: null,
    latency_ms: null,
    ...over,
  };
}

describe("buildCoverageModel", () => {
  it("sin citas ni trabajo: páginas citadas vacías y sin entregadas", () => {
    const model = buildCoverageModel({
      documents: [doc({ pages_count: 2 })],
      claims: [],
      citations: [],
      trackedJob: null,
    });
    expect(model.documents).toHaveLength(1);
    expect(model.documents[0]?.citedPages).toEqual([]);
    expect(model.delivered).toBeNull();
  });

  it("une propuestas y citas aprobadas, sin duplicados y ordenadas por documento", () => {
    const model = buildCoverageModel({
      documents: [doc(), doc({ id: "d2", display_name: "anexo.pdf" })],
      claims: [claim([14, 6, 14]), claim([3], "d2")],
      citations: [citation(6), citation(21), citation(2, "d2")],
      trackedJob: null,
    });
    expect(model.documents[0]?.citedPages).toEqual([6, 14, 21]);
    expect(model.documents[1]?.citedPages).toEqual([2, 3]);
  });

  it("el trabajo seguido aporta páginas enviadas, nunca confirmadas", () => {
    const model = buildCoverageModel({
      documents: [doc({ pages_count: 2 })],
      claims: [],
      citations: [],
      trackedJob: job(),
    });
    expect(model.delivered).toEqual({ sent: 2, total: 2 });
    expect(model).not.toHaveProperty("confirmed");
  });

  it("trabajo live en curso: enviadas parciales sobre el total real", () => {
    const model = buildCoverageModel({
      documents: [doc()],
      claims: [],
      citations: [],
      trackedJob: job({ status: "running", mode: "live", processed_pages: 3, total_pages: 41 }),
    });
    expect(model.delivered).toEqual({ sent: 3, total: 41 });
  });
});
