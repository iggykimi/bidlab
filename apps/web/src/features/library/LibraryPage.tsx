import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createDemoSession, listTenders, type Tender } from "../../api/client";
import { formatEurosHeadline } from "../../lib/format";
import { errorCode, errorEs } from "../../lib/errors";
import { ownCompanyFor, storeSession } from "../../lib/session";
import { isOwnTender } from "../review/ownTender";
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

// Plate 01 (portfolio): hero + demo inset + library surface + honesty
// notice. Rows, toolbar, count and pagination follow the mock; controls
// stay honest (search only, no invented filters or sort).
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

  function clearSearch() {
    setDraft("");
    setParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      nextParams.delete("q");
      nextParams.set("page", "1");
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

  const countText =
    tendersQuery.isSuccess && total > 0
      ? total === 1
        ? "1 resultado"
        : `${total} resultados`
      : "";
  const rangeText =
    items.length === 0
      ? `0 de ${total}`
      : `${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)} de ${total}`;

  return (
    <main id="main" className="wrap" tabIndex={-1}>
      <div className="stack">
        <div>
          <p className="eyebrow">Cartera de trabajo</p>
          <h1>Tus licitaciones</h1>
          <p className="muted intro-width">
            Expedientes guardados en este equipo. Carga el ejemplo de Tías para practicar el
            recorrido completo.
          </p>
        </div>

        <section className="inset" aria-labelledby="demo-title">
          <div className="row between">
            <div>
              <h2 id="demo-title">Prueba el recorrido con Tías</h2>
              <p className="last">Regla revisada. Costes y rivales inventados para practicar.</p>
            </div>
            <div className="row">
              <Button data-testid="demo-load" onClick={handleDemoLoad} disabled={loadingDemo}>
                {loadingDemo ? "Cargando ejemplo…" : "Cargar ejemplo"}
              </Button>
              <Button
                data-testid="nueva-licitacion"
                variant="secondary"
                onClick={() => navigate("/nueva-licitacion")}
              >
                Nueva licitación
              </Button>
            </div>
          </div>
          {demoError && (
            <Alert className="mt-4" title={demoRawError ?? undefined}>
              {demoError}
            </Alert>
          )}
        </section>

        <section className="surface" aria-label="Biblioteca local">
          <h2 id="list-title">Explora tu biblioteca</h2>
          <div className="toolbar single">
            <label>
              Buscar licitación
              <input
                type="search"
                data-testid="library-search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Tías, 79411000…"
                autoComplete="off"
              />
            </label>
          </div>
          <div className="row between rule" style={{ marginTop: 24 }}>
            <p data-testid="library-count" role="status" className="last">
              {countText}
            </p>
          </div>

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
            <ul className="tenders">
              <li>
                <div>
                  <h3>No encontramos esa licitación.</h3>
                  <p>Conservamos tu búsqueda para que puedas corregirla.</p>
                  <Button variant="secondary" onClick={clearSearch}>
                    Limpiar búsqueda
                  </Button>
                </div>
              </li>
            </ul>
          )}
          {tendersQuery.isSuccess && total === 0 && q === "" && (
            <p className="mt-4">Sin resultados. Carga el ejemplo para empezar.</p>
          )}
          {tendersQuery.isSuccess && total > 0 && items.length === 0 && (
            <p className="mt-2">Esta página está vacía.</p>
          )}
          {items.length > 0 && (
            <ul className="tenders">
              {items.map((t) => (
                <li key={t.id}>
                  <div>
                    <h3>{t.title}</h3>
                    {isOwnTender(t) && <Badge data-testid="own-badge">Tuya</Badge>}{" "}
                    <small>
                      Expediente {t.external_id} · CPV {t.cpv_codes.join(", ") || "sin determinar"}
                    </small>
                    <br />
                    <span className="tag">{estadoPublicacion(t.status_raw)}</span>{" "}
                    <small>{t.contracting_body}</small>
                  </div>
                  <div className="amount">
                    {t.pbl_net ? formatEurosHeadline(t.pbl_net) : "sin determinar"}
                    <br />
                    <small>
                      Presupuesto neto
                      {t.pbl_net
                        ? ` sin ${nombreImpuesto(t.scopes[0]?.basis.tax_kind ?? "unknown")}`
                        : ""}
                    </small>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => openTender(t)}
                    aria-label={`Abrir ${t.title}`}
                  >
                    Abrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {tendersQuery.isSuccess && totalPages > 1 && (
            <nav aria-label="Páginas de la biblioteca" className="pagination">
              <span>{rangeText} · </span>
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

        <p className="notice">
          Los estados publicados son los guardados en este equipo. Comprueba el estado y la versión
          vigentes del expediente en su fuente oficial antes de preparar una oferta.
        </p>
      </div>
    </main>
  );
}
