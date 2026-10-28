import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createDemoSession, listTenders, type Tender } from "../../api/client";
import { formatEurosHeadline } from "../../lib/format";
import { errorCode, errorEs } from "../../lib/errors";
import { ownCompanyFor, storeSession } from "../../lib/session";
import { isOwnTender } from "../review/ownTender";
import { DemoBadge } from "../../components/DemoBadge";
import { Skeleton } from "../../components/Skeleton";
import { Alert, Button, Badge } from "../../components/ui";
import { useQuery } from "@tanstack/react-query";

/** Published status: PUB means the tender is published. Unknown codes pass through. */
function estadoPublicacion(statusRaw: string): string {
  if (statusRaw === "") return "Sin determinar";
  if (statusRaw === "PUB") return "Publicada";
  return statusRaw;
}

function nombreImpuesto(taxKind: string): string {
  if (taxKind === "IGIC") return "IGIC";
  if (taxKind === "VAT") return "IVA";
  return "impuestos";
}

const PAGE_SIZE_DEFAULT = 20;
const SEARCH_DEBOUNCE_MS = 300;

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function parsePageSize(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : PAGE_SIZE_DEFAULT;
}

export function LibraryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // The query and page live in the URL: going back from a detail keeps them.
  const q = params.get("q") ?? "";
  const page = parsePage(params.get("page"));
  const pageSize = parsePageSize(params.get("page_size"));
  const [draft, setDraft] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoRawError, setDemoRawError] = useState<string | null>(null);

  // Back/forward navigation rewrites the URL: follow it in the input.
  // Render-phase adjustment (no effect): q only changes from navigation
  // or our own debounced commit, which already matches the draft.
  if (lastQ !== q) {
    setLastQ(q);
    setDraft(q);
  }

  // Debounce typing into the URL; a new query restarts at page 1.
  useEffect(() => {
    if (draft === q) return;
    const timer = window.setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (draft.trim()) next.set("q", draft.trim());
        else next.delete("q");
        next.set("page", "1");
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, q, setParams]);

  // Server-side search over the complete set (title, file number, CPV).
  const tendersQuery = useQuery({
    queryKey: ["tenders", q, page, pageSize],
    queryFn: ({ signal }) =>
      listTenders({ q: q === "" ? undefined : q, page, page_size: pageSize }, signal),
  });

  async function handleDemoLoad() {
    setLoadingDemo(true);
    setDemoError(null);
    setDemoRawError(null);
    try {
      const session = await createDemoSession();
      storeSession(session);
      await navigate(`/tenders/${session.tender_id}?tab=resumen`);
    } catch (error) {
      setDemoError(errorEs(error, "No pudimos crear la sesión demo. Vuelve a intentarlo."));
      setDemoRawError(errorCode(error));
    } finally {
      setLoadingDemo(false);
    }
  }

  const items: Tender[] = tendersQuery.data?.items ?? [];
  const total = tendersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goPage(next: number) {
    setParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      nextParams.set("page", String(Math.min(Math.max(1, next), totalPages)));
      return nextParams;
    });
  }

  // Own tenders restore their manual session (no example asked). When the
  // company pointer is gone, the workspace checklist asks for it instead.
  function openTender(tender: Tender) {
    if (isOwnTender(tender)) {
      const known = ownCompanyFor(tender.id);
      if (known) {
        storeSession({
          tender_id: tender.id,
          scope_id: known.scope_id,
          company_id: known.company_id,
          mode: "manual",
        });
      }
    }
    void navigate(`/tenders/${tender.id}?tab=resumen`);
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2">
        Saltar al contenido
      </a>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">BidLab</h1>
          <p className="mt-1 text-muted">De un pliego a una decisión de oferta</p>
        </div>
        <DemoBadge mode={null} />
      </header>

      <div id="contenido" className="mt-6 flex flex-wrap gap-3">
        <Button data-testid="demo-load" onClick={handleDemoLoad} disabled={loadingDemo}>
          {loadingDemo ? "Cargando ejemplo…" : "Cargar ejemplo"}
        </Button>
        <Button
          data-testid="nueva-licitacion"
          variant="subtle"
          onClick={() => navigate("/nueva-licitacion")}
        >
          Nueva licitación
        </Button>
      </div>
      {demoError && (
        <Alert className="mt-3" title={demoRawError ?? undefined}>
          {demoError}
        </Alert>
      )}

      <section aria-label="Biblioteca local" className="mt-8 rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Biblioteca local</h2>
        <label className="mt-3 block">
          <span className="text-sm font-medium">Buscar por título, expediente o código de actividad (CPV)</span>
          <input
            type="search"
            data-testid="library-search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tías, 79411000…"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base"
          />
        </label>

        {tendersQuery.isPending && (
          <Skeleton lines={4} className="mt-4" label="Cargando licitaciones…" />
        )}
        {tendersQuery.isError && (
          <div className="mt-4">
            <p role="alert" className="text-error" title={errorCode(tendersQuery.error) ?? undefined}>
              No pudimos cargar la biblioteca. Comprueba que el programa está en marcha y pulsa Reintentar.
            </p>
            <Button variant="secondary" onClick={() => void tendersQuery.refetch()} className="mt-2">
              Reintentar
            </Button>
          </div>
        )}
        {tendersQuery.isSuccess && total === 0 && q !== "" && (
          <p className="mt-4">Sin resultados para «{q}».</p>
        )}
        {tendersQuery.isSuccess && total === 0 && q === "" && (
          <p className="mt-4">Sin resultados. Carga el ejemplo para empezar.</p>
        )}
        {tendersQuery.isSuccess && total > 0 && (
          <p data-testid="library-count" className="mt-4 text-sm text-muted">
            {total === 1 ? "1 resultado" : `${total} resultados`}
          </p>
        )}
        {tendersQuery.isSuccess && total > 0 && items.length === 0 && (
          <p className="mt-2">Esta página está vacía.</p>
        )}
        {items.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {items.map((t) => (
              <li key={t.id} className="py-3">
                <button
                  type="button"
                  onClick={() => openTender(t)}
                  className="w-full rounded-lg p-1 text-left hover:bg-surface"
                >
                  <span className="font-semibold text-primary underline hover:text-primary-ink">{t.title}</span>{" "}
                  {isOwnTender(t) && <Badge data-testid="own-badge">Tuya</Badge>}
                  <span className="mt-1 block text-sm text-muted">
                    {t.contracting_body} · Expediente {t.external_id} · Actividad{" "}
                    {t.cpv_codes.join(", ") || "sin determinar"}
                  </span>
                  <span className="tnum mt-1 block text-sm">
                    Presupuesto de salida:{" "}
                    {t.pbl_net
                      ? `${formatEurosHeadline(t.pbl_net)} sin ${nombreImpuesto(t.scopes[0]?.basis.tax_kind ?? "unknown")}`
                      : "sin determinar"}{" "}
                    · Estado: {estadoPublicacion(t.status_raw)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {tendersQuery.isSuccess && totalPages > 1 && (
          <nav aria-label="Páginas de la biblioteca" className="mt-4 flex items-center gap-3 text-sm">
            <Button
              variant="secondary"
              data-testid="library-prev"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
            >
              Anterior
            </Button>
            <span data-testid="library-page" role="status">
              Página {Math.min(page, totalPages)} de {totalPages}
            </span>
            <Button
              variant="secondary"
              data-testid="library-next"
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
            >
              Siguiente
            </Button>
          </nav>
        )}
      </section>
    </main>
  );
}
