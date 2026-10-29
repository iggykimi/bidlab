// Visualizaciones del resultado: curva precio-puntos y cálculo en frases.
// La curva llega del backend con rivales fijos; recharts queda fuera del bundle inicial.

import { Suspense, lazy } from "react";
import type { Workspace } from "../../api/client";
import { Card } from "../../components/ui";
import { TechnicalDetails } from "../../components/TechnicalDetails";
import {
  discountPercentToRate,
  formatEurosExact,
  formatEurosHeadline,
  formatMaxPoints,
  formatPercent,
  formatPoints1,
} from "../../lib/format";
import { SourceCitations } from "./SourceCitations";
import { hashOrigin } from "./sources";
import type { PricingState } from "./usePricingState";

// recharts stays out of the initial bundle; the curve loads with its section.
const CurveChart = lazy(() => import("./CurveChart").then((m) => ({ default: m.CurveChart })));

interface CurveProps {
  state: PricingState;
}

interface CalcProps {
  workspace: Workspace;
  state: PricingState;
}

export function CurveSection({ state }: CurveProps) {
  const { result, ruleCitations, openEvidence, pending, error, inputsValid, requestCount } = state;
  const h = state.resultHypotheses ?? state.h;
  return (
    <Card aria-label="Curva precio-puntos">
      <h2>Curva precio-puntos</h2>
      {!result && (
        <p className="mt-2 text-sm">
          {inputsValid ? "Calculando tu resultado…" : "Corrige los valores marcados para ver la curva."}
        </p>
      )}
      {result && (
        <Suspense fallback={<p className="mt-2 text-sm">Cargando la curva…</p>}>
          <CurveChart
            curve={result.curve}
            ownPrice={result.price_net}
            ownScore={result.score.value}
            ownMax={result.score.max_points}
            ownProfit={result.profit_net}
            ownCost={result.cost_net}
            discountRate={discountPercentToRate(h.discountPct)}
            rivals={
              h.noRivals
                ? []
                : [
                    { label: "Rival A", price: h.rivalAPrice },
                    { label: "Rival B", price: h.rivalBPrice },
                  ]
            }
            pending={pending || state.resultStale}
            error={inputsValid ? error : null}
            requestCount={requestCount}
          />
        </Suspense>
      )}
      {result && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>
            Curva calculada con los rivales que supones ({result.curve.length} precios distintos);
            tu oferta entra en cada punto. Fuente de la fórmula:{" "}
          </span>
          <SourceCitations citations={ruleCitations} onSelect={openEvidence} />
        </p>
      )}
    </Card>
  );
}

export function CalculationSection({ workspace, state }: CalcProps) {
  const { result, rule, ruleCitations, anomalyCitations, openEvidence, inputsValid } = state;
  const h = state.resultHypotheses ?? state.h;
  const best = result?.trace.find((s) => s.label === "Mejor oferta incluyendo propia")?.value ?? null;
  const scoreDefined =
    result?.score.status === "defined" && result.score.value !== null && best !== null;
  return (
    <Card id="tu-calculo" aria-label="¿Cómo sale tu resultado?" tabIndex={-1}>
      <h2>¿Cómo sale tu resultado?</h2>
      {!result && (
        <p className="mt-2 text-sm">
          {inputsValid ? "Calculando tu resultado…" : "Corrige los valores marcados para ver el cálculo."}
        </p>
      )}
      {result && (
        <div>
          <ol data-testid="calculation-trace" className="mt-2 list-decimal space-y-2 pl-5 text-sm">
            <li>
              {workspace.tender.pbl_net !== null
                ? `Tu precio: ${formatEurosHeadline(workspace.tender.pbl_net)} menos un ${formatPercent(discountPercentToRate(h.discountPct))} = ${formatEurosExact(result.price_net)}.`
                : `Tu precio es ${formatEurosExact(result.price_net)}.`}
            </li>
            <li>
              {best !== null
                ? h.complete && !h.noRivals
                  ? `La oferta más barata es ${formatEurosExact(best)}.`
                  : `De las ofertas supuestas, la más barata es ${formatEurosExact(best)}.`
                : "La oferta más barata está sin determinar."}
            </li>
            <li>
              {scoreDefined
                ? rule?.template_id === "proportional_inverse"
                  ? `Tus puntos: ${formatMaxPoints(result.score.max_points)} puntos máximos × oferta más barata ÷ tu oferta = ${formatPoints1(result.score.value as string)}.`
                  : "Tus puntos dependen de la fórmula del pliego."
                : "Tus puntos están sin determinar."}
            </li>
          </ol>
          <div data-testid="source-hashes" className="mt-3">
            <TechnicalDetails
              items={[
                ...result.trace.map((step) => ({ label: step.label, value: step.expression })),
                {
                  label: "Fórmula de puntos (regla)",
                  value: `${result.pricing_rule_id} rev. ${result.pricing_rule_revision}`,
                },
                ...(rule
                  ? [{ label: "Fórmula de puntos (identificador)", value: rule.template_id }]
                  : []),
                { label: "Motor de cálculo", value: result.engine_version },
                { label: "Empresa", value: `rev. ${result.company_revision}` },
                ...result.source_hashes.map((hash) => ({
                  label: hashOrigin(workspace, hash).label,
                  value: hash,
                })),
              ]}
            />
            <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
              <span>Fuentes de la fórmula y la regla de oferta sospechosa: </span>
              <SourceCitations
                citations={[...ruleCitations, ...anomalyCitations]}
                onSelect={openEvidence}
              />
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
