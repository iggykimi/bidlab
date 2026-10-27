// Analysis tracker for own tenders: ask for automatic proposals, then
// follow the job. The backend runs the job inline (POST returns 202 with
// the terminal state), so polling only confirms it; pausing and leaving
// only stop YOUR tracking, never the server run. Honest by design.

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCapabilities,
  getJob,
  isAbort,
  startAnalysis,
  type Job,
  type Workspace,
} from "../../api/client";
import { TechnicalDetails } from "../../components/TechnicalDetails";
import { Button, Card } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import { isTerminalJobStatus, jobStatusEs, jobWarningEs } from "./ownTender";

interface Props {
  workspace: Workspace;
}

const POLL_MS = 2000;

export function AnalysisTracker({ workspace }: Props) {
  const queryClient = useQueryClient();
  const tenderId = workspace.tender.id;
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [unfollowed, setUnfollowed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const startingRef = useRef(false);

  const capsQuery = useQuery({
    queryKey: ["capabilities"],
    queryFn: ({ signal }) => getCapabilities(signal),
  });
  const liveAvailable = capsQuery.data?.meta_configured === true;
  const useLive = liveAvailable && consent;

  const terminal = job !== null && isTerminalJobStatus(job.status);

  async function refreshWorkspace() {
    await queryClient.invalidateQueries({ queryKey: ["workspace", tenderId] });
  }

  async function pollOnce() {
    if (!job) return;
    try {
      const fresh = await getJob(job.id);
      setJob(fresh);
      if (isTerminalJobStatus(fresh.status)) {
        setFollowing(false);
        await refreshWorkspace();
      }
    } catch (err) {
      if (isAbort(err)) return;
      setError(errorEs(err, "No pudimos leer el análisis. Vuelve a intentarlo en unos segundos."));
      setRawError(errorCode(err));
      setFollowing(false);
    }
  }

  useEffect(() => {
    if (!following || paused || !job || isTerminalJobStatus(job.status)) return;
    const timer = window.setInterval(() => void pollOnce(), POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pollOnce reads the latest job id.
  }, [following, paused, job?.id, job?.status]);

  async function handleStart() {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    setRawError(null);
    setUnfollowed(false);
    try {
      const started = await startAnalysis(tenderId, {
        document_ids: workspace.documents.map((d) => d.id).slice(0, 10),
        mode: useLive ? "live" : "curated_demo",
        allow_remote_processing: useLive,
        expected_interpretation_revision: workspace.interpretation_revision,
      });
      setJob(started.job);
      setLocation(started.location);
      if (isTerminalJobStatus(started.job.status)) {
        setFollowing(false);
        await refreshWorkspace();
      } else {
        setFollowing(true);
        setPaused(false);
      }
    } catch (err) {
      setError(errorEs(err, "No pudimos pedir el análisis. Vuelve a intentarlo en unos segundos."));
      setRawError(errorCode(err));
      await refreshWorkspace();
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  function handleUnfollow() {
    setFollowing(false);
    setPaused(false);
    setUnfollowed(true);
  }

  if (workspace.documents.length === 0) {
    return (
      <Card aria-label="Análisis automático">
        <h2 className="text-lg font-semibold">¿Pides propuestas automáticas?</h2>
        <p className="mt-2 text-sm">
          Esta licitación no tiene documento. El formulario de abajo basta para revisar.
        </p>
      </Card>
    );
  }

  const progress =
    job !== null && job.total_pages > 0
      ? `Página ${Math.min(job.processed_pages, job.total_pages)} de ${job.total_pages}`
      : null;

  return (
    <Card aria-label="Análisis automático">
      <h2 className="text-lg font-semibold">¿Pides propuestas automáticas?</h2>
      {!job && (
        <div className="mt-2 grid gap-3 text-sm">
          <p>
            Leemos tu PDF y proponemos cifras. Tú decides después en el formulario.
          </p>
          {capsQuery.isPending && <p role="status">Comprobando el servicio…</p>}
          {liveAvailable ? (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                data-testid="analysis-consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-5 w-5"
              />
              <span>Acepto enviar mi PDF al servicio de análisis.</span>
            </label>
          ) : (
            capsQuery.isSuccess && (
              <p>Sin servicio de análisis: no habrá propuestas automáticas.</p>
            )
          )}
          {error && (
            <p role="alert" title={rawError ?? undefined} className="text-error">
              {error}
            </p>
          )}
          <div>
            <Button
              data-testid="analysis-start"
              onClick={() => void handleStart()}
              disabled={starting || capsQuery.isPending}
            >
              {starting ? "Pidiendo…" : "Pedir propuestas automáticas"}
            </Button>
          </div>
        </div>
      )}

      {job && (
        <div className="mt-2 grid gap-3 text-sm">
          <p data-testid="analysis-status" role="status">
            Estado: <strong>{jobStatusEs(job.status)}</strong>
            {progress ? ` · ${progress}` : ""}
            {paused && !terminal ? " · en pausa" : ""}
          </p>
          {job.total_pages > 0 && (
            <div
              role="progressbar"
              aria-label="Progreso del análisis"
              aria-valuenow={Math.min(job.processed_pages, job.total_pages)}
              aria-valuemin={0}
              aria-valuemax={job.total_pages}
              data-testid="analysis-progress"
              className="h-2 overflow-hidden rounded-full bg-surface"
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${(Math.min(job.processed_pages, job.total_pages) / job.total_pages) * 100}%` }}
              />
            </div>
          )}
          {following && !paused && !terminal && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" data-testid="analysis-pause" onClick={() => setPaused(true)}>
                Pausar seguimiento
              </Button>
              <Button variant="secondary" data-testid="analysis-unfollow" onClick={handleUnfollow}>
                Dejar de seguir
              </Button>
            </div>
          )}
          {following && paused && !terminal && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" data-testid="analysis-resume" onClick={() => setPaused(false)}>
                Reanudar seguimiento
              </Button>
              <Button variant="secondary" data-testid="analysis-unfollow" onClick={handleUnfollow}>
                Dejar de seguir
              </Button>
            </div>
          )}
          {unfollowed && (
            <p data-testid="analysis-unfollowed" className="rounded-lg bg-surface p-3">
              Dejaste de seguir el análisis. Ya se ejecutó en el servidor: esto no lo detiene.
            </p>
          )}
          {terminal && (
            <div className="grid gap-2">
              {job.result_revision !== null ? (
                <p>
                  Ya tienes la revisión {job.result_revision}. Sigue con el formulario de abajo.
                </p>
              ) : job.status === "failed" ? (
                <p>El análisis falló. Puedes pedirlo de nuevo o revisar a mano.</p>
              ) : (
                <p>El análisis terminó sin nueva revisión. Revisa a mano abajo.</p>
              )}
              {job.warnings.length > 0 && (
                <ul className="list-disc pl-5">
                  {job.warnings.map((w, i) => (
                    <li key={`${i}-${w}`}>{jobWarningEs(w)}</li>
                  ))}
                </ul>
              )}
              <div>
                <Button
                  variant="secondary"
                  data-testid="analysis-retry"
                  onClick={() => {
                    setJob(null);
                    setUnfollowed(false);
                  }}
                >
                  Pedir otro análisis
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" title={rawError ?? undefined} className="text-error">
              {error}
            </p>
          )}
          <TechnicalDetails
            items={[
              { label: "Análisis", value: job.id },
              ...(location ? [{ label: "Recurso", value: location }] : []),
              { label: "Etapa", value: job.stage },
              ...(job.error_code ? [{ label: "Código de fallo", value: job.error_code }] : []),
              ...job.warnings.map((w, i) => ({ label: `Aviso ${i + 1} (original)`, value: w })),
            ]}
          />
        </div>
      )}
    </Card>
  );
}
