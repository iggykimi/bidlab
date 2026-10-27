import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDemoSession, listTenders, type Tender } from "../../api/client";
import { formatEurosHeadline } from "../../lib/format";
import { errorCode, errorEs } from "../../lib/errors";
import { storeSession } from "../../lib/session";
import { DemoBadge } from "../../components/DemoBadge";
import { Skeleton } from "../../components/Skeleton";
import { Alert, Button } from "../../components/ui";
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

export function LibraryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoRawError, setDemoRawError] = useState<string | null>(null);

  const tendersQuery = useQuery({
    queryKey: ["tenders"],
    queryFn: ({ signal }) => listTenders(signal),
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
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? items.filter((t) => `${t.title} ${t.external_id} ${t.cpv_codes.join(" ")}`.toLowerCase().includes(needle))
    : items;

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
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
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
        {tendersQuery.isSuccess && visible.length === 0 && (
          <p className="mt-4">Sin resultados. Carga el ejemplo para empezar.</p>
        )}
        {visible.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {visible.map((t) => (
              <li key={t.id} className="py-3">
                <button
                  type="button"
                  onClick={() => navigate(`/tenders/${t.id}?tab=resumen`)}
                  className="w-full rounded-lg p-1 text-left hover:bg-surface"
                >
                  <span className="font-semibold text-primary underline hover:text-primary-ink">{t.title}</span>
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
      </section>
    </main>
  );
}
