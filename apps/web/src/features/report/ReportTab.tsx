import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ApiError,
  createReport,
  fetchReportHtml,
  getReport,
  getScenario,
  type Decision,
  type Report,
  type Scenario,
  type Workspace,
} from "../../api/client";
import { formatDateTime, formatEUR, formatPoints } from "../../lib/format";
import { listSavedReports, listSavedScenarios, rememberReport } from "../../lib/session";
import { reportNoteSchema } from "../../lib/validation";
import { anomalyEs } from "../pricing/PricingLab";

interface Props {
  workspace: Workspace;
}

const DECISIONS: { value: Decision; label: string }[] = [
  { value: "study", label: "Seguir estudiando" },
  { value: "prepare", label: "Preparar oferta" },
  { value: "discard", label: "Descartar" },
];

export function decisionEs(decision: Decision): string {
  return DECISIONS.find((d) => d.value === decision)?.label ?? decision;
}

function ScenarioDetail({ scenario }: { scenario: Scenario }) {
  const r = scenario.result;
  return (
    <div className="mt-2 grid gap-2 text-sm" data-testid="scenario-detail">
      <p>
        <strong>{scenario.name}</strong> · guardado {formatDateTime(scenario.created_at)}
      </p>
      <dl className="grid gap-1">
        <div className="flex justify-between gap-4">
          <dt className="text-[#3A4560]">Precio neto</dt>
          <dd className="tnum font-semibold">{formatEUR(r.price_net)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#3A4560]">Beneficio</dt>
          <dd className="tnum font-semibold">{r.profit_net ? formatEUR(r.profit_net) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#3A4560]">Puntos</dt>
          <dd className="tnum font-semibold">
            {r.score.status === "defined" && r.score.value !== null
              ? `${formatPoints(r.score.value)} / ${formatPoints(r.score.max_points)}`
              : `Sin determinar (${r.score.status})`}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#3A4560]">Anormalidad</dt>
          <dd className="font-semibold">{anomalyEs(r.anomaly.status)}</dd>
        </div>
      </dl>
      <p className="tnum text-xs text-[#3A4560]">
        Regla {r.pricing_rule_id} rev. {r.pricing_rule_revision} · empresa rev. {r.company_revision} ·
        motor {r.engine_version}
      </p>
      <p className="tnum break-all text-xs">
        Snapshot <code data-testid="scenario-hash">{scenario.snapshot_sha256}</code>
      </p>
      <div>
        <h4 className="font-semibold">Hipótesis</h4>
        <ul className="list-disc pl-5">
          {r.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold">Pendientes ({scenario.context.pending_items.length})</h4>
        <ul className="list-disc pl-5">
          {scenario.context.pending_items.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold">Fuentes ({scenario.context.citations.length})</h4>
        <ul className="list-disc pl-5">
          {scenario.context.citations.map((c) => (
            <li key={c.id}>
              {c.id} · p. {c.page_number} · {c.match_status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReportDetail({ report }: { report: Report }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloadError(null);
    try {
      const html = await fetchReportHtml(report.id);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bidlab-informe-${report.id}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? `${err.code}: ${err.message}` : "No se pudo descargar");
    }
  }

  async function handlePreview() {
    setDownloadError(null);
    try {
      setPreview(await fetchReportHtml(report.id));
    } catch (err) {
      setDownloadError(err instanceof ApiError ? `${err.code}: ${err.message}` : "No se pudo previsualizar");
    }
  }

  return (
    <div className="mt-2 grid gap-2 text-sm" data-testid="report-detail">
      <p>
        Decisión: <strong data-testid="report-decision">{decisionEs(report.decision)}</strong> ·{" "}
        {formatDateTime(report.created_at)}
      </p>
      <div>
        <h4 className="font-semibold">Nota de decisión</h4>
        <p className="whitespace-pre-wrap rounded-lg bg-[#F6F7FB] p-3" data-testid="report-note">
          {report.note || "—"}
        </p>
      </div>
      <div>
        <h4 className="font-semibold">Pendientes ({report.pending_items.length})</h4>
        <ul className="list-disc pl-5">
          {report.pending_items.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <ScenarioDetail scenario={report.scenario} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="download-report"
          onClick={handleDownload}
          className="rounded-lg bg-[#3159D9] px-4 py-2 font-semibold text-white"
        >
          Descargar HTML
        </button>
        <button
          type="button"
          onClick={handlePreview}
          className="rounded-lg border border-[#3159D9] px-4 py-2 font-semibold text-[#3159D9]"
        >
          {preview ? "Ocultar vista previa" : "Vista previa del HTML"}
        </button>
      </div>
      {downloadError && (
        <p role="alert" className="text-[#B42318]">
          {downloadError}
        </p>
      )}
      {preview !== null && (
        <iframe
          title="Vista previa del informe"
          srcDoc={preview}
          sandbox=""
          className="h-96 w-full rounded-lg border border-[#C9D2E8] bg-white"
        />
      )}
    </div>
  );
}

export function ReportTab({ workspace }: Props) {
  const [params] = useSearchParams();
  const [scenarioIds, setScenarioIds] = useState<string[]>(() => listSavedScenarios());
  const [selectedScenario, setSelectedScenario] = useState<string | null>(() => params.get("scenario"));
  const [reportIds, setReportIds] = useState<string[]>(() => listSavedReports());
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>("study");
  const [note, setNote] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const scenarioQuery = useQuery({
    queryKey: ["scenario", selectedScenario],
    queryFn: ({ signal }) => getScenario(selectedScenario ?? "", signal),
    enabled: selectedScenario !== null,
  });
  const reportQuery = useQuery({
    queryKey: ["report", selectedReport],
    queryFn: ({ signal }) => getReport(selectedReport ?? "", signal),
    enabled: selectedReport !== null,
  });

  async function handleExport() {
    setExportError(null);
    if (!selectedScenario) {
      setExportError("Selecciona un escenario guardado antes de exportar.");
      return;
    }
    const parsed = reportNoteSchema.safeParse(note);
    if (!parsed.success) {
      setExportError(parsed.error.issues[0]?.message ?? "Nota no válida");
      return;
    }
    setExporting(true);
    try {
      const created = await createReport(selectedScenario, decision, parsed.data);
      setReportIds(rememberReport(created.id));
      setSelectedReport(created.id);
    } catch (err) {
      setExportError(err instanceof ApiError ? `${err.code}: ${err.message}` : "No se pudo exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <section aria-label="Escenarios guardados" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Escenarios guardados</h2>
        {scenarioIds.length === 0 && (
          <p className="mt-2 text-sm">
            Aún no hay escenarios. Guárdalos desde el Pricing Lab con «Guardar escenario».
          </p>
        )}
        {scenarioIds.length > 0 && (
          <ul className="mt-2 space-y-2">
            {scenarioIds.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScenario(id);
                    setScenarioIds(listSavedScenarios());
                  }}
                  aria-pressed={selectedScenario === id}
                  className={`tnum w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedScenario === id ? "border-[#3159D9] bg-[#E8EFFF]" : "border-[#E5E9F2]"
                  }`}
                >
                  Abrir escenario <code>{id.slice(0, 8)}…</code>
                </button>
              </li>
            ))}
          </ul>
        )}
        {scenarioQuery.isPending && selectedScenario && <p className="mt-2 text-sm">Cargando escenario…</p>}
        {scenarioQuery.isError && (
          <p role="alert" className="mt-2 text-sm text-[#B42318]">
            No se pudo cargar el escenario.
          </p>
        )}
        {scenarioQuery.data && <ScenarioDetail scenario={scenarioQuery.data} />}
      </section>

      <section aria-label="Construir informe" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Construir informe</h2>
        <p className="mt-1 text-sm text-[#3A4560]">
          La decisión la tomas tú; el informe conserva el escenario, las fuentes y los pendientes.
        </p>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">Decisión manual</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            {DECISIONS.map((d) => (
              <label key={d.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="decision"
                  value={d.value}
                  checked={decision === d.value}
                  onChange={() => setDecision(d.value)}
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-3 block text-sm">
          <span className="font-medium">Comentario (se conserva tal cual en el informe)</span>
          <textarea
            data-testid="report-note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={4000}
            className="mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
          />
        </label>
        <button
          type="button"
          data-testid="export-report"
          onClick={handleExport}
          disabled={exporting || !selectedScenario}
          className="mt-3 rounded-lg bg-[#3159D9] px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {exporting ? "Exportando…" : "Exportar informe"}
        </button>
        {exportError && (
          <p role="alert" className="mt-2 text-sm text-[#B42318]">
            {exportError}
          </p>
        )}
      </section>

      {reportIds.length > 0 && (
        <section aria-label="Informes" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Informes</h2>
          <ul className="mt-2 space-y-2">
            {reportIds.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setSelectedReport(id)}
                  aria-pressed={selectedReport === id}
                  className={`tnum w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedReport === id ? "border-[#3159D9] bg-[#E8EFFF]" : "border-[#E5E9F2]"
                  }`}
                >
                  Abrir informe <code>{id.slice(0, 8)}…</code> (licitación {workspace.tender.external_id})
                </button>
              </li>
            ))}
          </ul>
          {reportQuery.isPending && selectedReport && <p className="mt-2 text-sm">Cargando informe…</p>}
          {reportQuery.isError && (
            <p role="alert" className="mt-2 text-sm text-[#B42318]">
              No se pudo cargar el informe.
            </p>
          )}
          {reportQuery.data && <ReportDetail report={reportQuery.data} />}
        </section>
      )}
    </div>
  );
}
