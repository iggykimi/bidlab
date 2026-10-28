import { useState } from "react";
import type { Workspace } from "../../api/client";
import { TechnicalDetails } from "../../components/TechnicalDetails";
import { Button } from "../../components/ui";
import { citationName, textoEs } from "../../lib/citationNames";
import { formatFechaNormal } from "../../lib/format";
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

export function EvidenceTab({ workspace }: Props) {
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);

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
        <h2>Dónde lo dice el pliego</h2>
        <p className="mt-1 text-sm text-muted">
          Cada cifra respaldada enlaza con la página del pliego donde aparece. «Copiado tal
          cual» quiere decir que la cita reproduce el pliego palabra por palabra.
        </p>
        <p className="mt-2 text-sm">Desliza a la derecha para ver más →</p>
        <div
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
