import { useState } from "react";
import type { Capabilities, Workspace } from "../../api/client";
import { Button } from "../../components/ui";
import { formatDateTime, formatEUR } from "../../lib/format";

interface Props {
  workspace: Workspace;
  capabilities: Capabilities | null;
}

const LIMITATION_ES: Record<string, string> = {
  curated_demo: "Demo curada: las cifras proceden de la semilla revisada, no de extracción en vivo.",
  meta_live_unavailable: "Análisis en vivo no disponible: requiere modo live y clave de modelo configurada.",
  history_disabled: "Histórico desactivado.",
};

function limitationText(code: string): string {
  const key = code.split(":")[0] ?? code;
  return LIMITATION_ES[key] ?? code;
}

export function SummaryTab({ workspace, capabilities }: Props) {
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const tender = workspace.tender;
  const liveReady = capabilities?.meta_configured === true;

  function handleLiveAttempt() {
    if (!liveReady) {
      setLiveMessage(
        "Meta no está configurado en este equipo (falta modo live o clave de modelo). " +
          "Puedes seguir con la demo curada o preparar una revisión manual del PCAP. " +
          "No se ha enviado ningún documento ni se ha simulado un análisis."
      );
      return;
    }
    setLiveMessage(
      "El análisis en vivo aún no está disponible en esta versión del frontal. " +
        "No se ha enviado ningún documento."
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-label="Hechos de la licitación" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Hechos</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Presupuesto neto</dt>
            <dd className="tnum font-semibold">{tender.pbl_net ? formatEUR(tender.pbl_net) : "No localizado"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Presupuesto bruto</dt>
            <dd className="tnum font-semibold">{tender.pbl_gross ? formatEUR(tender.pbl_gross) : "No localizado"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Valor estimado</dt>
            <dd className="tnum font-semibold">
              {tender.estimated_value ? formatEUR(tender.estimated_value) : "No localizado"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Puntos de precio</dt>
            <dd className="tnum font-semibold">
              {workspace.pricing_rules[0] ? `${workspace.pricing_rules[0].max_points} puntos` : "No localizado"}
              <span className="font-normal text-muted"> (los demás puntos no se calculan en esta versión)</span>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Fecha de la instantánea</dt>
            <dd className="font-semibold">{formatDateTime(tender.source_updated_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Estado observado</dt>
            <dd className="font-semibold">{tender.status_raw || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">CPV</dt>
            <dd className="font-semibold">{tender.cpv_codes.join(", ") || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Límite (literal)</dt>
            <dd className="font-semibold">{tender.deadline_literal ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm">
          <span className="font-medium">Fuente oficial: </span>
          <a href={tender.source_url} target="_blank" rel="noreferrer" className="break-all text-primary underline">
            Ver publicación en Contratación del Estado
          </a>
        </p>
        <p className="tnum mt-2 break-all text-xs text-muted">Snapshot {tender.raw_snapshot_sha256}</p>
        {tender.quality_flags.length > 0 && (
          <ul className="mt-2 text-xs text-muted">
            {tender.quality_flags.map((f) => (
              <li key={f}>Calidad: {f}</li>
            ))}
          </ul>
        )}
        {workspace.warnings.length > 0 && (
          <ul className="mt-2 text-xs text-alert">
            {workspace.warnings.map((w) => (
              <li key={w}>Aviso: {w}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4">
        <section aria-label="Reglas de precio" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Reglas de precio</h2>
          {workspace.pricing_rules.length === 0 && <p className="mt-2 text-sm">Sin reglas revisadas.</p>}
          <ul className="mt-2 space-y-2 text-sm">
            {workspace.pricing_rules.map((rule) => (
              <li key={`${rule.id}:${rule.revision}`} className="rounded-lg border border-line p-3">
                <p className="font-semibold">
                  {rule.template_id} · {rule.max_points} puntos · revisión {rule.revision}
                </p>
                <p className="mt-1">
                  Estado de revisión:{" "}
                  <strong>
                    {rule.review_status === "approved"
                      ? "Revisado"
                      : rule.review_status === "blocked"
                        ? "Bloqueado"
                        : "Pendiente"}
                  </strong>
                </p>
                <p className="mt-1">
                  Anormalidad: {rule.anomaly_policy.variant} ({rule.anomaly_policy.review_status === "approved" ? "revisada" : "pendiente"})
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Análisis en vivo" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Análisis en vivo (Meta)</h2>
          {!capabilities && <p className="mt-2 text-sm">Cargando capacidades…</p>}
          {capabilities && (
            <dl className="mt-2 grid gap-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Modo</dt>
                <dd className="font-semibold">{capabilities.mode}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Meta configurado</dt>
                <dd className="font-semibold">{capabilities.meta_configured ? "Sí" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Modelo</dt>
                <dd className="font-semibold">{capabilities.meta_model}</dd>
              </div>
            </dl>
          )}
          {capabilities && capabilities.limitations.length > 0 && (
            <ul className="mt-2 text-sm text-muted">
              {capabilities.limitations.map((l) => (
                <li key={l}>· {limitationText(l)}</li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            data-testid="live-attempt"
            onClick={handleLiveAttempt}
            className="mt-3"
          >
            Intentar análisis en vivo
          </Button>
          {liveMessage && (
            <p data-testid="live-message" role="status" className="mt-3 rounded-lg bg-surface p-3 text-sm">
              {liveMessage}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
