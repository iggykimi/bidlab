// Cola de la columna derecha: supuestos, guardado de escenario e identificadores.
// El guardado conserva la petición íntegra; el informe la reevalúa.

import { Link } from "react-router-dom";
import type { Workspace } from "../../api/client";
import { Button } from "../../components/ui";
import type { PricingRule, PricingScope, PricingState } from "./usePricingState";

interface StateOnly {
  state: PricingState;
}

interface SaveProps {
  workspace: Workspace;
  state: PricingState;
}

interface IdProps {
  scope: PricingScope;
  rule: PricingRule;
  state: PricingState;
}

export function AssumptionsSection({ state }: StateOnly) {
  const { result } = state;
  return (
    <section aria-label="Supuestos" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Supuestos declarados</h2>
      {!result && <p className="mt-2 text-sm">Pendiente de cálculo.</p>}
      {result && (
        <ul data-testid="assumptions" className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {result.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {result && result.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-alert">
          {result.warnings.map((w) => (
            <li key={w}>Aviso: {w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SaveScenarioSection({ workspace, state }: SaveProps) {
  const {
    scenarioName,
    setScenarioName,
    saving,
    inputsValid,
    handleSave,
    saveError,
    saveRawError,
    saveState,
  } = state;
  return (
    <section aria-label="Guardar escenario" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Comparar escenarios</h2>
      <label className="mt-2 block text-sm">
        <span className="font-medium">Nombre del escenario</span>
        <input
          type="text"
          data-testid="scenario-name"
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
        />
      </label>
      <Button
        data-testid="save-scenario"
        onClick={handleSave}
        disabled={saving || !inputsValid}
        className="mt-3"
      >
        {saving ? "Guardando…" : "Guardar escenario"}
      </Button>
      {saveError && (
        <p role="alert" title={saveRawError ?? undefined} className="mt-2 text-sm text-error">
          {saveError}
        </p>
      )}
      {saveState && (
        <p role="status" className="tnum mt-2 break-all text-sm">
          Guardado: <code>{saveState.hash.slice(0, 16)}…</code>{" "}
          <Link
            to={`/tenders/${workspace.tender.id}?tab=informe&scenario=${saveState.id}`}
            className="text-primary underline"
          >
            Abrir en Informe
          </Link>
        </p>
      )}
    </section>
  );
}

export function IdentifiersDetails({ scope, rule, state }: IdProps) {
  const { companyId, companyRevision, companySynthetic, result } = state;
  return (
    <details className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
      <summary className="cursor-pointer font-semibold">Identificadores y códigos</summary>
      <div className="mt-2">
        <div>
      <dl className="tnum grid gap-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt>Ámbito</dt>
          <dd>{scope.id}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Regla</dt>
          <dd>
            {rule.id} rev. {rule.revision} ({rule.review_status})
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Empresa</dt>
          <dd>
            {companyId} rev. {companyRevision ?? "…"}
            {companySynthetic ? " (sintética)" : ""}
          </dd>
        </div>
      </dl>
      {result && (
        <dl className="tnum mt-2 grid gap-1 border-t border-line pt-2 text-xs">
          <div className="flex justify-between gap-2">
            <dt>Puntos (código)</dt>
            <dd>
              {result.score.status}
              {result.score.reason_codes.length > 0 &&
                ` · ${result.score.reason_codes.join(", ")}`}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Anormalidad (código)</dt>
            <dd>
              {result.anomaly.status}
              {result.anomaly.branch ? ` · ${result.anomaly.branch}` : ""}
              {result.anomaly.reason_codes.length > 0 &&
                ` · ${result.anomaly.reason_codes.join(", ")}`}
            </dd>
          </div>
        </dl>
      )}
        </div>
      </div>
    </details>
  );
}
