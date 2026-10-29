import { useEffect, useRef, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { getWorkspace, listTenderReports, listTenderScenarios } from "../../api/client";
import { DemoBadge } from "../../components/DemoBadge";
import { Skeleton } from "../../components/Skeleton";
import { Alert } from "../../components/ui";
import { formatEurosExact, formatEurosHeadline } from "../../lib/format";
import { errorCode, errorEs } from "../../lib/errors";
import { loadSession } from "../../lib/session";
import { SummaryTab } from "./SummaryTab";
import { DraftDurableBanner, WorkspaceDraftsProvider } from "./WorkspaceDrafts";
import { RequirementsTab } from "../requirements/RequirementsTab";
import { PricingLab } from "../pricing/PricingLab";
import { EvidenceTab } from "../evidence/EvidenceTab";
import { ReportTab } from "../report/ReportTab";
import { ReviewTab } from "../review/ReviewTab";
import { isOwnTender } from "../review/ownTender";

const BASE_TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "requisitos", label: "Requisitos" },
  { id: "precio", label: "Precio" },
  { id: "evidencia", label: "Citas" },
  { id: "informe", label: "Informe" },
] as const;

const OWN_TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "requisitos", label: "Requisitos" },
  { id: "revisar", label: "Revisar" },
  { id: "precio", label: "Precio" },
  { id: "evidencia", label: "Citas" },
  { id: "informe", label: "Informe" },
] as const;

export type TabId = (typeof OWN_TABS)[number]["id"];

function parseTab(raw: string | null): TabId {
  return OWN_TABS.some((t) => t.id === raw) ? (raw as TabId) : "resumen";
}

/** Workhead eyebrow mode, same vocabulary as DemoBadge. */
function modeLabel(mode: string | null | undefined): string | null {
  if (mode === "demo") return "Datos de ejemplo";
  if (mode === "live") return "Análisis en vivo";
  if (mode === "manual") return "Tus datos";
  return null;
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
  const location = useLocation();
  const rawTab = parseTab(params.get("tab"));
  const [, startTransition] = useTransition();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prevTabRef = useRef(rawTab);
  const skipPanelFocusRef = useRef(false);
  const firstTenderRef = useRef(tenderId);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", tenderId],
    queryFn: ({ signal }) => getWorkspace(tenderId, signal),
  });
  const queryClient = useQueryClient();

  // Zeigarnik/H1: real progress on the steps that accumulate work (saved
  // pruebas, created informes). Totals only (pageSize 1); hidden at zero.
  const badgeSession = loadSession();
  const badgeScope = badgeSession?.tender_id === tenderId ? badgeSession.scope_id : undefined;
  const scenarioCountQuery = useQuery({
    queryKey: ["stepCounts", tenderId, badgeScope ?? "none", "scenarios"],
    queryFn: ({ signal }) =>
      listTenderScenarios(tenderId, { scopeId: badgeScope, pageSize: 1, signal }),
    enabled: tenderId !== "" && badgeScope !== undefined,
  });
  const reportCountQuery = useQuery({
    queryKey: ["stepCounts", tenderId, badgeScope ?? "none", "reports"],
    queryFn: ({ signal }) =>
      listTenderReports(tenderId, { scopeId: badgeScope, pageSize: 1, signal }),
    enabled: tenderId !== "" && badgeScope !== undefined,
  });
  const scenarioTotal = scenarioCountQuery.data?.total ?? 0;
  const reportTotal = reportCountQuery.data?.total ?? 0;

  // Own tenders gain the Revisar step between Requisitos and Precio.
  const own = workspaceQuery.data ? isOwnTender(workspaceQuery.data.tender) : false;
  const tabs = own ? OWN_TABS : BASE_TABS;
  const tab: TabId = tabs.some((t) => t.id === rawTab) ? rawTab : "resumen";

  function selectTab(id: TabId) {
    // Focus stays on the tab itself (APG roving); the panel effect below skips.
    skipPanelFocusRef.current = true;
    void queryClient.invalidateQueries({ queryKey: ["stepCounts", tenderId] });
    startTransition(() => {
      const next = new URLSearchParams(params);
      next.set("tab", id);
      setParams(next, { replace: false });
    });
  }

  // Programmatic navigation (deep links, "Duplicar esta prueba", "Ir a Precio")
  // unmounts the focused control: land on the panel instead of <body> (J3 P1-1).
  // A hash target (e.g. #tu-coste) owns the focus instead: this parent effect
  // runs after the child's and must not steal it back.
  useEffect(() => {
    if (prevTabRef.current !== tab) {
      prevTabRef.current = tab;
      const hashTarget = location.hash
        ? document.getElementById(location.hash.slice(1))
        : null;
      if (!skipPanelFocusRef.current && !hashTarget) {
        document.getElementById("contenido")?.focus({ preventScroll: true });
      }
    }
    skipPanelFocusRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- location.hash is read at effect time.
  }, [tab]);

  // Arriving from intake ("Abrir tu licitación") lands on the title.
  useEffect(() => {
    if (firstTenderRef.current !== tenderId) {
      firstTenderRef.current = tenderId;
      document.getElementById("tender-title")?.focus({ preventScroll: true });
    }
  }, [tenderId]);

  /** APG roving tabindex: arrows move and select, Home/End jump. */
  function onTabKey(event: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    const target = tabs[next];
    if (!target) return;
    event.preventDefault();
    selectTab(target.id);
    tabRefs.current[next]?.focus();
  }

  if (workspaceQuery.isPending) {
    return (
      <main id="main" className="wrap" aria-busy="true">
        <p>Cargando tu licitación…</p>
        <Skeleton lines={6} className="mt-4" label="Cargando tu licitación…" />
      </main>
    );
  }

  if (workspaceQuery.isError) {
    const error = workspaceQuery.error;
    return (
      <main id="main" className="wrap">
        <p className="backrow">
          <Link to="/">← Volver a mis licitaciones</Link>
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

  const eyebrowMode = modeLabel(mode);
  return (
    <main id="main" className="wrap" tabIndex={-1}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2">
        Saltar al contenido
      </a>
      <div className="workhead">
        <p className="backrow">
          <Link to="/">← Volver a mis licitaciones</Link>
        </p>
        <p className="eyebrow">
          {tender.contracting_body}
          {eyebrowMode ? ` · ${eyebrowMode}` : ""}
        </p>
        <h1 id="tender-title" data-testid="tender-title" tabIndex={-1}>
          {tender.title}
        </h1>
        <p className="muted small">
          Expediente {tender.external_id} · {tender.contracting_body}
          {scope ? ` · ${scope.label}` : ""}
        </p>
        <p className="muted small">
          {lineaPresupuesto(tender.pbl_net, tender.pbl_gross, scope?.basis.tax_kind ?? "unknown")}
        </p>
      </div>

      {mode === "demo" && (
        <p data-testid="demo-banner" className="mb-2 rounded-lg border border-alert bg-warn-bg p-2 text-sm">
          Datos de ejemplo. Los precios de los rivales y tu coste son inventados para que puedas probar.
        </p>
      )}

      <div className="workgrid">
        <nav aria-label="Pasos del expediente" className="steps">
          <ul role="tablist" aria-label="Secciones de la licitación">
            {tabs.map((t, i) => (
              <li key={t.id} role="presentation">
                <button
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-current={tab === t.id ? "step" : undefined}
                  aria-controls="contenido"
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => selectTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className="pressable"
                >
                  <span className="stepnum" aria-hidden="true">
                    {i + 1}
                  </span>{" "}
                  {t.label}
                  {t.id === "precio" && scenarioTotal > 0 && (
                    <span className="stepcount" aria-hidden="true">
                      ({scenarioTotal})
                    </span>
                  )}
                  {t.id === "informe" && reportTotal > 0 && (
                    <span className="stepcount" aria-hidden="true">
                      ({reportTotal})
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="base">
            <strong>Base del análisis</strong>
            {mode ? (
              <p>
                <DemoBadge mode={mode} />
              </p>
            ) : null}
            {scope ? <p className="muted">Ámbito: {scope.label}</p> : null}
          </div>
        </nav>

        <div
          id="contenido"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          tabIndex={-1}
        >
        <WorkspaceDraftsProvider>
          <div className="mb-4 [&:empty]:hidden">
            <DraftDurableBanner />
          </div>
          {tab === "resumen" && <SummaryTab workspace={workspace} />}
          {tab === "requisitos" && <RequirementsTab workspace={workspace} />}
          {tab === "revisar" && <ReviewTab workspace={workspace} />}
          {tab === "precio" && <PricingLab workspace={workspace} />}
          {tab === "evidencia" && <EvidenceTab workspace={workspace} />}
          {tab === "informe" && <ReportTab workspace={workspace} />}
        </WorkspaceDraftsProvider>
        </div>
      </div>
    </main>
  );
}
