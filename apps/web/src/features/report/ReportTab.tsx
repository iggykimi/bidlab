import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  createReport,
  fetchReportHtml,
  getReport,
  getScenario,
  listTenderReports,
  listTenderScenarios,
  type Citation,
  type Decision,
  type Report,
  type Scenario,
  type Workspace,
} from "../../api/client";
import { Button } from "../../components/ui";
import {
  formatEurosExact,
  formatFechaNormal,
  formatMaxPoints,
  formatPoints,
} from "../../lib/format";
import { errorCode, errorEs } from "../../lib/errors";
import { loadSession } from "../../lib/session";
import { approvedPricingRule, isOwnTender } from "../review/ownTender";
import { useWorkspaceDrafts } from "../workspace/WorkspaceDrafts";
import { CompareSection } from "./CompareSection";
import { reportNoteSchema } from "../../lib/validation";
import { scenarioToDraft } from "./openAsCopy";
import { anomalyEs, reasonEs } from "../pricing/sources";
import { assumptionEs } from "../../lib/assumptions";
import "./print.css";

interface Props {
  workspace: Workspace;
}

const DECISIONS: { value: Decision; label: string }[] = [
  { value: "study", label: "Seguir estudiándola" },
  { value: "prepare", label: "Preparar oferta" },
  { value: "discard", label: "Descartarla" },
];

export function decisionEs(decision: Decision): string {
  return DECISIONS.find((d) => d.value === decision)?.label ?? decision;
}

/** Pending-item codes -> plain fragments (uxgaps C12, exact strings). */
const PENDIENTE_ES: Record<string, string> = {
  incomplete_rival_set: "faltan ofertas rivales para calcularlos",
  group_membership_unconfirmed: "sin confirmar si hay empresas del mismo grupo",
};

const CODE_LIST = /^[A-Za-z0-9_]+(,[A-Za-z0-9_]+)*$/;

/**
 * Replaces parenthesised backend codes with plain Spanish; unknown codes are
 * dropped and non-code parentheses (labels, figures) stay untouched.
 */
export function pendienteEs(text: string): string {
  const headed = text
    .replace(
      /^Puntuación no soportada: plantilla fuera del rango autorizado$/,
      "Fórmula no soportada: tu fórmula queda fuera del rango autorizado"
    )
    .replace(/^Puntuación\b/, "Puntos")
    .replace(/^Anormalidad\b/, "Oferta sospechosa")
    .replace(
      /^Posible anormalidad: preparar justificación de costes$/,
      "Tu oferta parece sospechosa: prepara la justificación de tus costes"
    )
    .replace(/^Pendiente de revisión manual: /, "Te falta revisar a mano: ")
    .replace(
      "Coste de empresa sintética: sustituir por el coste real",
      "Coste inventado: sustitúyelo por tu coste real"
    )
    .replace(
      "Conjunto rival incompleto: hipótesis parcial",
      "Conjunto rival incompleto: supuesto parcial"
    )
    .replace(
      /^PDF original no redistribuido: verificado solo por extractos$/,
      "No puedes descargar el PDF original: solo verás las citas."
    )
    .replace(/verificado solo por extractos$/, "verificado solo por citas")
    .replace(/: no usar para decidir$/, ": no decidas con este dato")
    .replace(/: conjunto insuficiente$/, ": tu conjunto es insuficiente");
  return headed
    .replace(/ ?\(([^()]*)\)/g, (match, inner) => {
      const raw = String(inner).trim();
      if (!CODE_LIST.test(raw)) return match;
      const mapped: string[] = [];
      for (const code of raw.split(",")) {
        const known = PENDIENTE_ES[code];
        if (known !== undefined) mapped.push(known);
        else if (reasonEs(code) !== code) mapped.push(reasonEs(code));
      }
      if (mapped.length === 0) return "";
      return ` (${mapped.join("; ")})`;
    })
    .replace(/ \(\)/g, "")
    .replace(/ {2,}/g, " ");
}

/** Local YYYY-MM-DD stamp for the downloaded filename (not a displayed figure). */
function fechaLocal(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Page -> citation count, ascending. Repeated pages collapse (UX-14). */
function pagesOf(citations: Citation[]): [number, number][] {
  const counts = new Map<number, number>();
  for (const c of citations) counts.set(c.page_number, (counts.get(c.page_number) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]);
}

function ScenarioDetail({
  scenario,
  onOpenAsCopy,
}: {
  scenario: Scenario;
  onOpenAsCopy: (scenario: Scenario) => void;
}) {
  const r = scenario.result;
  return (
    <div className="mt-2 grid gap-2 text-sm" data-testid="scenario-detail">
      <p>
        <strong>{scenario.name}</strong> · guardado {formatFechaNormal(scenario.created_at)}
      </p>
      <div>
        <Button variant="secondary" data-testid="open-as-copy" onClick={() => onOpenAsCopy(scenario)}>
          Duplicar esta prueba en Precio
        </Button>
      </div>
      <dl className="grid gap-1">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Precio neto</dt>
          <dd className="tnum font-semibold">{formatEurosExact(r.price_net)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Beneficio</dt>
          <dd className="tnum font-semibold">{r.profit_net ? formatEurosExact(r.profit_net) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Puntos</dt>
          <dd className="tnum font-semibold">
            {r.score.status === "defined" && r.score.value !== null
              ? formatPoints(r.score.value, r.score.max_points)
              : "Sin determinar"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Oferta sospechosa</dt>
          <dd className="font-semibold">{anomalyEs(r.anomaly.status)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-muted">
        La ley la llama presunción de anormalidad (art. 149 LCSP).
      </p>
      {/*
       * Native disclosure (not the TechnicalDetails component): uxgaps C11
       * requires data-testid="scenario-hash" inside, which the shared
       * component cannot attach. E07 asserts that testid.
       */}
      <details className="rounded-lg border border-border bg-surface">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          Detalles técnicos
        </summary>
        <div className="border-t border-border px-3 py-2">
          <p className="tnum text-xs text-muted">
            Regla {r.pricing_rule_id} rev. {r.pricing_rule_revision} · empresa rev.{" "}
            {r.company_revision} · motor {r.engine_version}
          </p>
          <p className="tnum mt-1 break-all text-xs">
            Copia (SHA-256) <code data-testid="scenario-hash">{scenario.snapshot_sha256}</code>
          </p>
        </div>
      </details>
      <div>
        <h4 className="font-semibold">Supuestos</h4>
        <ul className="list-disc pl-5">
          {r.assumptions.map((a) => (
            <li key={a}>
              {assumptionEs(a, r.cost_net, (scenario.input?.rivals?.offers.length ?? 1) === 0)}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold">
          Lo que te falta por comprobar ({scenario.context.pending_items.length})
        </h4>
        <ul className="list-disc pl-5">
          {scenario.context.pending_items.map((p) => (
            <li key={p}>{pendienteEs(p)}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold">Fuentes ({scenario.context.citations.length})</h4>
        <ul className="list-disc pl-5">
          {pagesOf(scenario.context.citations).map(([page, count]) => (
            <li key={page}>
              Página {page} del pliego de condiciones (PCAP) ·{" "}
              {count === 1 ? "1 cita" : `${count} citas`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReportDetail({
  report,
  onOpenAsCopy,
}: {
  report: Report;
  onOpenAsCopy: (scenario: Scenario) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadRawError, setDownloadRawError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloadError(null);
    setDownloadRawError(null);
    try {
      const html = await fetchReportHtml(report.id);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bidlab-informe-${fechaLocal()}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setDownloadError(errorEs(err, "No pudimos descargar. Vuelve a intentarlo en unos segundos."));
      setDownloadRawError(errorCode(err));
    }
  }

  async function handlePreview() {
    setDownloadError(null);
    setDownloadRawError(null);
    try {
      setPreview(await fetchReportHtml(report.id));
    } catch (err) {
      setDownloadError(
        errorEs(err, "No pudimos mostrar la vista previa. Vuelve a intentarlo en unos segundos.")
      );
      setDownloadRawError(errorCode(err));
    }
  }

  return (
    <div className="mt-2 grid gap-2 text-sm" data-testid="report-detail">
      <p>
        Decisión: <strong data-testid="report-decision">{decisionEs(report.decision)}</strong> ·{" "}
        {formatFechaNormal(report.created_at)}
      </p>
      <p data-testid="report-archive" className="text-muted">
        Archivado el {formatFechaNormal(report.created_at)} · Fórmula{" "}
        {report.scenario.input.pricing_rule_id} rev. {report.scenario.input.pricing_rule_revision} ·{" "}
        Empresa rev. {report.scenario.input.company_revision} · Copia{" "}
        {report.scenario.snapshot_sha256.slice(0, 12)}…
      </p>
      <div>
        <h4 className="font-semibold">Tus notas</h4>
        <p className="whitespace-pre-wrap rounded-lg bg-surface p-3" data-testid="report-note">
          {report.note || "—"}
        </p>
      </div>
      <div>
        <h4 className="font-semibold">
          Lo que te falta por comprobar ({report.pending_items.length})
        </h4>
        <ul className="list-disc pl-5">
          {report.pending_items.map((p) => (
            <li key={p}>{pendienteEs(p)}</li>
          ))}
        </ul>
      </div>
      <ScenarioDetail scenario={report.scenario} onOpenAsCopy={onOpenAsCopy} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button data-testid="download-report" onClick={handleDownload}>
          Descargar HTML
        </Button>
        <Button variant="secondary" onClick={handlePreview}>
          {preview ? "Ocultar vista previa" : "Vista previa del informe"}
        </Button>
      </div>
      {downloadError && (
        <p role="alert" title={downloadRawError ?? undefined} className="text-error">
          {downloadError}
        </p>
      )}
      {preview !== null && (
        <iframe
          title="Vista previa del informe"
          srcDoc={preview}
          sandbox=""
          className="h-96 w-full rounded-lg border border-border bg-white"
        />
      )}
    </div>
  );
}

export function ReportTab({ workspace }: Props) {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  // Decision draft lives above the tabs: switching sections never loses
  // the note, the choice or the selected scenario (UX-02).
  const draftSession = loadSession();
  const { drafts, updatePricing, updateReport } = useWorkspaceDrafts({
    tenderId: workspace.tender.id,
    scopeId: draftSession?.scope_id ?? "none",
    companyId: draftSession?.company_id ?? "none",
  });
  const decision = drafts.report.decision as Decision | null;
  const note = drafts.report.note;
  const linkedScenario = params.get("prueba");
  // R01: ?prueba= is a one-shot deep link. It selects initially (only when
  // the draft differs), then leaves the URL so later clicks own the
  // selection and the export follows them. The ref guard is load-bearing:
  // without it, the store write + re-navigation re-trigger the effect
  // faster than the router can commit, a self-sustaining loop (observed).
  const consumedLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (linkedScenario === null || consumedLinkRef.current === linkedScenario) return;
    consumedLinkRef.current = linkedScenario;
    if (drafts.report.selectedScenario !== linkedScenario) {
      updateReport({ selectedScenario: linkedScenario });
    }
    const next = new URLSearchParams(params);
    next.delete("prueba");
    setParams(next, { replace: true });
  }, [linkedScenario, params, setParams, updateReport, drafts.report.selectedScenario]);
  const selectedScenario = linkedScenario ?? drafts.report.selectedScenario;
  const setDecision = (value: Decision) => updateReport({ decision: value });
  const setNote = (value: string) => updateReport({ note: value });
  const setSelectedScenario = (value: string | null) => updateReport({ selectedScenario: value });
  // Server-backed collections (UX-10): the lists belong to this tender and
  // scope, not to a global browser index shared across tenders.
  const scopeFilter = draftSession?.scope_id ?? undefined;
  const scenariosQuery = useQuery({
    queryKey: ["tenderScenarios", workspace.tender.id, scopeFilter],
    queryFn: ({ signal }) =>
      listTenderScenarios(workspace.tender.id, { scopeId: scopeFilter, pageSize: 100, signal }),
    enabled: draftSession !== null,
  });
  const reportsQuery = useQuery({
    queryKey: ["tenderReports", workspace.tender.id, scopeFilter],
    queryFn: ({ signal }) =>
      listTenderReports(workspace.tender.id, { scopeId: scopeFilter, pageSize: 100, signal }),
    enabled: draftSession !== null,
  });
  const scenarioItems = [...(scenariosQuery.data?.items ?? [])].reverse();
  const reportItems = [...(reportsQuery.data?.items ?? [])].reverse();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportRawError, setExportRawError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Print support: expand every disclosure for the printed report, then
  // restore the previous open/closed state (print.css backs this up).
  useEffect(() => {
    const openAll = () => {
      document.querySelectorAll("details").forEach((d) => {
        d.dataset.wasOpen = d.open ? "1" : "";
        d.open = true;
      });
    };
    const restore = () => {
      document.querySelectorAll("details").forEach((d) => {
        if (d.dataset.wasOpen !== "1") d.open = false;
        delete d.dataset.wasOpen;
      });
    };
    window.addEventListener("beforeprint", openAll);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", openAll);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

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

  function goTab(tab: string) {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    setParams(next);
  }

  function goPricing() {
    goTab("precio");
  }

  function handleOpenAsCopy(scenario: Scenario) {
    const patch = scenarioToDraft(scenario, drafts.pricing.h);
    updatePricing({ h: patch.h, scenarioName: patch.scenarioName, savedCopy: null });
    goTab("precio");
  }

  // Own tenders without an approved formula cannot simulate, so there
  // is nothing to report yet: ask for the review first, plainly.
  const gated = isOwnTender(workspace.tender) && approvedPricingRule(workspace) === null;

  async function handleExport() {
    setExportError(null);
    setExportRawError(null);
    if (!selectedScenario) {
      setExportError("Selecciona una prueba guardada antes de crear el informe.");
      return;
    }
    if (decision === null) {
      setExportError("Elige qué has decidido antes de crear el informe.");
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
      await queryClient.invalidateQueries({ queryKey: ["tenderReports", workspace.tender.id] });
      setSelectedReport(created.id);
      toast.success("Informe creado. Puedes descargarlo o previsualizarlo.");
    } catch (err) {
      setExportError(errorEs(err, "No pudimos crear el informe. Vuelve a intentarlo en unos segundos."));
      setExportRawError(errorCode(err));
    } finally {
      setExporting(false);
    }
  }

  if (gated) {
    return (
      <section aria-label="Informe bloqueado" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">¿Por qué no ves el informe?</h2>
        <p className="mt-2 text-sm">
          Aún no apruebas la fórmula de puntos. Sin fórmula aprobada no hay pruebas que guardar.
        </p>
        <Button data-testid="report-go-review" onClick={() => goTab("revisar")} className="mt-3">
          Ir a Revisar
        </Button>
      </section>
    );
  }

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <section aria-label="Escenarios guardados" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Paso 1 · Abre una prueba guardada</h2>
        {scenariosQuery.isPending && (
          <p className="mt-2 text-sm" role="status">
            Cargando tus pruebas guardadas…
          </p>
        )}
        {scenariosQuery.isError && (
          <div className="mt-2">
            <p role="alert" className="text-sm text-error">
              No pudimos cargar tus pruebas guardadas.
            </p>
            <Button variant="secondary" className="mt-2" onClick={() => scenariosQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        )}
        {scenariosQuery.data && scenarioItems.length === 0 && (
          <div className="mt-2 text-sm">
            <p>
              Todavía no has guardado ninguna prueba. Una prueba es una rebaja con unos rivales
              concretos. Guárdala en Precio y aparecerá aquí.
            </p>
            <Button data-testid="go-pricing" onClick={goPricing} className="mt-3">
              Ir a Precio
            </Button>
          </div>
        )}
        {scenarioItems.length > 0 && (
          <ul className="mt-2 space-y-2">
            {scenarioItems.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setSelectedScenario(entry.id)}
                  aria-pressed={selectedScenario === entry.id}
                  className={clsx(
                    "tnum w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-surface",
                    selectedScenario === entry.id ? "border-primary bg-primary-soft" : "border-line"
                  )}
                >
                  Abrir prueba <strong>{entry.name || "sin nombre"}</strong>
                  <span className="block text-xs text-muted">
                    Guardado {formatFechaNormal(entry.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {scenarioQuery.isPending && selectedScenario && <p className="mt-2 text-sm">Cargando prueba…</p>}
        {scenarioQuery.isError && (
          <p role="alert" className="mt-2 text-sm text-error">
            No pudimos cargar la prueba. Vuelve a intentarlo en unos segundos.
          </p>
        )}
        {scenarioQuery.data && (
          <ScenarioDetail scenario={scenarioQuery.data} onOpenAsCopy={handleOpenAsCopy} />
        )}
      </section>

      <section aria-label="Nuevo informe" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Paso 2 · Decide y crea tu informe</h2>
        <p className="mt-1 text-sm text-muted" data-testid="report-draft-state">
          Borrador (sin archivar). Tú decides: elige una opción, escribe tu nota y crea el informe.
        </p>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">¿Qué has decidido?</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            {DECISIONS.map((d) => (
              <label key={d.value} className="flex min-h-[48px] items-center gap-2">
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
          <span className="font-medium">Tus notas (saldrán tal cual en el informe)</span>
          <textarea
            data-testid="report-note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={4000}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          />
        </label>
        <Button data-testid="export-report" onClick={handleExport} disabled={exporting} className="mt-3">
          {exporting ? "Creando…" : "Crear informe"}
        </Button>
        {!selectedScenario && (
          <p className="mt-2 text-sm">Primero abre una prueba guardada de la lista de arriba.</p>
        )}
        {exportError && (
          <p role="alert" title={exportRawError ?? undefined} className="mt-2 text-sm text-error">
            {exportError}
          </p>
        )}
        <div className="mt-3 border-t border-line pt-3">
          <h3 className="text-sm font-semibold">Paso 3 · Imprime o guarda en PDF</h3>
          <Button
            variant="secondary"
            data-testid="print-report"
            onClick={() => window.print()}
            disabled={!reportQuery.data}
            className="mt-2"
          >
            Imprimir / guardar en PDF
          </Button>
          {reportQuery.data && (
            <p className="mt-1 text-sm text-muted">
              Se abre el diálogo de impresión: elige «Guardar como PDF».
            </p>
          )}
          {!reportQuery.data && (
            <p className="mt-1 text-sm text-muted">
              {reportItems.length > 0
                ? "Abre un informe de la lista de abajo para imprimirlo o guardarlo en PDF."
                : "Crea tu informe para imprimirlo o guardarlo en PDF."}
            </p>
          )}
        </div>
      </section>

      {reportsQuery.isError && (
        <section aria-label="Informes archivados" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Informes archivados</h2>
          <p role="alert" className="mt-2 text-sm text-error">
            No pudimos cargar tus informes.
          </p>
          <Button variant="secondary" className="mt-2" onClick={() => reportsQuery.refetch()}>
            Reintentar
          </Button>
        </section>
      )}
      {reportItems.length > 0 && (
        <section aria-label="Informes archivados" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Informes archivados</h2>
          <ul className="mt-2 space-y-2">
            {reportItems.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setSelectedReport(entry.id)}
                  aria-pressed={selectedReport === entry.id}
                  className={clsx(
                    "tnum w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-surface",
                    selectedReport === entry.id ? "border-primary bg-primary-soft" : "border-line"
                  )}
                >
                  Abrir informe · <strong>{entry.scenario_name}</strong> · {decisionEs(entry.decision)}
                  <span className="block text-xs text-muted">
                    Creado {formatFechaNormal(entry.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {reportQuery.isPending && selectedReport && <p className="mt-2 text-sm">Cargando informe…</p>}
          {reportQuery.isError && (
            <p role="alert" className="mt-2 text-sm text-error">
              No pudimos cargar el informe. Vuelve a intentarlo en unos segundos.
            </p>
          )}
          {reportQuery.data && (
            <ReportDetail report={reportQuery.data} onOpenAsCopy={handleOpenAsCopy} />
          )}
        </section>
      )}

      <CompareSection
        summaries={scenarioItems}
        scoreMax={
          workspace.pricing_rules[0] ? formatMaxPoints(workspace.pricing_rules[0].max_points) : "—"
        }
      />
    </div>
  );
}
