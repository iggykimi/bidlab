import type { ComponentProps } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CurvePoint } from "../../api/client";
import { Alert } from "../../components/ui";
import {
  formatEurosCompact,
  formatEurosExact,
  formatEurosHeadline,
  formatMaxPoints,
  formatPercent,
  formatPoints,
  formatPoints1,
  formatSignedEurosExact,
  parsePrecioInput,
} from "../../lib/format";
import { anomalyVerdictEs } from "./sources";

export interface RivalLine {
  label: string;
  price: string;
}

interface Props {
  curve: CurvePoint[];
  ownPrice: string;
  ownScore: string | null;
  ownMax: string;
  ownProfit: string | null;
  ownCost: string | null;
  discountRate: string;
  rivals: RivalLine[];
  pending: boolean;
  error: string | null;
  requestCount: number;
}

interface Row {
  price: number;
  rawPrice: string;
  score: number | null;
  profit: number | null;
  discount: string;
  flagged: boolean;
}

function toNum(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export interface FlagSplit {
  runs: { x1: number; x2: number }[];
  isolated: number[];
}

/**
 * Split flagged prices into contiguous hatch runs (2+ distinct prices)
 * and isolated points (dots). Pure: covered by curveFlags.test.ts.
 */
export function splitFlaggedRuns(rows: { price: number; flagged: boolean }[]): FlagSplit {
  const runs: { x1: number; x2: number }[] = [];
  let runStart: number | null = null;
  let runEnd = 0;
  for (const r of rows) {
    if (r.flagged) {
      if (runStart === null) runStart = r.price;
      runEnd = r.price;
    } else if (runStart !== null) {
      if (runEnd > runStart) runs.push({ x1: runStart, x2: runEnd });
      runStart = null;
    }
  }
  if (runStart !== null && runEnd > runStart) runs.push({ x1: runStart, x2: runEnd });
  const inRun = (price: number): boolean => runs.some((run) => price >= run.x1 && price <= run.x2);
  return { runs, isolated: rows.filter((r) => r.flagged && !inRun(r.price)).map((r) => r.price) };
}

// Shared axes/tooltip config (recharts needs direct <XAxis>/<Tooltip>
// children, so the sharing unit is props objects, not components).
const CHART_MARGIN = { top: 24, right: 24, bottom: 28, left: 8 };

const PRICE_X_AXIS: ComponentProps<typeof XAxis> = {
  type: "number",
  dataKey: "price",
  domain: ["dataMin", "dataMax"],
  tick: { fontSize: 14 },
  tickFormatter: (v: number): string => formatEurosCompact(String(v)),
  minTickGap: 48,
};

const AXIS_TICK = { fontSize: 14 };

function tooltipLabel(label: unknown): string {
  return typeof label === "number" ? `Precio ${formatEurosExact(String(label))}` : "—";
}

function tooltipPoints(value: unknown): string {
  return typeof value === "number" ? formatPoints1(String(value)) : "—";
}

function tooltipProfit(value: unknown): string {
  return typeof value === "number" ? formatSignedEurosExact(String(value)) : "—";
}

/**
 * Price→points and price→profit curves. Every point comes from the API
 * response; rival lines mark your own hypotheses. Chart animation is off by
 * design: the 1500ms line-draw replayed on every slider tick and added
 * nothing over the static curve.
 */
export function CurveChart({
  curve,
  ownPrice,
  ownScore,
  ownMax,
  ownProfit,
  ownCost,
  discountRate,
  rivals,
  pending,
  error,
  requestCount,
}: Props) {
  if (curve.length === 0) {
    return (
      <p role="status" data-testid="curve-chart">
        La curva no tiene puntos para este rango.
      </p>
    );
  }
  // Display order is price ascending (curve arrives discount ascending).
  const rows: Row[] = curve
    .map((p) => ({
      price: Number(p.price_net),
      rawPrice: p.price_net,
      score: p.score.value !== null ? toNum(p.score.value) : null,
      profit: p.profit_net !== null ? toNum(p.profit_net) : null,
      discount: p.discount_rate,
      flagged: p.anomaly_status === "possible_justification_required",
    }))
    .filter((r) => Number.isFinite(r.price))
    .sort((a, b) => a.price - b.price);
  if (rows.length === 0) {
    return (
      <p role="status" data-testid="curve-chart">
        La curva no tiene puntos para este rango.
      </p>
    );
  }

  const first = rows[0] as Row;
  const last = rows[rows.length - 1] as Row;
  const ownPriceNum = toNum(ownPrice);
  const ownScoreNum = toNum(ownScore);
  const ownProfitNum = toNum(ownProfit);
  const maxNum = toNum(ownMax);
  const validRivals = rivals
    .map((r) => ({ label: r.label, norm: parsePrecioInput(r.price) }))
    .filter((r): r is { label: string; norm: string } => r.norm !== null && Number(r.norm) > 0);
  const cheapest =
    validRivals.length > 0
      ? validRivals.reduce((a, b) => (Number(b.norm) < Number(a.norm) ? b : a))
      : null;

  const scoreMax = rows.reduce((m, r) => (r.score !== null ? Math.max(m, r.score) : m), 0);
  const yMax = Math.max(scoreMax, maxNum ?? 0) > 0 ? Math.max(scoreMax, maxNum ?? 0) : 1;
  const allScoresNull = rows.every((r) => r.score === null);
  const allProfitNull = rows.every((r) => r.profit === null);
  // Own-dot label: short "Tu oferta" just under the dot (full figures
  // live in the caption). Only bottom-hugging dots label above, so the
  // text never clips into the ticks.
  const profitMax = rows.reduce((m, r) => (r.profit !== null ? Math.max(m, r.profit) : m), 0);
  const profitMin = rows.reduce(
    (m, r) => (r.profit !== null ? Math.min(m, r.profit) : m),
    profitMax
  );
  const scoreLabelAbove =
    ownScoreNum !== null && maxNum !== null && maxNum > 0 && ownScoreNum <= maxNum * 0.15;
  const profitLabelAbove =
    ownProfitNum !== null &&
    profitMax > profitMin &&
    ownProfitNum <= profitMin + (profitMax - profitMin) * 0.12;

  // Contiguous flagged runs (≥2 points) hatch; isolated flagged points
  // get dots, otherwise lone points were invisible on the curve.
  const { runs: flaggedRuns, isolated: isolatedPrices } = splitFlaggedRuns(rows);
  const isolatedSet = new Set(isolatedPrices);
  const isolatedFlagged = rows.filter((r) => isolatedSet.has(r.price));
  const flaggedCount = rows.filter((r) => r.flagged).length;

  let deltaClause = "";
  if (cheapest !== null && ownPriceNum !== null) {
    const delta = Math.round((ownPriceNum - Number(cheapest.norm)) * 100) / 100;
    if (delta === 0) {
      deltaClause = " — empatas con el rival más barato";
    } else if (delta < 0) {
      deltaClause = ` — ${formatEurosExact(String(Math.abs(delta)))} menos que el rival más barato`;
    } else {
      deltaClause = ` — ${formatEurosExact(String(delta))} más que el rival más barato`;
    }
  }
  const pointsTitle =
    ownScore !== null
      ? `A ${formatEurosHeadline(ownPrice)} consigues ${formatPoints(ownScore, ownMax)}${deltaClause}.`
      : `A ${formatEurosHeadline(ownPrice)} tus puntos están sin determinar${deltaClause}.`;
  const profitTitle =
    (ownProfit !== null
      ? `${formatSignedEurosExact(ownProfit)} a tu rebaja del ${formatPercent(discountRate)}`
      : `Tu beneficio está sin determinar a tu rebaja del ${formatPercent(discountRate)}`) +
    (ownCost !== null ? ` · equilibrio en ${formatEurosHeadline(ownCost)}` : "") +
    ".";
  const flaggedClause =
    flaggedCount > 0
      ? `, ${flaggedCount} en zona sospechosa`
      : "";
  const scoreAria = `Curva precio-puntos, ${rows.length} puntos de ${formatEurosHeadline(first.rawPrice)} a ${formatEurosHeadline(last.rawPrice)}${flaggedClause}. Tu oferta ${formatEurosHeadline(ownPrice)}: ${ownScore !== null ? `${formatPoints1(ownScore)} puntos` : "puntos sin determinar"}`;
  const profitAria = `Curva precio-beneficio, ${rows.length} puntos de ${formatEurosHeadline(first.rawPrice)} a ${formatEurosHeadline(last.rawPrice)}${flaggedClause}. Tu oferta ${formatEurosHeadline(ownPrice)}: beneficio ${ownProfit !== null ? formatSignedEurosExact(ownProfit) : "sin determinar"}`;

  return (
    <div className="grid gap-4" data-testid="curve-chart" aria-busy={pending}>
      <p role="status" aria-live="polite" className="sr-only" key={requestCount}>
        {pending
          ? "Actualizando la curva. Conservamos el cálculo anterior."
          : `A ${formatEurosExact(ownPrice)}: ${ownScore !== null ? `${formatPoints1(ownScore)} puntos` : "puntos sin determinar"}, beneficio ${ownProfit !== null ? formatSignedEurosExact(ownProfit) : "sin determinar"}`}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {pending && <p role="status">Actualizando la curva…</p>}
      <figure>
        <figcaption>
          <p className="font-semibold">{pointsTitle}</p>
          <p className="text-sm text-muted">Puntos según tu precio de oferta.</p>
        </figcaption>
        {allScoresNull ? (
          <p role="status" className="mt-2">
            Sin determinar
          </p>
        ) : (
          <>
          <ul className="curve-legend" data-testid="curve-legend">
            <li>
              <span className="curve-legend-line" aria-hidden="true" /> Puntos por precio
            </li>
            <li>
              <span className="curve-legend-dot" aria-hidden="true" /> Tu oferta
            </li>
            <li>
              <span className="curve-legend-rival" aria-hidden="true" /> Rivales supuestos
            </li>
            {flaggedCount > 0 && (
              <li>
                <span className="curve-legend-hatch" aria-hidden="true" /> Zona de aviso: oferta
                sospechosa
              </li>
            )}
          </ul>
          <div className="h-56 sm:h-64" role="img" aria-label={scoreAria} aria-describedby="curve-table">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={CHART_MARGIN}>
                <defs>
                  <pattern
                    id="anomaly-hatch"
                    width="8"
                    height="8"
                    patternTransform="rotate(45)"
                    patternUnits="userSpaceOnUse"
                  >
                    <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-alert)" strokeWidth="1" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis {...PRICE_X_AXIS} />
                <YAxis
                  tick={AXIS_TICK}
                  width={64}
                  allowDecimals={false}
                  domain={[0, yMax]}
                  label={{ value: "Puntos", angle: -90, position: "insideLeft" }}
                />
                <Tooltip formatter={tooltipPoints} labelFormatter={tooltipLabel} />
                {flaggedRuns.map((run) => (
                  <ReferenceArea
                    key={`${run.x1}-${run.x2}`}
                    x1={run.x1}
                    x2={run.x2}
                    fill="url(#anomaly-hatch)"
                  />
                ))}
                {isolatedFlagged.map(
                  (r) =>
                    r.score !== null && (
                      <ReferenceDot
                        key={`flag-${r.price}`}
                        x={r.price}
                        y={r.score}
                        r={6}
                        fill="var(--color-alert)"
                        stroke="var(--color-white)"
                        strokeWidth={2}
                      />
                    )
                )}
                {maxNum !== null && (
                  <ReferenceLine
                    y={maxNum}
                    stroke="var(--color-primary)"
                    strokeDasharray="4 4"
                    label={{ value: `Máx. ${formatMaxPoints(ownMax)} puntos`, position: "insideTopLeft", fontSize: 14 }}
                  />
                )}
                {validRivals.map((r, i) => (
                  <ReferenceLine
                    key={r.label}
                    x={Number(r.norm)}
                    stroke="var(--color-muted)"
                    strokeDasharray="4 4"
                    label={{
                      value: r.label,
                      position: i % 2 === 0 ? "insideTop" : "insideBottom",
                      fontSize: 14,
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Puntos"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {ownPriceNum !== null && ownScoreNum !== null && (
                  <ReferenceDot
                    x={ownPriceNum}
                    y={ownScoreNum}
                    r={5}
                    fill="var(--color-primary)"
                    stroke="var(--color-primary)"
                    label={{
                      value: "Tu oferta",
                      position: scoreLabelAbove ? "top" : "bottom",
                      fontSize: 14,
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-sm text-muted">Tu precio de oferta (€)</p>
          </>
        )}
      </figure>
      <figure>
        <figcaption>
          <p className="font-semibold">{profitTitle}</p>
          <p className="text-sm text-muted">Beneficio según tu precio de oferta.</p>
        </figcaption>
        {allProfitNull ? (
          <p role="status" className="mt-2">
            Sin determinar
          </p>
        ) : (
          <>
          <div className="h-56 sm:h-64" role="img" aria-label={profitAria} aria-describedby="curve-table">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis {...PRICE_X_AXIS} />
                <YAxis
                  tick={AXIS_TICK}
                  width={88}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number): string => formatEurosCompact(String(v))}
                  label={{ value: "Beneficio (€)", angle: -90, position: "insideLeft" }}
                />
                <Tooltip formatter={tooltipProfit} labelFormatter={tooltipLabel} />
                <ReferenceLine
                  y={0}
                  stroke="var(--color-muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Equilibrio (${formatEurosHeadline("0")})`,
                    position: "insideBottomRight",
                    fontSize: 14,
                  }}
                />
                {validRivals.map((r, i) => (
                  <ReferenceLine
                    key={r.label}
                    x={Number(r.norm)}
                    stroke="var(--color-muted)"
                    strokeDasharray="4 4"
                    label={{
                      value: r.label,
                      position: i % 2 === 0 ? "insideTop" : "insideBottom",
                      fontSize: 14,
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Beneficio €"
                  stroke="var(--color-chart-profit)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {ownPriceNum !== null && ownProfitNum !== null && (
                  <ReferenceDot
                    x={ownPriceNum}
                    y={ownProfitNum}
                    r={5}
                    fill="var(--color-chart-profit)"
                    stroke="var(--color-chart-profit)"
                    label={{
                      value: "Tu oferta",
                      position: profitLabelAbove ? "top" : "bottom",
                      fontSize: 14,
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-sm text-muted">Tu precio de oferta (€)</p>
          </>
        )}
      </figure>
      <details data-testid="curve-table" id="curve-table">
        <summary className="flex min-h-[48px] cursor-pointer items-center text-sm font-semibold">
          Ver la curva como tabla ({curve.length} filas)
        </summary>
        <div className="mt-2">
          <div
            className="table-scroll max-h-64 overflow-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabla de la curva, desplázate para ver todas las filas"
          >
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">
                Tabla con los puntos de la curva: rebaja, precio, puntos, beneficio y oferta
                sospechosa
              </caption>
              <thead>
                <tr className="text-left">
                  <th scope="col" className="border-b border-border p-2">Rebaja</th>
                  <th scope="col" className="border-b border-border p-2">Tu precio</th>
                  <th scope="col" className="border-b border-border p-2">Puntos</th>
                  <th scope="col" className="border-b border-border p-2">Beneficio</th>
                  <th scope="col" className="border-b border-border p-2">¿Oferta sospechosa?</th>
                </tr>
              </thead>
              <tbody>
                {curve.map((p) => (
                  <tr key={p.discount_rate}>
                    <td className="tnum border-b border-line p-2">{formatPercent(p.discount_rate)}</td>
                    <td className="tnum border-b border-line p-2">{formatEurosExact(p.price_net)}</td>
                    <td className="tnum border-b border-line p-2">
                      {p.score.status === "defined" && p.score.value !== null
                        ? formatPoints(p.score.value, p.score.max_points)
                        : "Sin determinar"}
                    </td>
                    <td className="tnum border-b border-line p-2">
                      {p.profit_net !== null ? formatSignedEurosExact(p.profit_net) : "—"}
                    </td>
                    <td className="border-b border-line p-2">{anomalyVerdictEs(p.anomaly_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
