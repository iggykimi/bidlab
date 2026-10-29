import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { EvaluationResult, Workspace } from "../../api/client";
import { ConclusionSection } from "./ConclusionSection";
import { CalculationSection } from "./CurveSection";
import { KpiSection } from "./KpiSection";
import { OfferComposition } from "./OfferComposition";
import { SaveScenarioSection } from "./SaveScenarioSection";
import { DEFAULTS } from "./hypotheses";
import type { PricingState } from "./usePricingState";

const result = {
  price_net: "112419.20", cost_net: "90000.00", profit_net: "22419.20", margin_rate: "0.199425009251",
  score: { status: "defined", value: "46.421052631579", max_points: "49" },
  anomaly: { status: "not_flagged_under_assumptions", threshold_net: null, reason_codes: [] },
  trace: [{ label: "Mejor oferta incluyendo propia", value: "106502.40", expression: "min(offers)" }],
  source_hashes: [], assumptions: [], warnings: [], curve: [],
} as unknown as EvaluationResult;
const workspace = {
  tender: { id: "tias", pbl_net: "118336.00", pbl_gross: null, scopes: [{ basis: { tax_kind: "IGIC" } }] },
} as unknown as Workspace;

function render(node: ReactNode): string {
  return renderToStaticMarkup(node).replace(/[\u00A0\u202F]/g, " ");
}

function state(extra: Partial<PricingState> = {}): PricingState {
  return {
    h: { ...DEFAULTS, discountPct: 30, rivalAPrice: "70000.00" },
    resultHypotheses: { ...DEFAULTS },
    result, pending: true, resultStale: true, inputsValid: true,
    requestCount: 1, companyName: "Mi empresa", companySynthetic: false,
    ruleCitations: [], anomalyCitations: [], basisCitations: [], pblMeta: null,
    rule: { template_id: "proportional_inverse" }, scenarioName: "Mi prueba",
    saveState: null, saveError: null, saveRawError: null, saving: false,
    ...extra,
  } as unknown as PricingState;
}

describe("painted pricing context", () => {
  it("keeps the previous discount and rival with its figures while the draft changes", () => {
    const html = render(<ConclusionSection state={state()} />);
    expect(html).toContain("rebaja del 5,0 %");
    expect(html).toContain("112.419 €");
    expect(html).toContain("106.502 €");
    expect(html).not.toContain("30,0 %");
    expect(html).not.toContain("70.000 €");
    expect(html).toContain("Cifras del cálculo anterior");
  });

  it("keeps the calculation's percentage attached to the painted result", () => {
    const html = render(<CalculationSection workspace={workspace} state={state()} />);
    expect(html).toContain("menos un 5,0 % = 112.419,20 €");
    expect(html).not.toContain("menos un 30,0 %");
  });

  it("describes a declared company cost without calling it invented", () => {
    const html = render(<KpiSection workspace={workspace} state={state()} />);
    expect(html).toContain("Es el coste declarado de tu empresa.");
    expect(html).not.toContain("Es un dato de ejemplo.");
    expect(html).not.toContain("Es un dato inventado.");
    expect(html).toContain("rebaja del 5,0 %");
  });

  it("labels example costs explicitly", () => {
    const html = render(<KpiSection workspace={workspace} state={state({ companySynthetic: true })} />);
    expect(html).toContain("Es un dato de ejemplo.");
    expect(html).not.toContain("Es el coste declarado de tu empresa.");
  });

  it("cannot save while painted figures belong to an earlier draft", () => {
    const html = render(<MemoryRouter><SaveScenarioSection workspace={workspace} state={state()} /></MemoryRouter>);
    expect(html).toMatch(/data-testid="save-scenario"[^>]*disabled=""/);
    expect(html).toContain("Espera al resultado de tus últimos cambios");
  });
});

describe("offer composition", () => {
  it("shows exact backend values alongside the visual proportions", () => {
    const html = render(<OfferComposition result={result} stale={false} />);
    expect(html).toContain("90.000,00 €");
    expect(html).toContain("+22.419,20 €");
    expect(html).toContain("Tu beneficio");
  });

  it("shows a loss outside the price, with a textual explanation", () => {
    const html = render(<OfferComposition result={{ ...result, cost_net: "120000.00", profit_net: "-7580.80" }} stale={false} />);
    expect(html).toContain("Tu pérdida");
    expect(html).toMatch(/[−-]7580,80 €/);
    expect(html).toContain("La parte roja queda fuera de tu precio.");
    expect(html).not.toContain("Tu beneficio");
  });

  it("does not turn unknown costs into a zero segment", () => {
    expect(renderToStaticMarkup(<OfferComposition result={{ ...result, cost_net: null, profit_net: null }} stale={false} />)).toBe("");
  });
});
