import { useRef, useTransition } from "react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getWorkspace } from "../../api/client";
import { DemoBadge } from "../../components/DemoBadge";
import { Skeleton } from "../../components/Skeleton";
import { Alert } from "../../components/ui";
import { formatEurosExact, formatEurosHeadline } from "../../lib/format";
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
  { id: "evidencia", label: "Citas" },
  { id: "informe", label: "Informe" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: string | null): TabId {
  return TABS.some((t) => t.id === raw) ? (raw as TabId) : "resumen";
}

/**
 * One-line budget for the header. Backend strings, display only: the net
 * figure is a headline, the gross figure is exact, and the tax is named
 * without a rate (the 7 % derivation lives in Detalles técnicos).
 */
function lineaPresupuesto(pblNet: string | null, pblGross: string | null, taxKind: string): string {
  const impuesto = taxKind === "IGIC" ? "IGIC" : taxKind === "VAT" ? "IVA" : "impuestos";
  const net = pblNet ? formatEurosHeadline(pblNet) : null;
  const gross = pblGross ? formatEurosExact(pblGross) : null;
  if (net && gross) return `Presupuesto de salida: ${net} sin ${impuesto} (${gross} con ${impuesto})`;
  if (net) return `Presupuesto de salida: ${net} sin ${impuesto}`;
  if (gross) return `Presupuesto de salida: ${gross} con ${impuesto}`;
  return "Presupuesto de salida: sin determinar";
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
        <p>Cargando tu licitación…</p>
        <Skeleton lines={6} className="mt-4" label="Cargando tu licitación…" />
      </main>
    );
  }

  if (workspaceQuery.isError) {
    const error = workspaceQuery.error;
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <p>
          <Link to="/" className="text-primary underline hover:text-primary-ink">
            ← Volver a mis licitaciones
          </Link>
        </p>
        <Alert className="mt-4" title={errorCode(error) ?? undefined}>
          {errorEs(error, "No pudimos cargar la licitación. Vuelve a intentarlo en unos segundos.")}
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
          ← Volver a mis licitaciones
        </Link>
      </p>
      <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 data-testid="tender-title" className="text-xl font-bold sm:text-2xl">
            {tender.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Expediente {tender.external_id} · {tender.contracting_body}
            {scope ? ` · ${scope.label}` : ""}
          </p>
          <p className="tnum mt-1 text-sm">
            {lineaPresupuesto(tender.pbl_net, tender.pbl_gross, scope?.basis.tax_kind ?? "unknown")}
          </p>
        </div>
        <DemoBadge mode={mode} />
      </header>

      {mode === "demo" && (
        <p data-testid="demo-banner" className="mt-3 rounded-lg border border-alert bg-warn-bg p-3 text-sm">
          Datos de ejemplo. Los precios de los rivales y tu coste son inventados para que puedas probar.
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
        {tab === "resumen" && <SummaryTab workspace={workspace} />}
        {tab === "requisitos" && <RequirementsTab workspace={workspace} />}
        {tab === "pricing" && <PricingLab workspace={workspace} />}
        {tab === "evidencia" && <EvidenceTab workspace={workspace} />}
        {tab === "informe" && <ReportTab workspace={workspace} />}
      </div>
    </main>
  );
}
