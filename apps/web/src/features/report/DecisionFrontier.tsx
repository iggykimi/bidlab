import { useQuery } from "@tanstack/react-query";
import type { FrontierEntry, FrontierResult } from "../../api/client";
import { decisionFrontier } from "../../api/client";
import { Alert, Badge, Card } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import { formatPoints1, formatSignedEurosExact } from "../../lib/format";

const VERDICT_ES: Record<FrontierEntry["verdict"], string> = {
  en_frontera: "En la frontera",
  dominada: "Dominada",
  excluida: "Excluida",
};

function verdictTone(verdict: FrontierEntry["verdict"]): "live" | "neutral" | "demo" {
  if (verdict === "en_frontera") return "live";
  if (verdict === "dominada") return "neutral";
  return "demo";
}

/**
 * V3 P1-01: una anómala fuera de la frontera "requiere revisión" (presunción),
 * nunca se presenta como excluida legalmente. Solo presentación: el motivo
 * backend junto a la insignia lo explica.
 */
function verdictLabel(entry: FrontierEntry): string {
  if (entry.verdict === "excluida" && entry.anomaly_status === "possible_justification_required") {
    return "Requiere revisión";
  }
  return VERDICT_ES[entry.verdict];
}

function EntryRow({ entry }: { entry: FrontierEntry }) {
  return (
    <tr>
      <td className="border-b border-line p-2">
        <strong>{entry.name}</strong>
      </td>
      <td className="border-b border-line p-2">
        <Badge tone={verdictTone(entry.verdict)}>{verdictLabel(entry)}</Badge>
      </td>
      <td className="tnum border-b border-line p-2">
        {entry.profit_net !== null ? formatSignedEurosExact(entry.profit_net) : "—"}
      </td>
      <td className="tnum border-b border-line p-2">
        {entry.score_value !== null ? formatPoints1(entry.score_value) : "Sin determinar"}
      </td>
    </tr>
  );
}

/**
 * Pareto frontier over the compared scenarios (BL-V2-05). The backend
 * classifies with Decimal dominance; this view only renders verdicts and
 * motivos. Unknown figures and anomaly-flagged scenarios arrive excluded.
 */
export function DecisionFrontier({ scenarioIds }: { scenarioIds: string[] }) {
  const frontierQuery = useQuery<FrontierResult, Error>({
    queryKey: ["frontier", ...scenarioIds],
    queryFn: ({ signal }) => decisionFrontier({ scenario_ids: scenarioIds }, signal),
    staleTime: Infinity,
  });

  return (
    <Card aria-label="Frontera de decisión">
      <h2>¿Cuál resiste la comparación?</h2>
      <p className="mt-1 text-sm text-muted">
        Una prueba está en la frontera si ninguna otra iguala o supera sus puntos
        y beneficio y mejora al menos uno de los dos. Solo se comparan pruebas
        del mismo contexto.
      </p>
      {frontierQuery.isPending && (
        <p className="mt-2 text-sm" role="status">
          Calculando la frontera…
        </p>
      )}
      {frontierQuery.isError && (
        <p
          role="alert"
          title={errorCode(frontierQuery.error) ?? undefined}
          className="mt-2 text-sm text-error"
        >
          {errorEs(frontierQuery.error, "No pudimos calcular la frontera.")}
        </p>
      )}
      {frontierQuery.data && (
        <div className="mt-3 grid gap-3" data-testid="frontier-result">
          <ul className="grid gap-2">
            {frontierQuery.data.entries.map((entry) => (
              <li
                key={entry.scenario_id}
                data-testid={`frontier-entry-${entry.scenario_id}`}
                className="rounded-lg border border-line p-3 text-sm"
              >
                <p>
                  <strong>{entry.name}</strong> ·{" "}
                  <Badge tone={verdictTone(entry.verdict)}>{verdictLabel(entry)}</Badge>
                </p>
                <p className="mt-1">{entry.motivo}</p>
              </li>
            ))}
          </ul>
          <div
            className="table-scroll overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabla de la frontera, desplázate horizontalmente"
          >
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">
                Pruebas con su veredicto de frontera, beneficio y puntos
              </caption>
              <thead>
                <tr className="text-left">
                  <th scope="col" className="border-b border-border p-2">
                    Prueba
                  </th>
                  <th scope="col" className="border-b border-border p-2">
                    Veredicto
                  </th>
                  <th scope="col" className="border-b border-border p-2">
                    Beneficio
                  </th>
                  <th scope="col" className="border-b border-border p-2">
                    Puntos
                  </th>
                </tr>
              </thead>
              <tbody>
                {frontierQuery.data.entries.map((entry) => (
                  <EntryRow key={entry.scenario_id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
          {frontierQuery.data.warnings.length > 0 && (
            <Alert tone="warn">
              <ul className="list-disc pl-5">
                {frontierQuery.data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
}
