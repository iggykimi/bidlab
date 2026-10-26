// Entradas de hipótesis: baja propia, rivales supuestos y referencias por grupo.
// Los precios rivales son hipótesis declaradas, nunca distribución inferida.

import { DISCOUNT_MAX, DISCOUNT_MIN, DISCOUNT_STEP } from "../../lib/validation";
import { SourceCitations } from "./SourceCitations";
import { branchEs, formatProtocol, reasonEs, variableEs } from "./sources";
import type { Hypotheses, PricingState } from "./usePricingState";

interface Props {
  state: PricingState;
}

export function DiscountSection({ state }: Props) {
  const { h, setField, fieldErrors, pending, requestCount, error, rawError, inputsValid } = state;
  return (
    <section aria-label="Baja propia" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Baja propia sobre PBL neto</h2>
      <div className="mt-3 grid items-end gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Baja (%)</span>
          <input
            type="number"
            data-testid="discount-input"
            min={DISCOUNT_MIN}
            max={DISCOUNT_MAX}
            step={DISCOUNT_STEP}
            value={h.discountPct}
            onChange={(e) => setField("discountPct", Number(e.target.value))}
            className="tnum mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Deslizador de baja (teclado: ← →)</span>
          <input
            type="range"
            data-testid="discount-slider"
            aria-label="Deslizador de baja en tanto por ciento"
            min={DISCOUNT_MIN}
            max={DISCOUNT_MAX}
            step={DISCOUNT_STEP}
            value={h.discountPct}
            onChange={(e) => setField("discountPct", Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
      </div>
      {fieldErrors.discount && (
        <p role="alert" className="mt-2 text-sm text-error">
          {fieldErrors.discount}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Límites de interfaz (0–40 %); no son umbrales legales.{" "}
        {pending ? (
          <span data-testid="updating" role="status">
            Actualizando…
          </span>
        ) : (
          <span data-testid="request-count" className="tnum">
            Petición n.º {requestCount}
          </span>
        )}
      </p>
      {error && inputsValid && (
        <p
          role="alert"
          title={rawError ?? undefined}
          className="mt-2 rounded-lg border border-error p-3 text-sm text-error"
        >
          {error}
        </p>
      )}
    </section>
  );
}

export function HypothesesForm({ state }: Props) {
  const { h, setField, fieldErrors, result } = state;
  return (
    <section aria-label="Hipótesis de rivales" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Hipótesis de rivales</h2>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={h.noRivals}
          onChange={(e) => setField("noRivals", e.target.checked)}
          className="mt-1"
        />
        <span>
          <strong>Sin escenario rival</strong> (puntuación sin determinar; precio y margen siguen
          disponibles)
        </span>
      </label>
      <fieldset disabled={h.noRivals} className="mt-3 grid gap-3 disabled:opacity-50">
        <legend className="sr-only">Precios rivales hipotéticos</legend>
        <label className="block text-sm">
          <span className="font-medium">Hipótesis A · precio neto (€, formato 1234.56)</span>
          <input
            type="text"
            inputMode="decimal"
            data-testid="rival-a-price"
            value={h.rivalAPrice}
            onChange={(e) => setField("rivalAPrice", e.target.value)}
            className="tnum mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          />
        </label>
        {fieldErrors.rivalA && (
          <p role="alert" className="text-sm text-error">
            {fieldErrors.rivalA}
          </p>
        )}
        <label className="block text-sm">
          <span className="font-medium">Hipótesis A · grupo supuesto</span>
          <input
            type="text"
            data-testid="rival-a-group"
            value={h.rivalAGroup}
            onChange={(e) => setField("rivalAGroup", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Hipótesis B · precio neto (€, formato 1234.56)</span>
          <input
            type="text"
            inputMode="decimal"
            data-testid="rival-b-price"
            value={h.rivalBPrice}
            onChange={(e) => setField("rivalBPrice", e.target.value)}
            className="tnum mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          />
        </label>
        {fieldErrors.rivalB && (
          <p role="alert" className="text-sm text-error">
            {fieldErrors.rivalB}
          </p>
        )}
        <label className="block text-sm">
          <span className="font-medium">Hipótesis B · grupo supuesto</span>
          <input
            type="text"
            data-testid="rival-b-group"
            value={h.rivalBGroup}
            onChange={(e) => setField("rivalBGroup", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Grupo propio supuesto</span>
          <input
            type="text"
            data-testid="own-group"
            value={h.ownGroup}
            onChange={(e) => setField("ownGroup", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Calificación del conjunto</span>
          <select
            data-testid="rival-state"
            value={h.rivalState}
            onChange={(e) => setField("rivalState", e.target.value as Hypotheses["rivalState"])}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          >
            <option value="assumed">Supuesto (hipótesis declarada)</option>
            <option value="unspecified">Sin calificar</option>
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="rivals-complete"
            checked={h.complete}
            onChange={(e) => setField("complete", e.target.checked)}
            className="mt-1"
          />
          <span>Conjunto completo supuesto (sin marcar: puntuación sin determinar)</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="groups-confirmed"
            checked={h.groupsConfirmed}
            onChange={(e) => setField("groupsConfirmed", e.target.checked)}
            className="mt-1"
          />
          <span>Grupos independientes supuestos (sin marcar: anormalidad sin determinar)</span>
        </label>
      </fieldset>
      <div
        data-testid="rival-completeness"
        role="status"
        className="mt-3 rounded-lg bg-surface p-3 text-sm"
      >
        {!result && <p>Pendiente de cálculo.</p>}
        {result && (h.noRivals || !h.complete) && (
          <p>
            <strong>Conjunto incompleto supuesto.</strong> Puntuación sin determinar
            {result.score.unknown_variables.length > 0 &&
              ` (faltan: ${result.score.unknown_variables.map(variableEs).join(", ")})`}
            {result.score.reason_codes.length > 0 &&
              ` — ${result.score.reason_codes.map(reasonEs).join("; ")}`}
            . Anormalidad sin determinar también. Precio, beneficio y margen siguen disponibles.
          </p>
        )}
        {result && !h.noRivals && h.complete && (
          <p>
            <strong>Conjunto completo supuesto</strong> (hipótesis declarada). La puntuación
            usa todas las ofertas declaradas, propia incluida
            {result.score.status !== "defined" &&
              `, pero el backend responde ${result.score.status}: ${result.score.reason_codes.map(reasonEs).join("; ") || "sin motivo"}`}
            .
          </p>
        )}
        {result && !h.noRivals && (
          <p className="mt-1">
            {h.groupsConfirmed ? (
              <>Grupos independientes supuestos: la anormalidad usa mínimos por grupo.</>
            ) : (
              <>
                <strong>Pertenencia a grupos sin confirmar:</strong> anormalidad sin determinar
                {result.anomaly.reason_codes.length > 0 &&
                  ` — ${result.anomaly.reason_codes.map(reasonEs).join("; ")}`}
                ; la puntuación no depende de los grupos.
              </>
            )}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Sin las ofertas reales, estos escenarios son hipótesis declaradas. No se infiere ninguna
        distribución de rivales.
      </p>
    </section>
  );
}

export function GroupReferencesSection({ state }: Props) {
  const { h, result, anomalyCitations, openEvidence } = state;
  return (
    <section
      aria-label="Referencias de anormalidad por grupo"
      className="rounded-xl bg-white p-4 shadow-sm sm:p-6"
    >
      <h2 className="text-lg font-semibold">Referencias por grupo</h2>
      {!result && <p className="mt-2 text-sm">Pendiente de cálculo.</p>}
      {result && (
        <div data-testid="group-references" className="mt-2 grid gap-3 text-sm">
          <div>
            <h3 className="text-sm font-semibold">Agrupación declarada (tus supuestos)</h3>
            <ul className="tnum mt-1 space-y-1 text-xs">
              <li>Oferta propia · grupo «{h.ownGroup.trim() || "sin indicar"}»</li>
              {h.noRivals ? (
                <li>Sin escenario rival: no hay ofertas rivales declaradas.</li>
              ) : (
                <>
                  <li>
                    Hipótesis A · {h.rivalAPrice || "—"} € · grupo «
                    {h.rivalAGroup.trim() || "sin indicar"}»
                  </li>
                  <li>
                    Hipótesis B · {h.rivalBPrice || "—"} € · grupo «
                    {h.rivalBGroup.trim() || "sin indicar"}»
                  </li>
                </>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Mínimos por grupo (responde el backend)</h3>
            {result.anomaly.status === "unknown" ||
            result.anomaly.status === "not_applicable" ? (
              <p className="mt-1 text-xs text-muted">
                Referencias sin determinar:{" "}
                {result.anomaly.reason_codes.map(reasonEs).join("; ") || "sin motivo"}.
              </p>
            ) : (
              <dl className="tnum mt-1 grid gap-1 text-xs">
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Ofertas de referencia (mínimos por grupo)</dt>
                  <dd data-testid="reference-count" className="font-semibold">
                    {result.anomaly.reference_offer_count}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Media de referencia</dt>
                  <dd className="break-all font-semibold">
                    {result.anomaly.reference_mean_net
                      ? formatProtocol(result.anomaly.reference_mean_net)
                      : "—"}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Umbral</dt>
                  <dd className="break-all font-semibold">
                    {result.anomaly.threshold_net
                      ? formatProtocol(result.anomaly.threshold_net)
                      : "—"}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Rama aplicada</dt>
                  <dd className="font-semibold">
                    {branchEs(result.anomaly.branch)}
                    {result.anomaly.branch ? ` (${result.anomaly.branch})` : ""}
                  </dd>
                </div>
              </dl>
            )}
          </div>
          <p className="text-xs text-muted">
            El backend usa la oferta más baja de cada grupo confirmado (LCSP 149.3); dos
            rivales del mismo grupo no son dos observaciones independientes. La puntuación
            conserva todas las ofertas declaradas.
          </p>
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
            <span>Fuente de la política: </span>
            <SourceCitations citations={anomalyCitations} onSelect={openEvidence} />
          </p>
        </div>
      )}
    </section>
  );
}
