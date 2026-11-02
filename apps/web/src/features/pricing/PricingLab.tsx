// Composición del Pricing Lab: guardas de estado y rejilla de secciones.
// Sin lógica ni estilos propios; el estado vive en usePricingState.

import { Link } from "react-router-dom";
import type { Workspace } from "../../api/client";
import { CostEditor } from "../company/CostEditor";
import { EvidenceDrawer } from "../evidence/EvidenceDrawer";
import { isOwnTender } from "../review/ownTender";
import { CompareFromPricing } from "./CompareFromPricing";
import { ConclusionSection } from "./ConclusionSection";
import { StressSection } from "./StressSection";
import { CalculationSection, CurveSection } from "./CurveSection";
import { DiscountSection, ExamplePresetsSection, GroupReferencesSection, HypothesesForm } from "./HypothesesForm";
import { KpiSection } from "./KpiSection";
import { AssumptionsSection, IdentifiersDetails, SaveScenarioSection } from "./SaveScenarioSection";
import { usePricingState } from "./usePricingState";

export { anomalyEs } from "./sources";

interface Props {
  workspace: Workspace;
}

export function PricingLab({ workspace }: Props) {
  const state = usePricingState(workspace);
  const { session, companyId, scope, rule } = state;
  const own = isOwnTender(workspace.tender);

  if (!session || !companyId) {
    if (own) {
      return (
        <section aria-label="Precio bloqueado" className="surface">
          <h2>¿Por qué no puedes simular?</h2>
          <p className="mt-2 text-sm">
            Aún no creas tu empresa. Sin tus costes no hay nada que calcular.
          </p>
          <p className="mt-3 text-sm">
            <Link
              to="?tab=revisar#tu-empresa"
              className="font-semibold text-primary underline hover:text-primary-ink"
            >
              Crea tu empresa en Revisar
            </Link>
          </p>
        </section>
      );
    }
    return (
      <p role="status" className="surface">
        Carga el ejemplo desde la biblioteca para simular con la empresa de ejemplo.
      </p>
    );
  }
  if (scope && session.scope_id !== scope.id) {
    // P0-1: never price this scope with another context's company.
    return (
      <section aria-label="Precio bloqueado" className="surface">
        <h2>¿Por qué no puedes simular?</h2>
        <p className="mt-2 text-sm">
          Tu sesión apunta a otra licitación. No mezclamos contextos: vuelve a la biblioteca y
          abre esta licitación de nuevo.
        </p>
        <p className="mt-3 text-sm">
          <Link
            to="/"
            className="font-semibold text-primary underline hover:text-primary-ink"
          >
            Volver a la biblioteca
          </Link>
        </p>
      </section>
    );
  }
  if (!scope || !rule || rule.review_status !== "approved") {
    if (own) {
      return (
        <section aria-label="Precio bloqueado" className="surface">
          <h2>¿Por qué no puedes simular?</h2>
          <p className="mt-2 text-sm">
            Aún no apruebas la fórmula de puntos. Revísala primero y vuelve aquí.
          </p>
          <p className="mt-3 text-sm">
            <Link
              to="?tab=revisar"
              className="font-semibold text-primary underline hover:text-primary-ink"
            >
              Revisa tu fórmula
            </Link>
          </p>
        </section>
      );
    }
    if (!scope || !rule) {
      return (
        <p role="alert" className="surface">
          Esta licitación no tiene ámbito ni fórmula de puntos. No puedes simular nada.
        </p>
      );
    }
    return (
      <p role="alert" className="surface">
        {rule.review_status === "blocked"
          ? "La fórmula de puntos está bloqueada. No puedes simular hasta su revisión."
          : "La fórmula de puntos aún no está revisada. No puedes simular hasta su revisión."}
      </p>
    );
  }

  // Visual hierarchy follows the decision: choose a rebate and keep it
  // (left) while its four figures answer (right); then compare, then
  // understand the curve and rivals, then costs. Specialist tools
  // (group references, stress mesh, identifiers) fold into one closed
  // section so they never compete with the main loop.
  return (
    <div className="stack">
      <div className="pricing-top">
        <div className="pricing-discount">
          <DiscountSection state={state} />
        </div>
        <div className="pricing-figures stack">
          <KpiSection workspace={workspace} state={state} />
          <ConclusionSection state={state} />
        </div>
        <div className="pricing-save">
          <SaveScenarioSection workspace={workspace} state={state} />
        </div>
        {workspace.mode === "demo" && workspace.tender.id === "tias" && (
          <div className="pricing-presets">
            <ExamplePresetsSection state={state} />
          </div>
        )}
      </div>
      <CompareFromPricing
        workspace={workspace}
        scopeFilter={session?.scope_id ?? undefined}
        sessionReady={session !== null}
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid min-w-0 content-start gap-4 lg:col-span-8 [&>*]:min-w-0">
          <CurveSection state={state} />
          <CalculationSection workspace={workspace} state={state} />
        </div>
        <div className="grid min-w-0 content-start gap-4 lg:col-span-4">
          <HypothesesForm state={state} />
          <AssumptionsSection state={state} />
        </div>
      </div>
      <CostEditor
        companyId={companyId}
        tenderId={workspace.tender.id}
        scopeId={scope.id}
        scopeLabel={scope.label}
      />
      <details className="pricing-advanced" data-testid="pricing-advanced">
        <summary>
          <span className="pricing-advanced-title">Análisis avanzado</span>
          <span className="pricing-advanced-hint">
            Referencias por grupo, prueba de resistencia e identificadores.
          </span>
        </summary>
        <div className="stack mt-4">
          <GroupReferencesSection state={state} />
          <StressSection state={state} />
          <IdentifiersDetails scope={scope} rule={rule} state={state} />
        </div>
      </details>
      {state.evidence && (
        <EvidenceDrawer
          key={state.evidence.citation.id}
          workspace={workspace}
          target={state.evidence}
          onClose={state.closeEvidence}
        />
      )}
    </div>
  );
}
