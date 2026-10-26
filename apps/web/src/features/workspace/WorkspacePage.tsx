import { useRef, useTransition } from "react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getCapabilities, getWorkspace } from "../../api/client";
import { DemoBadge } from "../../components/DemoBadge";
import { Skeleton } from "../../components/Skeleton";
import { Alert } from "../../components/ui";
import { formatEUR } from "../../lib/format";
import { errorCode, errorEs } from "../../lib/errors";
import { loadSession } from "../../lib/session";
import { SummaryTab } from "./SummaryTab";
import { RequirementsTab } from "../requirements/RequirementsTab";
import { PricingLab } from "../pricing/PricingLab";
import { EvidenceTab } from "../evidence/EvidenceTab";
import { ReportTab } from "../report/ReportTab";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "requisitos", label: "Requisitos" },
  { id: "pricing", label: "Precio" },
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
  const [, startTransition] = useTransition();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", tenderId],
    queryFn: ({ signal }) => getWorkspace(tenderId, signal),
  });
  const capabilitiesQuery = useQuery({
    queryKey: ["capabilities"],
    queryFn: ({ signal }) => getCapabilities(signal),
  });

  function selectTab(id: TabId) {
    startTransition(() => {
      const next = new URLSearchParams(params);
      next.set("tab", id);
      setParams(next, { replace: false });
    });
  }

  /** APG roving tabindex: arrows move and select, Home/End jump. */
  function onTabKey(event: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    const target = TABS[next];
    if (!target) return;
    event.preventDefault();
    selectTab(target.id);
    tabRefs.current[next]?.focus();
  }

  if (workspaceQuery.isPending) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-8" aria-busy="true">
        <p>Cargando la licitación…</p>
        <Skeleton lines={6} className="mt-4" label="Cargando la licitación…" />
      </main>
    );
  }

  if (workspaceQuery.isError) {
    const error = workspaceQuery.error;
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <p>
          <Link to="/" className="text-primary underline hover:text-primary-ink">
            ← Biblioteca
          </Link>
        </p>
        <Alert className="mt-4" title={errorCode(error) ?? undefined}>
          {errorEs(error, "No se pudo cargar la licitación. Reintenta cuando la API local responda.")}
        </Alert>
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
        <Link to="/" className="text-primary underline hover:text-primary-ink">
          ← Biblioteca
        </Link>
      </p>
      <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 data-testid="tender-title" className="text-xl font-bold sm:text-2xl">
            {tender.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Exp. {tender.external_id} · {tender.contracting_body}
            {scope ? ` · ${scope.label}` : ""}
          </p>
          <p className="tnum mt-1 text-sm">
            PBL neto {tender.pbl_net ? formatEUR(tender.pbl_net) : "No localizado"}
            {tender.pbl_gross ? ` · bruto ${formatEUR(tender.pbl_gross)}` : ""}
          </p>
        </div>
        <DemoBadge mode={mode} />
      </header>

      {mode === "demo" && (
        <p className="mt-3 rounded-lg border border-alert bg-warn-bg p-3 text-sm">
          Demo curada: cifras de semilla revisada del 25/10/2026, no extracción en vivo. Las hipótesis de
          rivales y el coste de empresa son sintéticos.
        </p>
      )}

      <div className="mt-4">
        <ul role="tablist" aria-label="Secciones de la licitación" className="flex flex-wrap gap-2">
          {TABS.map((t, i) => (
            <li key={t.id} role="presentation">
              <button
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="contenido"
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => selectTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={clsx(
                  "pressable min-h-[44px] rounded-lg px-4 py-2 font-semibold",
                  tab === t.id
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "bg-white text-primary shadow-sm hover:bg-primary-soft"
                )}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div
        id="contenido"
        className="mt-4"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
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
