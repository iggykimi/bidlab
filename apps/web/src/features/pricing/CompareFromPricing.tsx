// Comparar desde Precio (R06): reutiliza la bandeja de Informe con la
// misma consulta de pruebas guardadas, sin otro índice global.

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listTenderScenarios, type Workspace } from "../../api/client";
import { Card } from "../../components/ui";
import { formatMaxPoints } from "../../lib/format";
import { CompareSection } from "../report/CompareSection";

interface Props {
  workspace: Workspace;
  scopeFilter: string | undefined;
  sessionReady: boolean;
}

export function CompareFromPricing({ workspace, scopeFilter, sessionReady }: Props) {
  const scenariosQuery = useQuery({
    queryKey: ["tenderScenarios", workspace.tender.id, scopeFilter],
    queryFn: ({ signal }) =>
      listTenderScenarios(workspace.tender.id, { scopeId: scopeFilter, pageSize: 100, signal }),
    enabled: sessionReady,
  });
  const scenarioItems = [...(scenariosQuery.data?.items ?? [])].reverse();

  if (scenariosQuery.isPending) return null;
  if (scenariosQuery.isError) {
    return (
      <Card aria-label="Comparar pruebas">
        <h2 className="text-lg font-semibold">¿Qué prueba te conviene más?</h2>
        <p className="mt-2 text-sm">
          No pudimos cargar tus pruebas aquí.{" "}
          <Link
            to={`/tenders/${workspace.tender.id}?tab=informe`}
            className="font-semibold text-primary underline"
          >
            Míralas en el informe
          </Link>
        </p>
      </Card>
    );
  }
  return (
    <div className="grid gap-2">
      <CompareSection
        summaries={scenarioItems}
        scoreMax={
          workspace.pricing_rules[0] ? formatMaxPoints(workspace.pricing_rules[0].max_points) : "—"
        }
      />
      <p className="text-sm">
        <Link
          to={`/tenders/${workspace.tender.id}?tab=informe`}
          className="font-semibold text-primary underline hover:text-primary-ink"
        >
          Lleva una prueba al informe para decidir
        </Link>
      </p>
    </div>
  );
}
