// Citation deep-links for price-tab figures (T24). Buttons open the shared
// evidence drawer; every label comes from workspace data, never computed.

import type { Citation } from "../../api/client";
import { Button } from "../../components/ui";
import { citationName, fuenteEs } from "../../lib/citationNames";

interface Props {
  citations: Citation[];
  onSelect: (citation: Citation) => void;
  emptyText?: string;
}

/** Small "p. N" buttons, same pattern as the requirements matrix. The name starts
 * with the visible text so voice control and axe label-content-name-mismatch pass. */
export function SourceCitations({ citations, onSelect, emptyText }: Props) {
  if (citations.length === 0) {
    return <span className="text-xs text-muted">{emptyText ?? "Sin citas vinculadas"}</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1" role="group" aria-label="Citas que respaldan esta cifra">
      {citations.map((c) => (
        <Button
          key={c.id}
          variant="chip"
          onClick={() => onSelect(c)}
          aria-label={`p. ${c.page_number}: ver cita (${citationName(c.id)})`}
          title={`Página ${c.page_number} (${fuenteEs(c.match_status)})`}
        >
          p. {c.page_number}
        </Button>
      ))}
    </span>
  );
}
