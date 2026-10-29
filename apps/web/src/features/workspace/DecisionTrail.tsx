import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Workspace } from "../../api/client";
import { getJob, listTenderReports, listTenderScenarios } from "../../api/client";
import { loadSession } from "../../lib/session";
import { loadTrackedAnalysis } from "../review/analysisJobStore";
import { isOwnTender } from "../review/ownTender";
import { buildDecisionTrace, TRACE_STATE_ES } from "./decisionTrace";

/**
 * Barra de rastro BL-V2-12 (§14): índice navegable a secciones existentes,
 * nunca un segundo estado fuente. Recalcula desde la fuente al cambiar de
 * escenario/ámbito; los conteos comparten claves con los badges de pasos.
 */
export function DecisionTraceBar({ workspace }: { workspace: Workspace }) {
  const tenderId = workspace.tender.id;
  const session = loadSession();
  const scope = session?.tender_id === tenderId ? session.scope_id : undefined;
  const tracked = loadTrackedAnalysis(tenderId);

  const scenariosQuery = useQuery({
    queryKey: ["stepCounts", tenderId, scope ?? "none", "scenarios"],
    queryFn: ({ signal }) => listTenderScenarios(tenderId, { scopeId: scope, pageSize: 1, signal }),
    enabled: tenderId !== "" && scope !== undefined,
  });
  const reportsQuery = useQuery({
    queryKey: ["trail-reports", tenderId, scope ?? "none"],
    queryFn: ({ signal }) =>
      listTenderReports(tenderId, { scopeId: scope, pageSize: 100, signal }),
    enabled: tenderId !== "" && scope !== undefined,
  });
  const jobQuery = useQuery({
    queryKey: ["tracked-job", tenderId, tracked?.jobId ?? "none"],
    queryFn: ({ signal }) => getJob(tracked?.jobId ?? "", signal),
    enabled: tracked !== null,
    staleTime: 30_000,
  });

  const steps = buildDecisionTrace({
    own: isOwnTender(workspace.tender),
    documents: workspace.documents,
    claims: workspace.claims,
    rule: workspace.pricing_rules[0] ?? null,
    trackedJob: jobQuery.data ?? null,
    scenarioTotal: scenariosQuery.data?.total ?? null,
    reports: reportsQuery.data?.items ?? null,
  });

  return (
    <nav aria-label="Rastro de decisión" data-testid="decision-trace">
      <ol className="trace-bar">
        {steps.map((step, index) => (
          <li key={step.id} data-state={step.state}>
            <span className="trace-node" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <p className="trace-head">
                {step.href !== undefined ? (
                  <Link to={step.href}>{step.label}</Link>
                ) : (
                  <span>{step.label}</span>
                )}{" "}
                <span className="trace-state">· {TRACE_STATE_ES[step.state]}</span>
              </p>
              <p className="trace-detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
