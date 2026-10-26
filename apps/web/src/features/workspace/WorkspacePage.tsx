import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, getCapabilities, getWorkspace } from "../../api/client";
import { DemoBadge } from "../../components/DemoBadge";
import { formatEUR } from "../../lib/format";
import { loadSession } from "../../lib/session";
import { SummaryTab } from "./SummaryTab";
import { RequirementsTab } from "../requirements/RequirementsTab";
import { PricingLab } from "../pricing/PricingLab";
import { EvidenceTab } from "../evidence/EvidenceTab";
import { ReportTab } from "../report/ReportTab";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "requisitos", label: "Requisitos" },
  { id: "pricing", label: "Pricing Lab" },
  { id: "evidencia", label: "Evidencia" },
  { id: "informe", label: "Informe" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: string | null): TabId {
  return TABS.some((t) => t.id === raw) ? (raw as TabId) : "resumen";
}

export function WorkspacePage() {
  const { tenderId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("tab"));

  const workspaceQuery = useQuery({
    queryKey: ["workspace", tenderId],
    queryFn: ({ signal }) => getWorkspace(tenderId, signal),
  });
  const capabilitiesQuery = useQuery({
    queryKey: ["capabilities"],
    queryFn: ({ signal }) => getCapabilities(signal),
  });

  function selectTab(id: TabId) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: false });
  }

  if (workspaceQuery.isPending) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <p>Cargando espacio de trabajo…</p>
      </main>
    );
  }

  if (workspaceQuery.isError) {
    const error = workspaceQuery.error;
    const message =
      error instanceof ApiError ? `${error.code}: ${error.message}` : "No se pudo cargar la licitación";
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <p>
          <Link to="/" className="text-[#3159D9] underline">
            ← Volver a la biblioteca
          </Link>
        </p>
        <p role="alert" className="mt-4 rounded-lg border border-[#B42318] bg-white p-4 text-[#B42318]">
          {message}
        </p>
      </main>
    );
  }

  const workspace = workspaceQuery.data;
  const tender = workspace.tender;
  const session = loadSession();
  const mode = session?.tender_id === tender.id ? session.mode : workspace.mode;
  const scope = tender.scopes[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2">
        Saltar al contenido
      </a>
      <p>
        <Link to="/" className="text-[#3159D9] underline">
          ← Biblioteca
        </Link>
      </p>
      <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 data-testid="tender-title" className="text-xl font-bold sm:text-2xl">
            {tender.title}
          </h1>
          <p className="mt-1 text-sm text-[#3A4560]">
            Exp. {tender.external_id} · {tender.contracting_body}
            {scope ? ` · ${scope.label}` : ""}
          </p>
          <p className="tnum mt-1 text-sm">
            PBL neto {tender.pbl_net ? formatEUR(tender.pbl_net) : "no localizado"}
            {tender.pbl_gross ? ` · Bruto ${formatEUR(tender.pbl_gross)}` : ""}
          </p>
        </div>
        <DemoBadge mode={mode} />
      </header>

      {mode === "demo" && (
        <p className="mt-3 rounded-lg border border-[#9A5B00] bg-[#FFF4D6] p-3 text-sm">
          Demo curada: cifras de semilla revisada del 25/10/2026, no extracción en vivo. Las hipótesis de
          rivales y el coste de empresa son sintéticos.
        </p>
      )}

      <nav aria-label="Secciones de la licitación" className="mt-4">
        <ul className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones">
          {TABS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => selectTab(t.id)}
                className={`rounded-lg px-4 py-2 font-semibold ${
                  tab === t.id ? "bg-[#3159D9] text-white" : "bg-white text-[#3159D9] shadow-sm"
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div id="contenido" className="mt-4" role="tabpanel">
        {tab === "resumen" && (
          <SummaryTab workspace={workspace} capabilities={capabilitiesQuery.data ?? null} />
        )}
        {tab === "requisitos" && <RequirementsTab workspace={workspace} />}
        {tab === "pricing" && <PricingLab workspace={workspace} />}
        {tab === "evidencia" && <EvidenceTab workspace={workspace} />}
        {tab === "informe" && <ReportTab workspace={workspace} />}
      </div>
    </main>
  );
}
