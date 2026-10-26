// Visualizaciones del resultado: curva precio-puntos y traza de cálculo.
// La curva llega del backend con rivales fijos; recharts queda fuera del bundle inicial.

import { Suspense, lazy } from "react";
import type { Workspace } from "../../api/client";
import { SourceCitations } from "./SourceCitations";
import { formatProtocol, hashOrigin } from "./sources";
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
  const { result, ruleCitations, openEvidence } = state;
  return (
    <section aria-label="Curva precio-puntos" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Curva precio-puntos</h2>
      {!result && <p className="mt-2 text-sm">Pendiente de cálculo.</p>}
      {result && (
        <Suspense fallback={<p className="mt-2 text-sm">Cargando la curva…</p>}>
          <CurveChart curve={result.curve} />
        </Suspense>
      )}
      {result && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>
            Curva del backend con rivales fijos ({result.curve.length} puntos); la propia
            oferta entra en cada punto. Fuente de la fórmula:{" "}
          </span>
          <SourceCitations citations={ruleCitations} onSelect={openEvidence} />
        </p>
      )}
    </section>
  );
}

export function CalculationSection({ workspace, state }: CalcProps) {
  const { result, ruleCitations, anomalyCitations, openEvidence } = state;
  return (
    <section aria-label="Cálculo" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Ver cálculo</h2>
      {!result && <p className="mt-2 text-sm">Pendiente de cálculo.</p>}
      {result && (
        <div data-testid="calculation-trace" className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">
              Pasos de cálculo devueltos por el backend: precio, mejor oferta, puntuación,
              anormalidad y margen
            </caption>
            <thead>
              <tr className="text-left">
                <th scope="col" className="border-b border-border p-2">Paso</th>
                <th scope="col" className="border-b border-border p-2">Expresión</th>
                <th scope="col" className="border-b border-border p-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {result.trace.map((step) => (
                <tr key={step.label}>
                  <td className="border-b border-line p-2 font-medium">{step.label}</td>
                  <td className="border-b border-line p-2">
                    <code className="tnum break-all text-xs">{step.expression}</code>
                  </td>
                  <td className="tnum border-b border-line p-2">
                    {step.value === null ? "sin determinar" : formatProtocol(step.value)}{" "}
                    {step.value !== null && (
                      <code className="block text-xs text-muted">{step.value}</code>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tnum mt-2 text-xs text-muted">
            Regla {result.pricing_rule_id} rev. {result.pricing_rule_revision} · motor{" "}
            {result.engine_version} · empresa rev. {result.company_revision}
          </p>
          <div data-testid="source-hashes" className="mt-3">
            <h3 className="text-sm font-semibold">
              Huellas de fuente ({result.source_hashes.length})
            </h3>
            {result.source_hashes.length === 0 && (
              <p className="mt-1 text-xs text-muted">
                El backend no devolvió huellas de fuente.
              </p>
            )}
            <ul className="mt-1 space-y-1 text-xs">
              {result.source_hashes.map((hash) => (
                <li key={hash} className="tnum break-all">
                  <code title={hash}>{hash.slice(0, 16)}…</code>{" "}
                  <span className="text-muted">· {hashOrigin(workspace, hash).label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
              <span>Fuentes de la regla y la política: </span>
              <SourceCitations
                citations={[...ruleCitations, ...anomalyCitations]}
                onSelect={openEvidence}
              />
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
