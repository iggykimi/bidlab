// Entradas de hipótesis: tu rebaja, rivales supuestos y referencias por grupo.
// Los precios rivales son hipótesis declaradas, nunca distribución inferida.

import { Alert, Button, Card } from "../../components/ui";
import {
  PRECIO_INPUT_MODE,
  discountPercentToRate,
  formatEurosExact,
  formatEurosHeadline,
  formatPercent,
  parsePrecioInput,
} from "../../lib/format";
import { DISCOUNT_MAX, DISCOUNT_MIN, DISCOUNT_STEP } from "../../lib/validation";
import { nombreImpuesto } from "../../lib/taxKind";
import { SourceCitations } from "./SourceCitations";
import { branchEs, errorCodeOnly, variableEs } from "./sources";
import type { Hypotheses } from "./hypotheses";
import type { PricingState } from "./usePricingState";

interface Props {
  state: PricingState;
}

function clampDiscount(value: number): number {
  return Math.min(DISCOUNT_MAX, Math.max(DISCOUNT_MIN, Math.round(value * 10) / 10));
}

/** User-typed price -> exact display, or the raw text when unusable. */
function showRivalPrice(raw: string): string {
  if (raw.trim() === "") return "—";
  const norm = parsePrecioInput(raw);
  return norm === null ? raw : formatEurosExact(norm);
}

export function DiscountSection({ state }: Props) {
  const { h, setField, fieldErrors, pending, error, rawError, inputsValid } = state;
  const rawCode = errorCodeOnly(rawError);
  return (
    <Card aria-label="¿Cuánto quieres rebajar?">
      <h2 className="text-lg font-semibold">¿Cuánto quieres rebajar?</h2>
      <p data-testid="discount-readout" className="tnum mt-2 text-base font-semibold">
        Rebaja: {formatPercent(discountPercentToRate(h.discountPct))}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Button
          variant="secondary"
          data-testid="discount-minus"
          aria-label="Quitar un punto de rebaja"
          disabled={h.discountPct <= DISCOUNT_MIN}
          onClick={() => setField("discountPct", clampDiscount(h.discountPct - 1))}
          className="min-w-[48px] shrink-0 text-xl"
        >
          <span aria-hidden="true">−</span>
        </Button>
        <input
          type="range"
          data-testid="discount-slider"
          aria-label="Rebaja en tanto por ciento"
          min={DISCOUNT_MIN}
          max={DISCOUNT_MAX}
          step={DISCOUNT_STEP}
          value={h.discountPct}
          onChange={(e) => setField("discountPct", Number(e.target.value))}
          className="w-full"
        />
        <Button
          variant="secondary"
          data-testid="discount-plus"
          aria-label="Añadir un punto de rebaja"
          disabled={h.discountPct >= DISCOUNT_MAX}
          onClick={() => setField("discountPct", clampDiscount(h.discountPct + 1))}
          className="min-w-[48px] shrink-0 text-xl"
        >
          <span aria-hidden="true">+</span>
        </Button>
      </div>
      <label className="mt-3 block max-w-xs">
        <span className="text-sm font-medium">Escribe tu rebaja (%)</span>
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
      {fieldErrors.discount && (
        <p role="alert" className="mt-2 text-sm text-error">
          {fieldErrors.discount}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Puedes simular rebajas de 0 a 40 %.{" "}
        {pending && (
          <span data-testid="updating">
            Actualizando…
          </span>
        )}
      </p>
      {error && inputsValid && (
        <Alert tone="error" className="mt-2">
          {error}
          {rawCode ? ` (código: ${rawCode})` : ""}
        </Alert>
      )}
    </Card>
  );
}

export function HypothesesForm({ state }: Props) {
  const { h, setField, fieldErrors, result } = state;
  const impuesto = nombreImpuesto(state.scope?.basis.tax_kind ?? "unknown");
  return (
    <Card aria-label="Prueba con precios de rivales">
      <h2>Prueba con precios de rivales</h2>
      <p className="mt-1 text-sm text-muted">Empiezan inventados. Pon los que creas probables.</p>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={h.noRivals}
          onChange={(e) => setField("noRivals", e.target.checked)}
          className="mt-1"
        />
        <span>
          <strong>Simular sin rivales</strong> (tus puntos quedan sin determinar; tu precio y tu
          beneficio siguen disponibles).
        </span>
      </label>
      <fieldset disabled={h.noRivals} className="mt-3 grid gap-3 disabled:opacity-50">
        <legend className="sr-only">Precios rivales supuestos</legend>
        <label className="block text-sm">
          <span className="font-medium">Rival A · precio sin {impuesto} en € (coma o punto)</span>
          <input
            type="text"
            inputMode={PRECIO_INPUT_MODE}
            data-testid="rival-a-price"
            value={h.rivalAPrice}
            onChange={(e) => setField("rivalAPrice", e.target.value)}
            className="tnum mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
            aria-invalid={fieldErrors.rivalA !== undefined}
            aria-describedby={fieldErrors.rivalA ? "rival-a-error" : undefined}
          />
        </label>
        {fieldErrors.rivalA && (
          <p role="alert" id="rival-a-error" className="text-sm text-error">
            {fieldErrors.rivalA}
          </p>
        )}
        <label className="block text-sm">
          <span className="font-medium">Rival B · precio sin {impuesto} en € (coma o punto)</span>
          <input
            type="text"
            inputMode={PRECIO_INPUT_MODE}
            data-testid="rival-b-price"
            value={h.rivalBPrice}
            onChange={(e) => setField("rivalBPrice", e.target.value)}
            className="tnum mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
            aria-invalid={fieldErrors.rivalB !== undefined}
            aria-describedby={fieldErrors.rivalB ? "rival-b-error" : undefined}
          />
        </label>
        {fieldErrors.rivalB && (
          <p role="alert" id="rival-b-error" className="text-sm text-error">
            {fieldErrors.rivalB}
          </p>
        )}
        <label className="block text-sm">
          <span className="font-medium">Estado del conjunto</span>
          <select
            data-testid="rival-state"
            value={h.rivalState}
            onChange={(e) => setField("rivalState", e.target.value as Hypotheses["rivalState"])}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          >
            <option value="assumed">Supuesto (lo declaras tú)</option>
            <option value="unspecified">Sin suponer</option>
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
          <span>Tomar estos como todos los rivales</span>
        </label>
        <details className="rounded-lg border border-border p-3">
          <summary className="flex min-h-[48px] cursor-pointer items-center text-sm font-semibold">
            Opciones avanzadas
          </summary>
          <p className="mt-2 text-sm text-muted">
            Si dos rivales son de la misma empresa, la ley los cuenta como uno. Marca con la
            misma letra los que compartan empresa.
          </p>
          <div className="mt-2 grid gap-3">
            <label className="block text-sm">
              <span className="font-medium">Rival A · grupo</span>
              <input
                type="text"
                data-testid="rival-a-group"
                value={h.rivalAGroup}
                onChange={(e) => setField("rivalAGroup", e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Rival B · grupo</span>
              <input
                type="text"
                data-testid="rival-b-group"
                value={h.rivalBGroup}
                onChange={(e) => setField("rivalBGroup", e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Tu grupo</span>
              <input
                type="text"
                data-testid="own-group"
                value={h.ownGroup}
                onChange={(e) => setField("ownGroup", e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="groups-confirmed"
                checked={h.groupsConfirmed}
                onChange={(e) => setField("groupsConfirmed", e.target.checked)}
                className="mt-1"
              />
              <span>Cada rival es de una empresa distinta</span>
            </label>
          </div>
        </details>
      </fieldset>
      <div
        data-testid="rival-completeness"
        role="status"
        className="mt-3 rounded-lg bg-surface p-3 text-sm"
      >
        {!result && <p>Calculando tu resultado…</p>}
        {result && (h.noRivals || !h.complete) && (
          <p>
            <strong>Supones un conjunto incompleto.</strong> Tus puntos están sin determinar.
            {result.score.unknown_variables.length > 0 &&
              ` Te falta: ${result.score.unknown_variables.map(variableEs).join(", ")}.`}{" "}
            Tu precio y tu beneficio siguen disponibles.
          </p>
        )}
        {result && !h.noRivals && h.complete && (
          <p>
            <strong>Tomas estos como todos los rivales.</strong> Tus puntos usan todas las
            ofertas, incluida la tuya
            {result.score.status !== "defined" ? ", pero siguen sin determinar." : "."}
          </p>
        )}
        {result && !h.noRivals && (
          <p className="mt-1">
            {h.groupsConfirmed ? (
              <>La oferta sospechosa usa mínimos por grupo.</>
            ) : (
              <>
                <strong>Grupos sin confirmar:</strong> no sabemos si tu oferta es
                sospechosa. Tus puntos no dependen de los grupos.
              </>
            )}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        No adivinamos los rivales: usamos tus precios.
      </p>
    </Card>
  );
}

export function GroupReferencesSection({ state }: Props) {
  const { h, result, anomalyCitations, openEvidence } = state;
  return (
    <Card aria-label="Referencias de oferta sospechosa por grupo">
      <h2>Referencias por grupo</h2>
      {!result && <p className="mt-2 text-sm">Calculando tu resultado…</p>}
      {result && (
        <div data-testid="group-references" className="mt-2 grid gap-3 text-sm">
          <div>
            <h3 className="text-sm font-semibold">Cómo las agrupas tú</h3>
            <ul className="tnum mt-1 space-y-1 text-xs">
              <li>Tu oferta · grupo «{h.ownGroup.trim() || "sin letra"}»</li>
              {h.noRivals ? (
                <li>Vas sin rivales: no hay ofertas rivales.</li>
              ) : (
                <>
                  <li>
                    Rival A · {showRivalPrice(h.rivalAPrice)} · grupo «
                    {h.rivalAGroup.trim() || "sin letra"}»
                  </li>
                  <li>
                    Rival B · {showRivalPrice(h.rivalBPrice)} · grupo «
                    {h.rivalBGroup.trim() || "sin letra"}»
                  </li>
                </>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Mínimos por grupo</h3>
            {result.anomaly.status === "unknown" ||
            result.anomaly.status === "not_applicable" ? (
              <p className="mt-1 text-xs text-muted">
                Referencias sin determinar.{" "}
                {h.noRivals || !h.complete
                  ? "Declara todos los rivales para calcularlas."
                  : !h.groupsConfirmed
                    ? "Confirma los grupos para calcularlas."
                    : "Te faltan datos para calcularlas."}
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
                      ? formatEurosHeadline(result.anomaly.reference_mean_net)
                      : "—"}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Umbral</dt>
                  <dd className="break-all font-semibold">
                    {result.anomaly.threshold_net
                      ? formatEurosHeadline(result.anomaly.threshold_net)
                      : "—"}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Caso aplicado</dt>
                  <dd className="font-semibold">{branchEs(result.anomaly.branch)}</dd>
                </div>
              </dl>
            )}
          </div>
          <p className="text-xs text-muted">
            La ley cuenta solo la oferta más barata de cada grupo (art. 149 LCSP). Tus puntos
            conservan todas las ofertas.
          </p>
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
            <span>Fuente de la regla: </span>
            <SourceCitations citations={anomalyCitations} onSelect={openEvidence} />
          </p>
        </div>
      )}
    </Card>
  );
}
