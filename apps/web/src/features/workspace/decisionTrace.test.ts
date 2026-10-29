import { describe, expect, it } from "vitest";
import type {
  ClaimProposal,
  Job,
  PricingRule,
  ReportSummary,
  TenderDocument,
} from "../../api/client";
import { buildDecisionTrace, type TraceInput } from "./decisionTrace";

function doc(over: Partial<TenderDocument> = {}): TenderDocument {
  return {
    id: "d1",
    tender_id: "t1",
    kind: "pcap",
    display_name: "pliego.pdf",
    sha256: "00".repeat(32),
    pages_count: 2,
    source_url: null,
    rights_status: "unknown",
    parse_status: "ready",
    ...over,
  };
}

function rule(over: Partial<PricingRule> = {}): PricingRule {
  return {
    id: "r1",
    revision: 3,
    scope_id: "s1",
    template_id: "proportional_inverse",
    max_points: "49",
    expression: null,
    review_status: "approved",
    zero_denominator_policy: "unknown",
    evidence_ids: [],
    anomaly_policy: {
      id: "a1",
      source_kind: "explicit_pcap",
      variant: "rglcap85_standard",
      review_status: "approved",
      three_bidder_absolute_25: false,
      percentage_reduction_one_third: false,
      evidence_ids: [],
    },
    ...over,
  };
}

function claim(status: ClaimProposal["status"]): ClaimProposal {
  return {
    key: "k",
    raw_value: null,
    normalized_value: null,
    unit: null,
    citations: [],
    confidence: "high",
    status,
    notes: [],
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

function report(over: Partial<ReportSummary> = {}): ReportSummary {
  return {
    id: "rep1",
    scenario_id: "sc1",
    scenario_name: "A",
    scope_id: "s1",
    decision: "prepare",
    created_at: "2026-10-29T10:00:00+00:00",
    ...over,
  };
}

function base(over: Partial<TraceInput> = {}): TraceInput {
  return {
    own: true,
    documents: [],
    claims: [],
    rule: null,
    trackedJob: null,
    scenarioTotal: null,
    reports: null,
    ...over,
  };
}

describe("buildDecisionTrace", () => {
  it("recorrido propio completo: fuente, simulada, aprobada, prueba y decisión", () => {
    const steps = buildDecisionTrace(
      base({
        documents: [doc()],
        trackedJob: job(),
        rule: rule(),
        scenarioTotal: 1,
        reports: [report()],
      })
    );
    expect(steps.map((s) => s.id)).toEqual(["source", "extract", "review", "evaluate", "decide"]);
    expect(steps[0]).toMatchObject({ state: "complete", detail: "pliego.pdf · 2 páginas" });
    expect(steps[1]).toMatchObject({ state: "manual", detail: "Prueba simulada." });
    expect(steps[2]).toMatchObject({ state: "complete", detail: "Fórmula aprobada (rev. 3)." });
    expect(steps[3]).toMatchObject({ state: "complete", detail: "1 prueba guardada." });
    expect(steps[4]).toMatchObject({ state: "complete", detail: "Última: preparar oferta." });
    for (const s of steps) expect(s.href, s.id).toMatch(/^\?tab=/);
  });

  it("demo curada: la propuesta dice ejemplo preparado, nunca Meta live", () => {
    const steps = buildDecisionTrace(base({ own: false, documents: [doc()], rule: rule() }));
    expect(steps[1]).toMatchObject({ state: "manual", detail: "Ejemplo preparado." });
    expect(steps[1]?.detail).not.toMatch(/Meta/);
  });

  it("sin fórmula aprobada el cálculo no aparenta completitud ni tiene CTA", () => {
    const steps = buildDecisionTrace(
      base({
        documents: [doc()],
        claims: [claim("proposed"), claim("proposed"), claim("not_found")],
        rule: rule({ review_status: "pending" }),
      })
    );
    expect(steps[2]).toMatchObject({ state: "pending", detail: "2 propuestas pendientes." });
    expect(steps[3]).toMatchObject({ state: "pending", detail: "Necesita la fórmula aprobada." });
    expect(steps[3]?.href).toBeUndefined();
  });

  it("fórmula bloqueada: aviso explícito de no usar los puntos", () => {
    const steps = buildDecisionTrace(
      base({ rule: rule({ review_status: "blocked" }), scenarioTotal: 2 })
    );
    expect(steps[2]?.state).toBe("blocked");
    expect(steps[2]?.detail).toMatch(/No uses sus puntos/);
    expect(steps[3]?.state).toBe("pending");
  });

  it("desconocidos reales: sin sesión no afirma ceros", () => {
    const steps = buildDecisionTrace(base({ rule: rule() }));
    expect(steps[3]).toMatchObject({ state: "pending", detail: "Cargando tus pruebas…" });
    expect(steps[4]).toMatchObject({ state: "pending", detail: "Cargando tus informes…" });
  });

  it("la decisión sale del informe más reciente por created_at", () => {
    const steps = buildDecisionTrace(
      base({
        rule: rule(),
        reports: [
          report({ decision: "discard", created_at: "2026-10-29T12:00:00+00:00" }),
          report({ decision: "study", created_at: "2026-10-29T09:00:00+00:00" }),
        ],
      })
    );
    expect(steps[4]?.detail).toMatch(/descartar|descartada/i);
  });

  it("trabajo live en curso: pendiente honesto, no fingido como listo", () => {
    const steps = buildDecisionTrace(
      base({ documents: [doc()], trackedJob: job({ status: "running", mode: "live" }) })
    );
    expect(steps[1]).toMatchObject({ state: "pending", detail: "Analizando con Meta…" });
  });

  it("documento ilegible: bloqueado sin enlace a evidencia", () => {
    const steps = buildDecisionTrace(base({ documents: [doc({ parse_status: "failed" })] }));
    const first = steps[0];
    expect(first?.state).toBe("blocked");
    expect(first?.href).toBeUndefined();
  });
});
