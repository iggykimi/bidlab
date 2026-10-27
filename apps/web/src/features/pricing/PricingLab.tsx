// Composición del Pricing Lab: guardas de estado y rejilla de secciones.
// Sin lógica ni estilos propios; el estado vive en usePricingState.

import type { Workspace } from "../../api/client";
import { CostEditor } from "../company/CostEditor";
import { EvidenceDrawer } from "../evidence/EvidenceDrawer";
import { ConclusionSection } from "./ConclusionSection";
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

  if (!session || !companyId) {
    return (
      <p role="status" className="rounded-xl bg-white p-4 shadow-sm">
        Carga el ejemplo desde la biblioteca para simular con la empresa de ejemplo.
      </p>
    );
  }
  if (!scope || !rule) {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 shadow-sm">
        Esta licitación no tiene ámbito ni fórmula de puntos. No puedes simular nada.
      </p>
    );
  }
  if (rule.review_status !== "approved") {
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
      <ConclusionSection state={state} />
      <KpiSection workspace={workspace} state={state} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid min-w-0 content-start gap-4 lg:col-span-8 [&>*]:min-w-0">
          <DiscountSection state={state} />
          <CurveSection state={state} />
          <CalculationSection workspace={workspace} state={state} />
        </div>
        <div className="grid min-w-0 content-start gap-4 lg:col-span-4">
          <HypothesesForm state={state} />
          <SaveScenarioSection workspace={workspace} state={state} />
          <CostEditor
            companyId={companyId}
            tenderId={workspace.tender.id}
            scopeId={scope.id}
            scopeLabel={scope.label}
          />
          <GroupReferencesSection state={state} />
          <AssumptionsSection state={state} />
          <IdentifiersDetails scope={scope} rule={rule} state={state} />
        </div>
      </div>
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
