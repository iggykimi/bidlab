import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createDemoSession, listTenders, type Tender } from "../../api/client";
import { formatEUR } from "../../lib/format";
import { storeSession } from "../../lib/session";
import { DemoBadge } from "../../components/DemoBadge";
import { useQuery } from "@tanstack/react-query";

export function LibraryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const tendersQuery = useQuery({
    queryKey: ["tenders"],
    queryFn: ({ signal }) => listTenders(signal),
  });

  async function handleDemoLoad() {
    setLoadingDemo(true);
    setDemoError(null);
    try {
      const session = await createDemoSession();
      storeSession(session);
      await navigate(`/tenders/${session.tender_id}?tab=resumen`);
    } catch (error) {
      setDemoError(error instanceof ApiError ? `${error.code}: ${error.message}` : "No se pudo crear la sesión demo");
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
          <p className="mt-1 text-[#3A4560]">De un pliego a una decisión de oferta</p>
        </div>
        <DemoBadge mode={null} />
      </header>

      <div id="contenido" className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="demo-load"
          onClick={handleDemoLoad}
          disabled={loadingDemo}
          className="rounded-lg bg-[#3159D9] px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {loadingDemo ? "Cargando ejemplo…" : "Cargar ejemplo"}
        </button>
        <button
          type="button"
          disabled
          title="No disponible en esta versión: falta el endpoint de creación de licitaciones"
          className="rounded-lg border border-[#C9D2E8] bg-white px-4 py-2 font-semibold text-[#3A4560] disabled:opacity-60"
        >
          Añadir pliego
        </button>
      </div>
      {demoError && (
        <p role="alert" className="mt-3 rounded-lg border border-[#B42318] bg-white p-3 text-[#B42318]">
          {demoError}
        </p>
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
            className="mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
          />
        </label>

        {tendersQuery.isPending && <p className="mt-4">Cargando licitaciones…</p>}
        {tendersQuery.isError && (
          <p role="alert" className="mt-4 text-[#B42318]">
            No se pudo cargar la biblioteca. Comprueba que la API local está en marcha.
          </p>
        )}
        {tendersQuery.isSuccess && visible.length === 0 && (
          <p className="mt-4">Sin resultados. Carga el ejemplo para empezar.</p>
        )}
        {visible.length > 0 && (
          <ul className="mt-4 divide-y divide-[#E5E9F2]">
            {visible.map((t) => (
              <li key={t.id} className="py-3">
                <button
                  type="button"
                  onClick={() => navigate(`/tenders/${t.id}?tab=resumen`)}
                  className="w-full text-left"
                >
                  <span className="font-semibold text-[#3159D9] underline">{t.title}</span>
                  <span className="mt-1 block text-sm text-[#3A4560]">
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
