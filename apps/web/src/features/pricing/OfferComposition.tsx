import type { EvaluationResult } from "../../api/client";
import { formatEurosExact, formatSignedEurosExact } from "../../lib/format";

/** Geometry only. All money and the profit sign come from the backend result. */
export function OfferComposition({ result, stale }: { result: EvaluationResult; stale: boolean }) {
  if (result.cost_net === null || result.profit_net === null) return null;
  const price = Number(result.price_net);
  const cost = Number(result.cost_net);
  if (!Number.isFinite(price) || !Number.isFinite(cost) || price < 0 || cost < 0) return null;
  const extent = Math.max(price, cost);
  if (extent <= 0) return null;
  const priceWidth = (price / extent) * 1000;
  const costWidth = (cost / extent) * 1000;
  const loss = result.profit_net.startsWith("-");

  return (
    <figure className="offer-composition" data-testid="offer-composition" aria-busy={stale}>
      <figcaption>
        <h3>¿Qué parte cubre tus costes?</h3>
        {stale && <p className="text-sm text-muted">Reparto del cálculo anterior.</p>}
      </figcaption>
      <svg viewBox="0 0 1000 42" width="100%" height="42" aria-hidden="true" focusable="false">
        <rect x="0" y="5" width="1000" height="32" rx="8" fill="var(--color-primary-soft)" />
        <rect x="0" y="5" width={Math.min(priceWidth, costWidth)} height="32" rx="8" fill="var(--color-primary)" />
        {loss ? (
          <rect x={priceWidth} y="5" width={Math.max(0, costWidth - priceWidth)} height="32" fill="var(--color-error)" />
        ) : (
          <rect x={costWidth} y="5" width={Math.max(0, priceWidth - costWidth)} height="32" fill="var(--color-green)" />
        )}
        <line x1={priceWidth} x2={priceWidth} y1="0" y2="42" stroke="var(--color-ink)" strokeWidth="4" />
      </svg>
      <dl className="composition-legend">
        <div><dt><span className="composition-key" aria-hidden="true" />Tu coste</dt><dd>{formatEurosExact(result.cost_net)}</dd></div>
        <div className={loss ? "composition-loss" : "composition-profit"}>
          <dt><span className="composition-key" aria-hidden="true" />{loss ? "Tu pérdida" : "Tu beneficio"}</dt>
          <dd>{formatSignedEurosExact(result.profit_net)}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted">
        {loss
          ? "Tu oferta no cubre el coste. La parte roja queda fuera de tu precio."
          : "La línea marca tu precio. La parte verde es el beneficio que calcula el motor."}
      </p>
    </figure>
  );
}
