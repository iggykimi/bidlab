// Shell UX phase 1: server-rendered copy assertions for SummaryTab and
// DemoBadge. The demo workspace mirrors fixtures/demo (Tías) so the happy
// path pins every rewritten label; variant workspaces pin nulls, unknown
// codes and unapproved rules. Dynamic values (deadline countdown, dates)
// are recomputed through the same canonical formatters to verify wiring.

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Workspace } from "../../api/client";
import { DemoBadge } from "../../components/DemoBadge";
import { diasRestantes } from "../../lib/dates";
import { formatEurosExact, formatEurosHeadline, formatFechaNormal } from "../../lib/format";
import { SummaryTab } from "./SummaryTab";

const HASH = "c15cf7144811345e9f547cc9b4a86e9054831bdc8c84481bdb830ca81ddb0da4";
const DEADLINE_AT = "2026-11-25T22:59:00Z";
const FLAG_SNAPSHOT = "demo_source_snapshot_not_live";
const FLAG_REVIEW = "semantic_review_pending_for_application";
const WARNING_BYTES = "document doc-tias-pcap: original bytes not redistributed; metadata and excerpts only";

function makeWorkspace(): Workspace {
  return {
    tender: {
      raw_snapshot_sha256: HASH,
      metadata_evidence: [],
      id: "tias",
      source_id: "https://example.invalid/atom",
      source_url: "https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion",
      external_id: "2026/00006554N",
      title: "Servicios de asistencia técnica de gestión del Plan de Actuación Integrado de Tías",
      contracting_body: "Pleno del Ayuntamiento de Tías",
      cpv_codes: ["79411000", "71356200"],
      status_raw: "PUB",
      source_updated_at: "2026-10-25T14:12:11.227+01:00",
      deadline_literal: "2026-11-25 23:59:00; Hora peninsular",
      deadline_at: DEADLINE_AT,
      pbl_net: "118336.00",
      pbl_gross: "126619.52",
      estimated_value: "295840.00",
      scopes: [
        {
          id: "tias-whole",
          tender_id: "tias",
          lot_id: null,
          label: "Contrato inicial completo (24 meses)",
          basis: {
            scope_id: "tias-whole",
            budget_net: "118336.00",
            ceiling_net: "118336.00",
            scoring_reference_net: "118336.00",
            reference_kind: "pbl",
            currency: "EUR",
            unit: "lump_sum",
            period_months: 24,
            tax_kind: "IGIC",
            review_status: "pending",
            evidence_ids: [],
            metadata_evidence: [],
          },
        },
      ],
      quality_flags: [FLAG_SNAPSHOT, FLAG_REVIEW],
    },
    interpretation_revision: 1,
    mode: "demo",
    documents: [],
    claims: [],
    requirements: [],
    citations: [],
    pricing_rules: [
      {
        id: "tias-price-r1",
        revision: 1,
        scope_id: "tias-whole",
        template_id: "proportional_inverse",
        max_points: "49",
        expression: null,
        review_status: "approved",
        zero_denominator_policy: "unknown",
        evidence_ids: [],
        anomaly_policy: {
          id: "tias-18-5",
          source_kind: "explicit_pcap",
          variant: "tias_18_5",
          review_status: "approved",
          three_bidder_absolute_25: true,
          percentage_reduction_one_third: false,
          evidence_ids: [],
        },
      },
    ],
    warnings: [WARNING_BYTES],
  } as unknown as Workspace;
}

function renderSummary(ws: Workspace): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SummaryTab workspace={ws} />
    </MemoryRouter>
  );
}

/** Main view is everything before the Detalles técnicos disclosure. */
function mainPart(html: string): string {
  return html.split("<details")[0] ?? html;
}

/** Voice rule: every user-facing sentence carries at most 20 words. */
function expectShortSentence(html: string, text: string): void {
  expect(html).toContain(text);
  expect(text.split(/\s+/).length).toBeLessThanOrEqual(20);
}

describe("shell: DemoBadge", () => {
  it("names example data in plain words for demo sessions", () => {
    const html = renderToStaticMarkup(<DemoBadge mode="demo" />);
    expect(html).toContain("Datos de ejemplo");
    expect(html).not.toContain("curada");
    expect(html).not.toContain("Curada");
  });

  it("keeps the live badge untouched", () => {
    expect(renderToStaticMarkup(<DemoBadge mode="live" />)).toContain("Análisis en vivo");
  });

  it("renders nothing without a mode", () => {
    expect(renderToStaticMarkup(<DemoBadge mode={null} />)).toBe("");
  });
});

describe("shell: Lo esencial", () => {
  const html = renderSummary(makeWorkspace());

  it("leads with a dynamic deadline through the canonical formatters", () => {
    expect(html).toContain("Lo esencial");
    expect(html).toContain(`Hasta el ${formatFechaNormal(DEADLINE_AT)}`);
    expect(html).toContain(diasRestantes(DEADLINE_AT));
  });

  it("shows budget, duration and what scores with backend figures", () => {
    expect(html).toContain(formatEurosHeadline("118336.00"));
    expect(html).toContain(formatEurosExact("126619.52"));
    expect(html).toContain("sin IGIC");
    expect(html).toContain("con IGIC");
    expect(html).toContain("24 meses");
    expect(html).toContain("El precio da hasta 49 puntos.");
    expect(html).toContain("pliego de condiciones (PCAP)");
  });

  it("guides through three steps linked to their tabs", () => {
    for (const [label, tab] of [
      ["Revisa los requisitos", "tab=requisitos"],
      ["Prueba precios", "tab=pricing"],
      ["Guarda tu decisión", "tab=informe"],
    ] as const) {
      expect(html).toContain(label);
      expect(html).toContain(tab);
    }
  });
});

describe("shell: facts and pricing", () => {
  const html = renderSummary(makeWorkspace());

  it("explains the estimated value against the initial duration", () => {
    expect(html).toContain("Valor estimado del contrato");
    expect(html).toContain(formatEurosHeadline("295840.00"));
    expect(html).toContain("Incluye todo el periodo posible, no solo 24 meses.");
  });

  it("rewrites status, service type and deadline labels", () => {
    expect(html).toContain("Publicada");
    expect(html).toContain("Tipo de servicio (código CPV)");
    expect(html).toContain("79411000 · Servicios generales de consultoría en gestión");
    expect(html).toContain("71356200 · Servicios de asistencia técnica");
    expect(html).toContain("Plazo para presentar ofertas");
    expect(html).toContain(formatFechaNormal(DEADLINE_AT));
    expect(html).toContain("Datos del 25 de octubre de 2026");
    expect(html).toContain("Ver publicación en Contratación del Estado");
  });

  it("describes the price formula in words with the backend maximum", () => {
    expect(html).toContain("¿Cómo suma puntos tu oferta?");
    expect(html).toContain("Cuanto más barata tu oferta, más puntos (hasta 49).");
  });

  it("reduces live analysis to one honest line without a fake action", () => {
    expect(html).toContain(
      "El asistente de IA no está disponible en esta demo: aquí los datos ya vienen revisados."
    );
    expect(html).not.toContain("live-attempt");
    expect(html).not.toContain("Intentar análisis en vivo");
  });
});

describe("shell: Detalles técnicos", () => {
  const html = renderSummary(makeWorkspace());
  const main = mainPart(html);

  it("keeps the snapshot hash, quality codes and warnings behind the disclosure", () => {
    expect(html).toContain("Detalles técnicos");
    for (const value of [HASH, FLAG_SNAPSHOT, FLAG_REVIEW, WARNING_BYTES]) {
      expect(html).toContain(value);
      expect(main).not.toContain(value);
    }
  });

  it("files raw codes and identifiers as verbatim provenance", () => {
    for (const value of ["PUB", "proportional_inverse", "tias_18_5", "2026-11-25 23:59:00"]) {
      expect(html).toContain(value);
      expect(main).not.toContain(value);
    }
  });

  it("labels the IGIC rate as derived and never shows it in the main view", () => {
    expect(html).toContain("7 % calculado a partir de ambas cifras oficiales");
    expect(main).not.toContain("7 %");
  });

  it("drops the unproven timezone claim everywhere", () => {
    expect(html).not.toContain("Hora peninsular");
    expect(html).not.toContain("peninsular");
  });

  it("keeps jargon out of the main view", () => {
    for (const token of [
      "Snapshot",
      "snapshot",
      "semilla",
      "curada",
      "Curada",
      "backend",
      "Backend",
      "PBL",
      "bruto",
      "instantánea",
      "Anormalidad",
      "Análisis en vivo",
      "live-attempt",
      "cit-",
    ]) {
      expect(main).not.toContain(token);
    }
  });
});

describe("shell: unknown and empty states", () => {
  function emptyWorkspace(): Workspace {
    const ws = makeWorkspace();
    ws.tender.status_raw = "";
    ws.tender.deadline_literal = null;
    ws.tender.deadline_at = null;
    ws.tender.pbl_net = null;
    ws.tender.pbl_gross = null;
    ws.tender.estimated_value = null;
    ws.tender.cpv_codes = [];
    ws.tender.scopes = [];
    ws.tender.quality_flags = [];
    ws.pricing_rules = [];
    ws.warnings = [];
    return ws;
  }

  it("renders sin determinar everywhere instead of NaN or undefined", () => {
    const html = renderSummary(emptyWorkspace());
    expect(html).toContain("Sin determinar");
    expect(html).toContain("Los puntos de precio aún no están revisados.");
    expect(html).toContain("Aún no hay fórmula de puntos revisada.");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("undefined");
  });

  it("passes unknown status codes through verbatim", () => {
    const ws = makeWorkspace();
    ws.tender.status_raw = "XYZ";
    const html = renderSummary(ws);
    expect(mainPart(html)).toContain("XYZ");
  });

  it("names IVA when the scope tax is VAT", () => {
    const ws = makeWorkspace();
    const scope = ws.tender.scopes[0];
    if (!scope) throw new Error("fixture must carry one scope");
    scope.basis.tax_kind = "VAT";
    const html = renderSummary(ws);
    expect(mainPart(html)).toContain("sin IVA");
    expect(html).not.toContain("7 % calculado");
  });

  it("hides the derived rate when either figure is missing", () => {
    const ws = makeWorkspace();
    ws.tender.pbl_gross = null;
    expect(renderSummary(ws)).not.toContain("7 % calculado");
  });

  it("falls back to sin determinar when only the raw literal exists", () => {
    const ws = makeWorkspace();
    ws.tender.deadline_at = null;
    const html = renderSummary(ws);
    expect(mainPart(html)).toContain("Sin determinar");
    expect(html).toContain("2026-11-25 23:59:00");
    expect(html).not.toContain("Hora peninsular");
  });

  it("states unsupported, blocked and pending rules in plain words", () => {
    const unsupported = makeWorkspace();
    const firstUnsupported = unsupported.pricing_rules[0];
    if (!firstUnsupported) throw new Error("fixture must carry one rule");
    firstUnsupported.template_id = "unsupported";
    expect(renderSummary(unsupported)).toContain("Fórmula no soportada.");

    const linear = makeWorkspace();
    const firstLinear = linear.pricing_rules[0];
    if (!firstLinear) throw new Error("fixture must carry one rule");
    firstLinear.template_id = "linear_discount";
    expect(renderSummary(linear)).toContain("Tu oferta compite por precio (hasta 49 puntos).");

    const blocked = makeWorkspace();
    const firstBlocked = blocked.pricing_rules[0];
    if (!firstBlocked) throw new Error("fixture must carry one rule");
    firstBlocked.review_status = "blocked";
    const blockedHtml = renderSummary(blocked);
    expect(blockedHtml).toContain("La fórmula está bloqueada.");
    expect(blockedHtml).toContain("No uses estos puntos.");

    const pending = makeWorkspace();
    const firstPending = pending.pricing_rules[0];
    if (!firstPending) throw new Error("fixture must carry one rule");
    firstPending.review_status = "pending";
    const pendingHtml = renderSummary(pending);
    expect(pendingHtml).toContain("La fórmula aún no está revisada.");
    expect(pendingHtml).toContain("Los puntos pueden cambiar.");
  });
});

describe("shell: word budget (≤20 per sentence)", () => {
  const html = renderSummary(makeWorkspace());
  const emptyHtml = renderSummary(
    (() => {
      const ws = makeWorkspace();
      ws.pricing_rules = [];
      return ws;
    })()
  );

  it("keeps every key sentence within twenty words", () => {
    for (const text of [
      "El asistente de IA no está disponible en esta demo: aquí los datos ya vienen revisados.",
      "Cuanto más barata tu oferta, más puntos (hasta 49).",
      "El precio da hasta 49 puntos.",
      "Aquí solo calculas los puntos del precio.",
      "Revisa los demás criterios en el pliego de condiciones (PCAP).",
      "Incluye todo el periodo posible, no solo 24 meses.",
      "Datos del 25 de octubre de 2026.",
      "7 % calculado a partir de ambas cifras oficiales",
    ]) {
      expectShortSentence(html, text);
    }
    for (const text of [
      "Los puntos de precio aún no están revisados.",
      "Aún no hay fórmula de puntos revisada.",
    ]) {
      expectShortSentence(emptyHtml, text);
    }
  });

  it("keeps each guided step within twenty words", () => {
    for (const [link, rest] of [
      ["Revisa los requisitos", "y comprueba si puedes presentarte."],
      ["Prueba precios", "y mira cuántos puntos consigues."],
      ["Guarda tu decisión", "en el informe, con tus notas."],
    ] as const) {
      expect(html).toContain(link);
      expect(html).toContain(rest);
      expect(`${link} ${rest}`.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });
});
