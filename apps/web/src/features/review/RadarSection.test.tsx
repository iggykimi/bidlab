// T20: server-rendered copy assertions for the incoherence radar.
// Empty state stays honest ("sin pares comparables"); the happy path
// shows both evidences plus the neutral question; the synthetic
// example is always labeled as such.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ConsistencyFinding, ConsistencyReport } from "../../api/client";
import { RadarSection } from "./RadarSection";

const SYNTHETIC: ConsistencyFinding = {
  field: "period_months",
  same_document: false,
  evidence_a: {
    observation_id: "obs-sintetica-pcap",
    document_id: "doc-sintetico-pcap",
    document_sha256: "0".repeat(64),
    physical_page: 2,
    verbatim_excerpt: "Plazo inicial de prestación: 24 meses.",
    value: "24",
  },
  evidence_b: {
    observation_id: "obs-sintetica-ppt",
    document_id: "doc-sintetico-ppt",
    document_sha256: "1".repeat(64),
    physical_page: 3,
    verbatim_excerpt: "Plazo inicial de prestación: 12 meses.",
    value: "12",
  },
  question: "¿Hablan de lo mismo?",
  synthetic: true,
};

const REAL_ITEM: ConsistencyFinding = {
  ...SYNTHETIC,
  field: "budget_net",
  same_document: true,
  question: "¿Hablan del mismo importe?",
  synthetic: false,
};

function render(report: ConsistencyReport): string {
  return renderToStaticMarkup(<RadarSection report={report} />);
}

describe("RadarSection", () => {
  it("shows an honest empty state plus the labeled synthetic example", () => {
    const html = render({ items: [], synthetic_example: SYNTHETIC });
    expect(html).toContain("Sin pares comparables");
    expect(html).toContain("Ejemplo sintético");
    expect(html).toContain("doc-sintetico-pcap");
    expect(html).toContain("Página 3");
    expect(html).toContain("no salen de tus documentos");
  });

  it("shows both evidences and the question for a real mismatch", () => {
    const html = render({ items: [REAL_ITEM], synthetic_example: SYNTHETIC });
    expect(html).not.toContain("Sin pares comparables");
    expect(html).toContain("Presupuesto sin impuestos");
    expect(html).toContain("¿Hablan del mismo importe?");
    expect(html).toContain("Página 2");
    expect(html).toContain("Página 3");
    expect(html).toContain("Ejemplo sintético");
  });
});
