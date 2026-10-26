import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  documentContentUrl,
  getDocumentContentStatus,
  getPage,
  type Citation,
  type Workspace,
} from "../../api/client";

export interface EvidenceTarget {
  citation: Citation;
}

interface Props {
  workspace: Workspace;
  target: EvidenceTarget;
  onClose: () => void;
}

/**
 * Accessible evidence drawer. Page text comes from the API; when the original
 * bytes are not redistributed it says so instead of rendering a fake preview.
 */
export function EvidenceDrawer({ workspace, target, onClose }: Props) {
  const { citation } = target;
  const [page, setPage] = useState(citation.page_number);
  const closeRef = useRef<HTMLButtonElement>(null);
  const doc = workspace.documents.find((d) => d.id === citation.document_id) ?? null;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pageQuery = useQuery({
    queryKey: ["page", citation.document_id, page],
    queryFn: ({ signal }) => getPage(citation.document_id, page, signal),
    retry: false,
  });

  const contentQuery = useQuery({
    queryKey: ["content-status", citation.document_id],
    queryFn: ({ signal }) => getDocumentContentStatus(citation.document_id, signal),
    retry: false,
  });

  const total = doc?.pages_count ?? null;

  return (
    <div
      data-testid="evidence-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={`Evidencia ${citation.id}`}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#E5E9F2] p-4">
        <div>
          <h2 className="text-lg font-semibold">Evidencia documental</h2>
          <p data-testid="evidence-page" className="tnum mt-1 text-sm text-[#3A4560]">
            Página {page} de {total ?? "—"}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#C9D2E8] px-3 py-1 font-semibold"
        >
          Cerrar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="font-medium text-[#3A4560]">Documento</dt>
            <dd>{doc?.display_name ?? citation.document_id}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#3A4560]">Cita ({citation.match_status})</dt>
            <dd className="mt-1 rounded-lg bg-[#F6F7FB] p-3" data-testid="evidence-quote">
              {citation.verbatim_excerpt}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#3A4560]">SHA-256 del documento</dt>
            <dd className="tnum break-all text-xs">{citation.document_sha256}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-[#C9D2E8] px-3 py-1 disabled:opacity-50"
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => (total ? Math.min(total, p + 1) : p + 1))}
            disabled={total !== null && page >= total}
            className="rounded-lg border border-[#C9D2E8] px-3 py-1 disabled:opacity-50"
          >
            Siguiente →
          </button>
          {page !== citation.page_number && (
            <button
              type="button"
              onClick={() => setPage(citation.page_number)}
              className="rounded-lg border border-[#3159D9] px-3 py-1 text-[#3159D9]"
            >
              Volver a la cita (p. {citation.page_number})
            </button>
          )}
        </div>

        <section aria-label="Texto de la página" className="mt-4">
          <h3 className="font-semibold">Texto de la página (extracto curado)</h3>
          {pageQuery.isPending && <p className="mt-2 text-sm">Cargando página…</p>}
          {pageQuery.isError && (
            <p role="alert" className="mt-2 text-sm text-[#B42318]">
              {pageQuery.error instanceof ApiError && pageQuery.error.status === 404
                ? `Página ${page} no disponible en los extractos curados.`
                : "No se pudo cargar la página."}
            </p>
          )}
          {pageQuery.data && (
            <>
              <p className="mt-2 whitespace-pre-wrap text-sm">{pageQuery.data.raw_text}</p>
              <p className="tnum mt-2 text-xs text-[#3A4560]">
                Extractor {pageQuery.data.extractor_version}
                {pageQuery.data.quality_flags.length > 0 && ` · ${pageQuery.data.quality_flags.join(", ")}`}
              </p>
            </>
          )}
        </section>

        <section aria-label="Documento original" className="mt-4">
          <h3 className="font-semibold">Documento original</h3>
          {contentQuery.isPending && <p className="mt-2 text-sm">Comprobando disponibilidad…</p>}
          {contentQuery.data && contentQuery.data.ok && (
            <p className="mt-2 text-sm">
              <a
                href={documentContentUrl(citation.document_id)}
                download
                className="text-[#3159D9] underline"
              >
                Descargar PDF original
              </a>
            </p>
          )}
          {contentQuery.data && !contentQuery.data.ok && (
            <p role="status" className="mt-2 text-sm">
              Original no redistribuido ({contentQuery.data.status}): {contentQuery.data.message}.{" "}
              {doc?.source_url && (
                <a href={doc.source_url} target="_blank" rel="noreferrer" className="text-[#3159D9] underline">
                  Ver fuente oficial
                </a>
              )}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
