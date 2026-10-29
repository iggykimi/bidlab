import { useQuery } from "@tanstack/react-query";
import { getJob, type Workspace } from "../../api/client";
import { Card } from "../../components/ui";
import { loadTrackedAnalysis } from "./analysisJobStore";
import { buildCoverageModel } from "./coverageModel";
import { isOwnTender } from "./ownTender";

/**
 * «Dónde hemos mirado» BL-V2-07 (§9): transparencia sobre páginas citadas
 * y enviadas al modelo, sin porcentajes inventados ni confirmadas
 * inferidas. Vive junto al estado del trabajo, en Revisar.
 */
export function CoverageCard({ workspace }: { workspace: Workspace }) {
  const tenderId = workspace.tender.id;
  const own = isOwnTender(workspace.tender);
  const tracked = loadTrackedAnalysis(tenderId);
  const jobQuery = useQuery({
    queryKey: ["tracked-job", tenderId, tracked?.jobId ?? "none"],
    queryFn: ({ signal }) => getJob(tracked?.jobId ?? "", signal),
    enabled: tracked !== null,
    staleTime: 30_000,
  });
  const model = buildCoverageModel({
    documents: workspace.documents,
    claims: workspace.claims,
    citations: workspace.citations,
    trackedJob: jobQuery.data ?? null,
  });
  const job = model.trackedJob;

  return (
    <Card aria-label="Envío al modelo" data-testid="coverage-job">
      <h2>Envío al modelo</h2>
      {!own && <p className="mt-1 text-sm">Esta es una demostración curada.</p>}
      {model.documents.length === 0 && (
        <p className="mt-2 text-sm">Sin documento todavía. Los valores son manuales.</p>
      )}
      {model.documents.map(({ document, citedPages }) => (
        <div key={document.id} className="mt-2 text-sm">
          <p>
            Documento: {document.display_name} ({document.pages_count}{" "}
            {document.pages_count === 1 ? "página" : "páginas"})
          </p>
          {document.pages_count <= 60 ? (
            <ol className="coverage-strip" aria-label={`Páginas de ${document.display_name}`}>
              {Array.from({ length: document.pages_count }, (_, i) => i + 1).map((n) => (
                <li key={n} data-cited={citedPages.includes(n) ? "true" : undefined}>
                  {n}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1">
              {citedPages.length === 0
                ? "Ninguna página citada todavía."
                : `Páginas citadas: ${citedPages.join(", ")}.`}
            </p>
          )}
          {document.pages_count <= 60 && (
            <p className="mt-1">
              {citedPages.length === 0
                ? "Ninguna página citada todavía."
                : `Páginas que respaldan propuestas: ${citedPages.join(", ")}.`}
            </p>
          )}
        </div>
      ))}
      {model.delivered !== null && job !== null && (
        <p className="mt-2 text-sm">
          {job.status === "queued" || job.status === "running"
            ? `Enviadas al modelo: ${model.delivered.sent} de ${model.delivered.total} (en curso).`
            : job.status === "failed" || job.status === "cancelled"
              ? "El análisis falló; lo enviado no produjo propuestas."
              : job.mode === "live"
                ? `Enviadas al modelo: ${model.delivered.sent} de ${model.delivered.total}.`
                : `Prueba simulada: ${model.delivered.sent} de ${model.delivered.total} preparadas.`}
        </p>
      )}
      {job?.mode === "live" && (
        <p className="mt-1 text-sm">La pasada automática examina hasta 6 páginas.</p>
      )}
      {model.documents.length > 0 && (
        <>
          <p className="mt-2 text-sm">
            Este análisis ha priorizado algunas páginas. No sustituye una revisión integral.
          </p>
          <p className="mt-1 text-sm">
            Cómo completar la revisión: abre el PDF original y coteja cada requisito a mano.
          </p>
        </>
      )}
    </Card>
  );
}
