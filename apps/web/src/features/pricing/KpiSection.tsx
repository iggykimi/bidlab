// Indicadores del Pricing Lab: precio, beneficio, puntos y anormalidad.
// Solo muestra cadenas del backend con los formatos de presentación.

import type { Workspace } from "../../api/client";
import { Card, Crossfade } from "../../components/ui";
import {
  discountPercentToRate,
  formatEurosExact,
  formatEurosHeadline,
  formatMaxPoints,
  formatPercent,
  formatPoints,
  formatSignedEurosExact,
} from "../../lib/format";
import { SourceCitations } from "./SourceCitations";
import { anomalyVerdictEs, citationPages } from "./sources";
import { nombreImpuesto } from "../../lib/taxKind";
import type { PricingState } from "./usePricingState";

interface Props {
  workspace: Workspace;
  state: PricingState;
}

/** Plain anomaly sentence from real figures. One template per branch. */
function anomalySentence(
  branch: string | null,
  threshold: string,
  mean: string | null,
  flagged: boolean,
  absoluteClose: boolean
): string {
  const first =
    branch === "n1"
      ? `Con una sola oferta, la tuya es sospechosa si queda por debajo de ${threshold}.`
      : branch === "n2"
        ? `Con dos ofertas, la tuya es sospechosa si queda por debajo de ${threshold}.`
        : branch === "n3_trimmed"
          ? `Una oferta es sospechosa si queda por debajo de ${threshold}, un 10 % menos que la media (${mean}). La más alta no cuenta.`
          : branch === "n4_trimmed"
            ? `Una oferta es sospechosa si queda por debajo de ${threshold}, un 10 % menos que la media (${mean}). Las más altas no cuentan.`
            : branch === "n4_fallback_lowest3"
              ? `Una oferta es sospechosa si queda por debajo de ${threshold}. Ese umbral es un 10 % menos que la media de las tres más bajas (${mean}).`
              : mean !== null
                ? `Una oferta es sospechosa si queda por debajo de ${threshold}, un 10 % menos que la media (${mean}).`
                : `Una oferta es sospechosa si queda por debajo de ${threshold}.`;
  if (flagged && absoluteClose) {
    return `${first} Tu rebaja supera el 25 % sobre el presupuesto, y el pliego también la marca.`;
  }
  return first;
}

export function KpiSection({ workspace, state }: Props) {
  const { result, pending, requestCount, resultStale } = state;
  const h = state.resultHypotheses ?? state.h;
  const rebate = formatPercent(discountPercentToRate(h.discountPct));
  const pblNet = workspace.tender.pbl_net;
  const pblGross = workspace.tender.pbl_gross;
  const impuesto = nombreImpuesto(workspace.tender.scopes[0]?.basis.tax_kind ?? "unknown");
  const flagged = result?.anomaly.status === "possible_justification_required";
  const scoreDefined = result?.score.status === "defined" && result.score.value !== null;
  const absoluteClose =
    flagged &&
    result.anomaly.reason_codes.includes("absolute_25_close") &&
    !result.anomaly.reason_codes.includes("below_relative_threshold");

  return (
    <section
      aria-label="Indicadores"
      aria-busy={pending || resultStale}
      className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2"
    >
      {resultStale && (
        <p
          data-testid="stale-result"
          className="rounded-lg border border-alert bg-warn-bg p-2 text-sm sm:col-span-2"
        >
          Actualizando con tu último cambio… Estas cifras son del cálculo anterior.
        </p>
      )}
      <span role="status" aria-live="polite" className="sr-only" key={requestCount}>
        {resultStale || pending
          ? "Actualizando. Conservamos las cifras del cálculo anterior."
          : result
          ? `Valores actualizados: precio ${formatEurosExact(result.price_net)}${flagged ? ". Zona de aviso: verifica el criterio de baja anormal" : ""}`
          : "Calculando tu resultado…"}
      </span>
      <Card as="div" pad="sm">
        <h2 className="text-sm font-medium text-muted">Tu oferta (sin {impuesto})</h2>
        <p data-testid="price-net" className="tnum text-2xl font-bold">
          <Crossfade key={result ? result.price_net : "none"}>
            {result ? formatEurosExact(result.price_net) : "—"}
          </Crossfade>
        </p>
        <p className="mt-1 text-xs text-muted">
          {result ? `Con una rebaja del ${rebate}.` : "Sin resultado todavía."}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>
            Fuente: presupuesto de salida {pblNet ? formatEurosHeadline(pblNet) : "—"} sin {impuesto}
            {pblGross ? ` (${formatEurosHeadline(pblGross)} con ${impuesto})` : ""}
            {state.pblMeta ? (
              <>
                {" · "}
                <a
                  href={state.pblMeta.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Fuente oficial
                </a>
              </>
            ) : null}
          </span>
          <SourceCitations citations={state.basisCitations} onSelect={state.openEvidence} emptyText="" />
        </p>
      </Card>
      <Card as="div" pad="sm">
        <h2 className="text-sm font-medium text-muted">Tu beneficio</h2>
        <p data-testid="profit-net" className="tnum text-2xl font-bold">
          <Crossfade key={result?.profit_net ?? "none"}>
            {result?.profit_net ? formatSignedEurosExact(result.profit_net) : "—"}
          </Crossfade>
        </p>
        <p className="mt-1 text-xs text-muted">
          {result?.margin_rate
            ? `Margen sobre ventas (${formatPercent(result.margin_rate)}). Es tu beneficio dividido entre tu precio.`
            : "Margen sobre ventas sin determinar."}
        </p>
        <p className="mt-1 text-xs text-muted">
          {result?.cost_net
            ? `Coste: ${formatEurosExact(result.cost_net)}${state.companyName ? ` · ${state.companyName}` : ""}. ${state.companySynthetic ? "Es un dato de ejemplo." : "Es el coste declarado de tu empresa."}`
            : "Tu coste está sin determinar."}
        </p>
      </Card>
      <Card as="div" pad="sm">
        <h2 className="text-sm font-medium text-muted">Tus puntos por precio</h2>
        <p data-testid="economic-score" className="tnum text-2xl font-bold">
          <Crossfade key={result ? `${result.score.status}:${result.score.value ?? ""}` : "none"}>
            {result
              ? scoreDefined
                ? formatPoints(result.score.value as string, result.score.max_points)
                : "Sin determinar"
              : "—"}
          </Crossfade>
        </p>
        <p className="mt-1 text-xs text-muted">
          {!result
            ? "Sin resultado todavía."
            : scoreDefined
              ? "Cuanto más barata tu oferta, más puntos."
              : h.noRivals || !h.complete
                ? "Te faltan rivales por declarar."
                : "Te faltan datos para calcularlos."}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>
            Fuente: fórmula de puntos ·{" "}
            {result ? `${formatMaxPoints(result.score.max_points)} puntos` : "—"}
            {citationPages(state.ruleCitations)}:{" "}
          </span>
          <SourceCitations citations={state.ruleCitations} onSelect={state.openEvidence} />
        </p>
      </Card>
      <Card as="div" pad="sm" data-testid="anomaly-card" className={flagged ? "border border-alert bg-warn-bg" : undefined}>
        <h2 className="text-sm font-medium text-muted">
          {flagged && <span aria-hidden="true">⚠︎ </span>}¿Oferta sospechosamente baja?
        </h2>
        <p data-testid="anomaly-status" className="text-2xl font-bold">
          <Crossfade key={result ? result.anomaly.status : "none"}>
            {result ? anomalyVerdictEs(result.anomaly.status) : "—"}
          </Crossfade>
        </p>
        <div data-testid="anomaly-detail" className="tnum mt-1 text-xs text-muted">
          {!result && <p>Sin resultado todavía.</p>}
          {result && result.anomaly.threshold_net === null && (
            <p>
              {h.noRivals || !h.complete
                ? "Declara todos los rivales para valorarlo."
                : !h.groupsConfirmed
                  ? "Confirma los grupos para valorarlo."
                  : "Sin datos suficientes para valorarlo."}
            </p>
          )}
          {result && result.anomaly.threshold_net !== null && (
            <>
              <p>
                {anomalySentence(
                  result.anomaly.branch,
                  formatEurosHeadline(result.anomaly.threshold_net),
                  result.anomaly.reference_mean_net
                    ? formatEurosHeadline(result.anomaly.reference_mean_net)
                    : null,
                  flagged,
                  absoluteClose
                )}{" "}
                {!flagged
                  ? `Tu oferta (${formatEurosHeadline(result.price_net)}) queda por encima.`
                  : absoluteClose
                    ? `Tu oferta (${formatEurosHeadline(result.price_net)}) supera el 25 % de rebaja: parece sospechosa por el cierre absoluto.`
                    : `Tu oferta (${formatEurosHeadline(result.price_net)}) cae por debajo.`}
              </p>
              {flagged && (
                <p className="mt-1">
                  Si tu oferta cae aquí, la administración te pide que justifiques tus costes.
                </p>
              )}
              <p className="mt-1">
                Comparamos {result.anomaly.reference_offer_count} ofertas de referencia.
              </p>
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          La ley la llama presunción de anormalidad (art. 149 LCSP).
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>Fuente: regla del pliego de condiciones (PCAP){citationPages(state.anomalyCitations)}: </span>
          <SourceCitations citations={state.anomalyCitations} onSelect={state.openEvidence} />
        </p>
      </Card>
    </section>
  );
}
