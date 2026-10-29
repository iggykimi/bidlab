import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Citation, Workspace } from "../../api/client";
import { EvidenceDrawer } from "./EvidenceDrawer";

const citation = {
  id: "citation-1", document_id: "document-1", document_sha256: "a".repeat(64),
  page_number: 3, verbatim_excerpt: "Plazo inicial: 24 meses.", match_status: "exact",
} as Citation;

function render(mode: Workspace["mode"]): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const workspace = {
    mode,
    documents: [{ id: "document-1", sha256: "a".repeat(64), kind: "pcap", pages_count: 12, source_url: null }],
  } as Workspace;
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EvidenceDrawer workspace={workspace} target={{ citation }} onClose={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("evidence source identity", () => {
  it("does not call an uploaded document a reviewed demo source", () => {
    const html = render("manual");
    expect(html).toContain("Documento que has incorporado a esta licitación.");
    expect(html).toContain("Confirma cada dato antes de usarlo.");
    expect(html).not.toContain("Documento de consulta del ejemplo revisado.");
  });

  it("shows an honest proof trail without inventing rule use", () => {
    const html = render("demo");
    expect(html).toContain("evidence-trail");
    expect(html).toContain("Fuente");
    expect(html).toContain("sin uso en f\u00f3rmula");
    expect(html).toContain("sin f\u00f3rmula");
    expect(html).toContain("no alimenta ning\u00fan c\u00e1lculo");
  });

  it("keeps the curated example label separate from an uploaded source", () => {
    const html = render("demo");
    expect(html).toContain("Documento de consulta del ejemplo revisado.");
    expect(html).not.toContain("Documento que has incorporado");
    expect(html).toContain("Cita de la página 3");
    expect(html).toContain("Página 3 de 12");
  });
});
