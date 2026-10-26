// Citation deep-links for Pricing Lab figures (T24). Buttons open the shared
// evidence drawer; every label comes from workspace data, never computed.

import type { Citation } from "../../api/client";

interface Props {
  citations: Citation[];
  onSelect: (citation: Citation) => void;
  emptyText?: string;
}

/** Small "p. N" buttons, same pattern as the requirements matrix. */
export function SourceCitations({ citations, onSelect, emptyText }: Props) {
  if (citations.length === 0) {
    return <span className="text-xs text-[#3A4560]">{emptyText ?? "Sin citas vinculadas"}</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {citations.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c)}
          aria-label={`Ver evidencia ${c.id}, página ${c.page_number}`}
          title={`${c.id} · p. ${c.page_number} (${c.match_status})`}
          className="rounded-md border border-[#3159D9] px-1.5 py-0.5 text-xs text-[#3159D9]"
        >
          p. {c.page_number}
        </button>
      ))}
    </span>
  );
}
