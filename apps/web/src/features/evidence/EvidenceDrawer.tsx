import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  ApiError,
  documentContentUrl,
  getDocumentContentStatus,
  getPage,
  type Citation,
  type Workspace,
} from "../../api/client";
import { TechnicalDetails } from "../../components/TechnicalDetails";
import { Button } from "../../components/ui";
import { textoEs } from "../../lib/citationNames";

export interface EvidenceTarget {
  citation: Citation;
}

interface Props {
  workspace: Workspace;
  target: EvidenceTarget;
  /**
   * Called after the O1 exit animation finishes (delayed unmount); the
   * parent unmounts the drawer in response, which returns focus to the
   * opener via the mount effect cleanup below.
   */
  onClose: () => void;
}

/**
 * Must stay >= the .drawer-enter/.drawer-scrim durations in styles.css so
 * the O1 exit animation finishes before the drawer unmounts.
 */
const DRAWER_EXIT_MS = 250;

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), [tabindex]:not([tabindex='-1'])")].filter(
    (el) => el.getClientRects().length > 0
  );
}

/** Lowercase first letter: "Copiado tal cual" -> "copiado tal cual". */
function minuscula(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Whitespace-insensitive comparison for the quote/page-text dedupe. */
function normalizado(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Accessible evidence drawer. Page text comes from the API; when the original
 * bytes are not redistributed it says so instead of rendering a fake preview.
 * True modal: scrim, focus trap and body scroll lock; page resyncs when the
 * citation changes (callers also key by citation id). The panel is fully
 * opaque (bg-white, no translucency) with an always-visible close button.
 */
export function EvidenceDrawer({ workspace, target, onClose }: Props) {
  const { citation } = target;
  const [page, setPage] = useState(citation.page_number);
  // O1 exit animation: `closing` renders the exit classes and `onClose`
  // (parent unmount) runs after DRAWER_EXIT_MS. Re-entrant close requests
  // while the exit plays are ignored. Callers key by citation id, so a new
  // citation remounts with fresh state and clears any pending exit timer.
  const [closing, setClosing] = useState(false);
  const exitTimer = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const doc = workspace.documents.find((d) => d.id === citation.document_id) ?? null;

  const requestClose = useCallback(() => {
    if (exitTimer.current !== null) return;
    setClosing(true);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = null;
      onClose();
    }, DRAWER_EXIT_MS);
  }, [onClose]);

  // F1 stale-state: callers key by citation id, so a new citation remounts
  // the drawer on its own page; no resync effect needed.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusables(panel);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

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
  const pageText = pageQuery.data?.raw_text ?? null;
  const duplicate = pageText !== null && normalizado(pageText) === normalizado(citation.verbatim_excerpt);
  const nombreDocumento =
    doc === null
      ? "Documento del pliego"
      : doc.kind === "pcap"
        ? "Pliego de condiciones (PCAP)"
        : "Documento de la licitación";

  return (
    <div className="fixed inset-0 z-50">
      <div
        data-testid="evidence-scrim"
        aria-hidden="true"
        onClick={requestClose}
        className={clsx("drawer-scrim absolute inset-0 bg-black/40", closing && "drawer-scrim-exit")}
      />
      <div
        ref={panelRef}
        data-testid="evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Cita del pliego, página ${citation.page_number}`}
        className={clsx(
          "drawer-enter absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl",
          closing && "drawer-exit"
        )}
      >
      <div className="flex items-start justify-between gap-3 border-b border-line p-4">
        <div>
          <h2 className="text-lg font-semibold">Lo que dice el pliego</h2>
          <p data-testid="evidence-page" className="tnum mt-1 text-sm text-muted">
            Página {page} de {total ?? "—"}
          </p>
        </div>
        <Button ref={closeRef} variant="subtle" onClick={requestClose} className="min-h-[48px]">
          Cerrar
        </Button>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4"
        tabIndex={0}
        role="region"
        aria-label="Contenido de la cita, desplázate verticalmente"
      >
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="font-medium text-muted">Documento</dt>
            <dd>
              <p>{nombreDocumento}</p>
              <p className="mt-1">Documento de consulta revisado para la demo.</p>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted">
              {duplicate
                ? "Cita y texto de la página (el mismo texto)"
                : `Cita (${minuscula(textoEs(citation.match_status))})`}
            </dt>
            <dd className="mt-1 rounded-lg bg-surface p-3" data-testid="evidence-quote">
              {citation.verbatim_excerpt}
            </dd>
          </div>
        </dl>

        <TechnicalDetails
          className="mt-3"
          items={[
            { label: "SHA-256 del documento", value: citation.document_sha256 },
            { label: "Identificador de cita", value: citation.id },
            { label: "Identificador de documento", value: citation.document_id },
            ...(pageQuery.data
              ? [{ label: "Extractor", value: pageQuery.data.extractor_version }]
              : []),
            ...(pageQuery.data && pageQuery.data.quality_flags.length > 0
              ? [{ label: "Calidad del texto", value: pageQuery.data.quality_flags.join(", ") }]
              : []),
          ]}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="subtle"
            className="min-h-[48px]"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Página anterior
          </Button>
          <Button
            variant="subtle"
            className="min-h-[48px]"
            onClick={() => setPage((p) => (total ? Math.min(total, p + 1) : p + 1))}
            disabled={total !== null && page >= total}
          >
            Página siguiente
          </Button>
          {page !== citation.page_number && (
            <Button variant="secondary" onClick={() => setPage(citation.page_number)}>
              Volver a la cita (p. {citation.page_number})
            </Button>
          )}
        </div>

        <section aria-label="Texto de la página" className="mt-4">
          <h3 className="font-semibold">Texto de la página</h3>
          {pageQuery.isPending && <p className="mt-2 text-sm">Cargando página…</p>}
          {pageQuery.isError && (
            <p role="alert" className="mt-2 text-sm text-error">
              {pageQuery.error instanceof ApiError && pageQuery.error.status === 404
                ? `La página ${page} no está en la copia revisada.`
                : "No pudimos cargar la página. Prueba con otra página."}
            </p>
          )}
          {pageQuery.data &&
            (duplicate ? (
              <p className="mt-2 text-sm">Es el mismo texto que la cita de arriba.</p>
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm">{pageQuery.data.raw_text}</p>
            ))}
        </section>

        <section aria-label="Documento original" className="mt-4">
          <h3 className="font-semibold">Documento original</h3>
          {contentQuery.isPending && <p className="mt-2 text-sm">Comprobando disponibilidad…</p>}
          {contentQuery.data && contentQuery.data.ok && (
            <p className="mt-2 text-sm">
              <a
                href={documentContentUrl(citation.document_id)}
                download
                className="text-primary underline hover:text-primary-ink"
              >
                Descargar PDF original
              </a>
            </p>
          )}
          {contentQuery.data && !contentQuery.data.ok && (
            <p role="status" className="mt-2 text-sm">
              No puedes descargar el PDF original desde aquí. Consúltalo en la web oficial o usa
              el texto de esta página.{" "}
              {doc?.source_url && (
                <a href={doc.source_url} target="_blank" rel="noreferrer" className="text-primary underline hover:text-primary-ink">
                  Ver fuente oficial
                </a>
              )}
            </p>
          )}
        </section>
      </div>
      </div>
    </div>
  );
}
