import { useEffect, useRef, useState } from "react";
import type { Workspace } from "../../api/client";
import { TechnicalDetails } from "../../components/TechnicalDetails";
import { Button } from "../../components/ui";
import { citationName, textoEs } from "../../lib/citationNames";
import { formatFechaNormal } from "../../lib/format";
import { isOwnTender } from "../review/ownTender";
import { EvidenceDrawer, type EvidenceTarget } from "./EvidenceDrawer";

interface Props {
  workspace: Workspace;
}

/** Plain document title; the raw display_name stays in Detalles técnicos. */
function tituloDocumento(kind: string): string {
  return kind === "pcap" ? "Pliego de condiciones (PCAP)" : "Documento de la licitación";
}

function lineaDocumento(kind: string, pages: number): string {
  const que = kind === "pcap" ? "Pliego de condiciones" : "Documento";
  return `${pages} páginas · ${que}`;
}

/**
 * Dónde ha mirado la revisión (BL-V2-07). Cuenta citas y páginas distintas
 * por documento desde el workspace; no inventa cobertura. La tarjeta
 * gemela de Revisar añade lo enviado al modelo cuando hay un trabajo.
 */
function CoverageCard({ workspace }: Props) {
  const lines = workspace.documents.map((doc) => {
    const cites = workspace.citations.filter((c) => c.document_id === doc.id);
    const pages = [...new Set(cites.map((c) => c.page_number))].sort((a, b) => a - b);
    return { doc, cites: cites.length, pages };
  });
  const totalCites = lines.reduce((n, line) => n + line.cites, 0);
  const own = isOwnTender(workspace.tender);
  return (
    <section aria-label="Cobertura de la revisión" data-testid="coverage-card">
      <h2 className="font-semibold">Dónde hemos mirado</h2>
      {!own && <p className="mt-1 text-sm">Esta es una demostración curada.</p>}
      <p className="mt-1 text-sm text-muted">
        {totalCites === 0
          ? "Aún no hay citas: nada revisado todavía."
          : `${totalCites} ${totalCites === 1 ? "cita" : "citas"} en total.`}
      </p>
      <ul className="mt-2 grid gap-1 text-sm">
        {lines.map(({ doc, cites, pages }) => (
          <li key={doc.id}>
            {doc.display_name}: {cites} {cites === 1 ? "cita" : "citas"} en {pages.length}{" "}
            {pages.length === 1 ? "página" : "páginas"} de {doc.pages_count}.
            {pages.length > 0 && ` Páginas: ${pages.join(", ")}.`}
          </li>
        ))}
      </ul>
      {workspace.documents.length > 0 && (
        <>
          <p className="mt-2 text-sm">
            Este análisis ha priorizado algunas páginas. No sustituye una revisión integral.
          </p>
          <p className="mt-1 text-sm">
            Cómo completar la revisión: abre el PDF original y coteja cada requisito a mano.
          </p>
        </>
      )}
    </section>
  );
}

export function EvidenceTab({ workspace }: Props) {
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);
  // BL-V2-04: the scroll hint shows only when the table truly overflows.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 2);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [workspace.citations.length]);

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <section aria-label="Documentos" className="surface">
        <h2>Documentos</h2>
        {workspace.documents.length === 0 && (
          <p className="mt-2 text-sm">Aún no hay documentos en esta licitación.</p>
        )}
        <ul className="mt-2 space-y-2 text-sm">
          {workspace.documents.map((d) => (
            <li key={d.id} className="rounded-lg border border-line p-3">
              <p className="font-semibold">{tituloDocumento(d.kind)}</p>
              <p className="tnum mt-1">{lineaDocumento(d.kind, d.pages_count)}</p>
              <p className="mt-1">Mostramos solo las citas, no el PDF completo.</p>
              {d.source_url && (
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Ver en la web oficial
                </a>
              )}
              <TechnicalDetails
                className="mt-2"
                items={[
                  { label: "Tipo de documento", value: d.kind },
                  { label: "Derechos", value: d.rights_status },
                  { label: "Lectura", value: d.parse_status },
                  { label: "SHA-256", value: d.sha256 },
                  { label: "Identificador", value: d.id },
                ]}
              />
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Dónde lo dice el pliego"
        className="surface"
      >
      <CoverageCard workspace={workspace} />
        <h2 className="mt-4">Dónde lo dice el pliego</h2>
        <p className="mt-1 text-sm text-muted">
          Cada cifra respaldada enlaza con la página del pliego donde aparece. «Copiado tal
          cual» quiere decir que la cita reproduce el pliego palabra por palabra.
        </p>
        {overflows && (
          <p className="mt-2 text-sm" data-testid="citations-scroll-hint">
            Desliza a la derecha para ver más →
          </p>
        )}
        <div
          ref={scrollRef}
          className="table-scroll mt-2 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabla de citas, desplázate horizontalmente"
        >
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th scope="col" className="border-b border-border p-2">
                  Dato respaldado
                </th>
                <th scope="col" className="border-b border-border p-2">
                  <span className="sr-only">Ver cita</span>
                </th>
                <th scope="col" className="border-b border-border p-2">
                  Página
                </th>
                <th scope="col" className="border-b border-border p-2">
                  Texto
                </th>
              </tr>
            </thead>
            <tbody>
              {workspace.citations.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted">
                    Aún no hay citas del pliego vinculadas a las cifras.
                  </td>
                </tr>
              )}
              {workspace.citations.map((c) => (
                <tr key={c.id}>
                  <td className="max-w-md border-b border-line p-2">{citationName(c.id)}</td>
                  <td className="border-b border-line p-2">
                    <Button
                      variant="chip"
                      className="min-h-[48px]"
                      onClick={() => setEvidence({ citation: c })}
                      aria-label={`Ver página ${c.page_number} de ${citationName(c.id)}`}
                    >
                      Ver página {c.page_number}
                    </Button>
                  </td>
                  <td className="tnum border-b border-line p-2">{c.page_number}</td>
                  <td className="border-b border-line p-2">{textoEs(c.match_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workspace.citations.length > 0 && (
          <TechnicalDetails
            className="mt-3"
            items={workspace.citations.map((c) => ({ label: citationName(c.id), value: c.id }))}
          />
        )}
        {workspace.tender.deadline_at && (
          <p className="mt-3 text-sm">
            El plazo ({formatFechaNormal(workspace.tender.deadline_at)}) no está en el pliego:
            viene del{" "}
            <a
              href={workspace.tender.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              anuncio oficial
            </a>
            .
          </p>
        )}
      </section>

      {evidence && (
        <EvidenceDrawer
          key={evidence.citation.id}
          workspace={workspace}
          target={evidence}
          onClose={() => setEvidence(null)}
        />
      )}
    </div>
  );
}
