// Citation deep-links for Pricing Lab figures (T24). Buttons open the shared
// evidence drawer; every label comes from workspace data, never computed.

import type { Citation } from "../../api/client";
import { Button } from "../../components/ui";
import { matchStatusEs } from "./sources";

interface Props {
  citations: Citation[];
  onSelect: (citation: Citation) => void;
  emptyText?: string;
}

/** Small "p. N" buttons, same pattern as the requirements matrix. */
export function SourceCitations({ citations, onSelect, emptyText }: Props) {
  if (citations.length === 0) {
    return <span className="text-xs text-muted">{emptyText ?? "Sin citas vinculadas"}</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {citations.map((c) => (
        <Button
          key={c.id}
          variant="chip"
          onClick={() => onSelect(c)}
          aria-label={`Ver evidencia ${c.id}, página ${c.page_number}`}
          title={`${c.id} · p. ${c.page_number} (${matchStatusEs(c.match_status)})`}
        >
          p. {c.page_number}
        </Button>
      ))}
    </span>
  );
}
