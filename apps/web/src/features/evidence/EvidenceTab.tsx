import { useState } from "react";
import type { Workspace } from "../../api/client";
import { Button } from "../../components/ui";
import { EvidenceDrawer, type EvidenceTarget } from "./EvidenceDrawer";
import { matchStatusEs, parseStatusEs, rightsStatusEs } from "../pricing/sources";

interface Props {
  workspace: Workspace;
}

export function EvidenceTab({ workspace }: Props) {
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <section aria-label="Documentos" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Documentos</h2>
        {workspace.documents.length === 0 && <p className="mt-2 text-sm">Sin documentos.</p>}
        <ul className="mt-2 space-y-2 text-sm">
          {workspace.documents.map((d) => (
            <li key={d.id} className="rounded-lg border border-line p-3">
              <p className="font-semibold">{d.display_name}</p>
              <p className="tnum mt-1 text-xs text-muted">
                {d.pages_count} páginas · {d.kind} · derechos: {rightsStatusEs(d.rights_status)} ·
                lectura: {parseStatusEs(d.parse_status)}
              </p>
              <p className="tnum break-all text-xs text-muted">SHA {d.sha256}</p>
              {d.source_url && (
                <a href={d.source_url} target="_blank" rel="noreferrer" className="text-primary underline">
                  Ver fuente oficial
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Citas" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Citas verificadas ({workspace.citations.length})</h2>
        <div className="table-scroll mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th scope="col" className="border-b border-border p-2">Cita</th>
                <th scope="col" className="border-b border-border p-2">Página</th>
                <th scope="col" className="border-b border-border p-2">Coincidencia</th>
                <th scope="col" className="border-b border-border p-2">Abrir</th>
              </tr>
            </thead>
            <tbody>
              {workspace.citations.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted">
                    Sin citas verificadas en esta licitación.
                  </td>
                </tr>
              )}
              {workspace.citations.map((c) => (
                <tr key={c.id}>
                  <td className="max-w-md border-b border-line p-2">{c.id}</td>
                  <td className="tnum border-b border-line p-2">{c.page_number}</td>
                  <td className="border-b border-line p-2">{matchStatusEs(c.match_status)}</td>
                  <td className="border-b border-line p-2">
                    <Button
                      variant="chip"
                      onClick={() => setEvidence({ citation: c })}
                      aria-label={`Abrir evidencia ${c.id}, página ${c.page_number}`}
                    >
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
