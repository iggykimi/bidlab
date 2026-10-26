// Indicadores del Pricing Lab: precio, beneficio, puntos y anormalidad.
// Solo muestra cadenas del backend con los formatos de presentación.

import type { Workspace } from "../../api/client";
import { discountPercentToRate, formatEUR, formatPoints, formatRate, formatSignedEUR } from "../../lib/format";
import { Crossfade } from "../../components/ui";
import { SourceCitations } from "./SourceCitations";
import { anomalyEs, branchEs, citationPages, formatProtocol, reasonEs, variableEs } from "./sources";
import type { PricingRule, PricingState } from "./usePricingState";

interface Props {
  workspace: Workspace;
  rule: PricingRule;
  state: PricingState;
}

export function KpiSection({ workspace, rule, state }: Props) {
  const { result, pending, requestCount, h } = state;
  return (
    <section
      aria-label="Indicadores"
      aria-busy={pending}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <span role="status" aria-live="polite" className="sr-only" key={requestCount}>
        {result ? `Valores actualizados: precio ${formatEUR(result.price_net)}` : "Pendiente de cálculo"}
      </span>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-muted">Precio neto de oferta</h2>
        <p data-testid="price-net" className="tnum text-2xl font-bold">
          <Crossfade key={result ? result.price_net : "none"}>
            {result ? formatEUR(result.price_net) : "—"}
          </Crossfade>
        </p>
        <p className="mt-1 text-xs text-muted">
          Calculado · {result ? `baja ${formatRate(discountPercentToRate(h.discountPct))}` : "pendiente"}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>
            Fuente: PBL neto {workspace.tender.pbl_net ? formatEUR(workspace.tender.pbl_net) : "—"}
            {state.pblMeta ? (
              <>
                {" · "}
                <a
                  href={state.pblMeta.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Fuente oficial (Atom)
                </a>
              </>
            ) : null}
          </span>
          <SourceCitations citations={state.basisCitations} onSelect={state.openEvidence} emptyText="" />
        </p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-muted">Beneficio / margen</h2>
        <p data-testid="profit-net" className="tnum text-2xl font-bold">
          <Crossfade key={result?.profit_net ?? "none"}>
            {result?.profit_net ? formatSignedEUR(result.profit_net) : "—"}
          </Crossfade>
        </p>
        <p className="mt-1 text-xs text-muted">
          {result?.margin_rate ? `Margen ${formatRate(result.margin_rate)}` : "Margen —"} · coste{" "}
          {result?.cost_net ? formatEUR(result.cost_net) : "—"} (empresa sintética)
        </p>
        <p className="mt-1 text-xs text-muted">
          Fuente: coste de empresa sintética
          {state.companyName ? ` «${state.companyName}»` : ""} (hipótesis declarada, sin
          cita documental).
        </p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-muted">Puntos de precio bajo este escenario</h2>
        <p data-testid="economic-score" className="tnum text-2xl font-bold">
          <Crossfade key={result ? `${result.score.status}:${result.score.value ?? ""}` : "none"}>
            {result
              ? result.score.status === "defined" && result.score.value !== null
                ? `${formatPoints(result.score.value)} / ${formatPoints(result.score.max_points)}`
                : "Sin determinar"
              : "—"}
          </Crossfade>
        </p>
        <p className="mt-1 text-xs text-muted">
          {result
            ? result.score.status === "defined"
              ? `Mejor oferta incluyendo la propia · máx. ${result.score.max_points}`
              : `${result.score.reason_codes.map(reasonEs).join("; ") || "sin motivo"} · faltan: ${result.score.unknown_variables.map(variableEs).join(", ") || "—"}`
            : "pendiente"}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>
            Fuente: regla {rule.template_id} · {rule.max_points} puntos{citationPages(state.ruleCitations)}:{" "}
          </span>
          <SourceCitations citations={state.ruleCitations} onSelect={state.openEvidence} />
        </p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-muted">Presunción de anormalidad</h2>
        <p data-testid="anomaly-status" className="text-2xl font-bold">
          <Crossfade key={result ? result.anomaly.status : "none"}>
            {result ? anomalyEs(result.anomaly.status) : "—"}
          </Crossfade>
        </p>
        <p data-testid="anomaly-detail" className="tnum mt-1 text-xs text-muted">
          {result
            ? result.anomaly.status === "unknown" || result.anomaly.status === "not_applicable"
              ? `${result.anomaly.policy_id} · ${result.anomaly.reason_codes.map(reasonEs).join("; ") || "sin motivo"}`
              : `${result.anomaly.policy_id} · rama ${branchEs(result.anomaly.branch)} · ` +
                `media ${result.anomaly.reference_mean_net ? formatProtocol(result.anomaly.reference_mean_net) : "—"} · ` +
                `umbral ${result.anomaly.threshold_net ? formatProtocol(result.anomaly.threshold_net) : "—"} · ` +
                `${result.anomaly.reference_offer_count} ofertas de referencia`
            : "pendiente"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {result
            ? `Presunción condicional, no exclusión automática${result.anomaly.branch ? ` · rama ${result.anomaly.branch}` : ""}`
            : "pendiente"}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
          <span>Fuente: política {rule.anomaly_policy.variant}{citationPages(state.anomalyCitations)}: </span>
          <SourceCitations citations={state.anomalyCitations} onSelect={state.openEvidence} />
        </p>
      </div>
    </section>
  );
}
