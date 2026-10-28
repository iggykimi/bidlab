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
import { DiscountSection, GroupReferencesSection, HypothesesForm } from "./HypothesesForm";
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
        <section aria-label="Precio bloqueado" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">¿Por qué no puedes simular?</h2>
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
      <p role="status" className="rounded-xl bg-white p-4 shadow-sm">
        Carga el ejemplo desde la biblioteca para simular con la empresa de ejemplo.
      </p>
    );
  }
  if (scope && session.scope_id !== scope.id) {
    // P0-1: never price this scope with another context's company.
    return (
      <section aria-label="Precio bloqueado" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">¿Por qué no puedes simular?</h2>
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
        <section aria-label="Precio bloqueado" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">¿Por qué no puedes simular?</h2>
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
        <p role="alert" className="rounded-xl bg-white p-4 shadow-sm">
          Esta licitación no tiene ámbito ni fórmula de puntos. No puedes simular nada.
        </p>
      );
    }
    return (
      <p role="alert" className="rounded-xl bg-white p-4 shadow-sm">
        {rule.review_status === "blocked"
          ? "La fórmula de puntos está bloqueada. No puedes simular hasta su revisión."
          : "La fórmula de puntos aún no está revisada. No puedes simular hasta su revisión."}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <DiscountSection state={state} />
      <KpiSection workspace={workspace} state={state} />
      <ConclusionSection state={state} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid min-w-0 content-start gap-4 lg:col-span-8 [&>*]:min-w-0">
          <CurveSection state={state} />
          <CalculationSection workspace={workspace} state={state} />
        </div>
        <div className="grid min-w-0 content-start gap-4 lg:col-span-4">
          <HypothesesForm state={state} />
          <SaveScenarioSection workspace={workspace} state={state} />
          <GroupReferencesSection state={state} />
          <AssumptionsSection state={state} />
          <IdentifiersDetails scope={scope} rule={rule} state={state} />
        </div>
      </div>
      <CompareFromPricing
        workspace={workspace}
        scopeFilter={session?.scope_id ?? undefined}
        sessionReady={session !== null}
      />
      <StressSection state={state} />
      <CostEditor
        companyId={companyId}
        tenderId={workspace.tender.id}
        scopeId={scope.id}
        scopeLabel={scope.label}
      />
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
