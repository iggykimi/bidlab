import { useState } from "react";
import type { Workspace } from "../../api/client";
import { EvidenceDrawer, type EvidenceTarget } from "./EvidenceDrawer";

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
            <li key={d.id} className="rounded-lg border border-[#E5E9F2] p-3">
              <p className="font-semibold">{d.display_name}</p>
              <p className="tnum mt-1 text-xs text-[#3A4560]">
                {d.pages_count} páginas · {d.kind} · derechos {d.rights_status} · parse {d.parse_status}
              </p>
              <p className="tnum break-all text-xs text-[#3A4560]">SHA {d.sha256}</p>
              {d.source_url && (
                <a href={d.source_url} target="_blank" rel="noreferrer" className="text-[#3159D9] underline">
                  Ver fuente oficial
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Citas" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Citas verificadas ({workspace.citations.length})</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-b border-[#C9D2E8] p-2">Cita</th>
                <th className="border-b border-[#C9D2E8] p-2">Página</th>
                <th className="border-b border-[#C9D2E8] p-2">Coincidencia</th>
                <th className="border-b border-[#C9D2E8] p-2">Abrir</th>
              </tr>
            </thead>
            <tbody>
              {workspace.citations.map((c) => (
                <tr key={c.id}>
                  <td className="max-w-md border-b border-[#E5E9F2] p-2">{c.id}</td>
                  <td className="tnum border-b border-[#E5E9F2] p-2">{c.page_number}</td>
                  <td className="border-b border-[#E5E9F2] p-2">{c.match_status}</td>
                  <td className="border-b border-[#E5E9F2] p-2">
                    <button
                      type="button"
                      onClick={() => setEvidence({ citation: c })}
                      className="rounded-lg border border-[#3159D9] px-2 py-1 text-[#3159D9]"
                      aria-label={`Abrir evidencia ${c.id}, página ${c.page_number}`}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {evidence && <EvidenceDrawer workspace={workspace} target={evidence} onClose={() => setEvidence(null)} />}
    </div>
  );
}
