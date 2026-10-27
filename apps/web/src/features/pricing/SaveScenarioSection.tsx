// Cola de la columna derecha: supuestos, guardado de escenario e identificadores.
// El guardado conserva la petición íntegra; el informe la reevalúa.

import { Link } from "react-router-dom";
import type { Workspace } from "../../api/client";
import { Button, Card } from "../../components/ui";
import { TechnicalDetails } from "../../components/TechnicalDetails";
import { assumptionEs } from "../../lib/assumptions";
import { errorCodeOnly } from "./sources";
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

/** Backend warning -> plain line. Debug-only shapes return null (-> Detalles técnicos). */
function warningEs(warning: string): string | null {
  if (warning.includes("original bytes not redistributed")) {
    return "El PDF no se comparte; aquí solo verás las citas.";
  }
  return null;
}

export function AssumptionsSection({ state }: StateOnly) {
  const { h, result } = state;
  const warnings = result?.warnings ?? [];
  const plainWarnings = warnings.map(warningEs).filter((w): w is string => w !== null);
  const internalWarnings = warnings.filter((w) => warningEs(w) === null);
  return (
    <Card aria-label="Supuestos">
      <h2 className="text-lg font-semibold">Supuestos declarados</h2>
      {!result && <p className="mt-2 text-sm">Calculando tu resultado…</p>}
      {result && (
        <ul data-testid="assumptions" className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {result.assumptions.map((a) => (
            <li key={a}>{assumptionEs(a, result.cost_net, h.noRivals)}</li>
          ))}
        </ul>
      )}
      {plainWarnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-alert">
          {plainWarnings.map((w) => (
            <li key={w}>Aviso: {w}</li>
          ))}
        </ul>
      )}
      {internalWarnings.length > 0 && (
        <TechnicalDetails
          title="Avisos internos"
          items={internalWarnings.map((w, i) => ({ label: `Aviso ${i + 1}`, value: w }))}
          className="mt-2"
        />
      )}
    </Card>
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
    saveIsCurrent,
  } = state;
  const rawCode = errorCodeOnly(saveRawError);
  return (
    <Card aria-label="¿Guardas esta prueba?">
      <h2 className="text-lg font-semibold">¿Guardas esta prueba?</h2>
      <label className="mt-2 block text-sm">
        <span className="font-medium">Nombre de tu prueba</span>
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
        {saving ? "Guardando…" : "Guardar esta prueba"}
      </Button>
      {saveError && (
        <p role="alert" className="mt-2 text-sm text-error">
          {saveError}
          {rawCode ? ` (código: ${rawCode})` : ""}
        </p>
      )}
      {saveState && saveIsCurrent && (
        <p role="status" className="mt-2 text-sm">
          Prueba «{saveState.name}» guardada.{" "}
          <Link
            to={`/tenders/${workspace.tender.id}?tab=informe&scenario=${saveState.id}`}
            className="text-primary underline"
          >
            Verla en el informe
          </Link>
        </p>
      )}
      {saveState && !saveIsCurrent && (
        <p role="status" className="mt-2 text-sm">
          Cambios desde la copia guardada «{saveState.name}».{" "}
          <Link
            to={`/tenders/${workspace.tender.id}?tab=informe&scenario=${saveState.id}`}
            className="text-primary underline"
          >
            Verla en el informe
          </Link>
        </p>
      )}
    </Card>
  );
}

export function IdentifiersDetails({ scope, rule, state }: IdProps) {
  const { companyId, companyRevision, companySynthetic, result } = state;
  return (
    <TechnicalDetails
      title="Identificadores y códigos"
      items={[
        { label: "Ámbito", value: scope.id },
        { label: "Fórmula de puntos (regla)", value: `${rule.id} rev. ${rule.revision} (${rule.review_status})` },
        {
          label: "Empresa",
          value: `${companyId} rev. ${companyRevision ?? "…"}`,
        },
        ...(companySynthetic ? [{ label: "Empresa de ejemplo", value: "synthetic: true" }] : []),
        ...(result
          ? [
              {
                label: "Puntos (código)",
                value: `${result.score.status}${result.score.reason_codes.length > 0 ? ` · ${result.score.reason_codes.join(", ")}` : ""}`,
              },
              {
                label: "Oferta sospechosa (código)",
                value: `${result.anomaly.status}${result.anomaly.branch ? ` · ${result.anomaly.branch}` : ""}${result.anomaly.reason_codes.length > 0 ? ` · ${result.anomaly.reason_codes.join(", ")}` : ""}`,
              },
            ]
          : []),
      ]}
    />
  );
}
