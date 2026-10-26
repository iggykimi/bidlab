import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDemoSession, listTenders, type Tender } from "../../api/client";
import { formatEUR } from "../../lib/format";
import { errorCode, errorEs } from "../../lib/errors";
import { storeSession } from "../../lib/session";
import { DemoBadge } from "../../components/DemoBadge";
import { Skeleton } from "../../components/Skeleton";
import { Alert, Button } from "../../components/ui";
import { useQuery } from "@tanstack/react-query";

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
      setDemoError(errorEs(error, "No se pudo crear la sesión demo. Reintenta cuando la API local responda."));
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
          variant="subtle"
          disabled
          title="No disponible en esta versión: aún no se pueden añadir pliegos"
        >
          Añadir pliego
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
          <span className="text-sm font-medium">Buscar por título, expediente o CPV</span>
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
          <p role="alert" className="mt-4 text-error" title={errorCode(tendersQuery.error) ?? undefined}>
            {errorEs(tendersQuery.error, "No se pudo cargar la biblioteca. Comprueba que la API local está en marcha.")}
          </p>
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
                    {t.contracting_body} · Exp. {t.external_id} · CPV {t.cpv_codes.join(", ") || "—"}
                  </span>
                  <span className="tnum mt-1 block text-sm">
                    PBL neto {t.pbl_net ? formatEUR(t.pbl_net) : "—"} · Estado observado {t.status_raw || "—"}
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
