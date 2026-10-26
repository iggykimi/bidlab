// Pricing Lab source helpers (T23/T24). Lookup-only: every figure stays a
// backend string; this module resolves citations/metadata and translates
// protocol codes to Spanish labels. It never computes money, points or ratios.

import type { Citation, MetadataEvidence, Tender, Workspace } from "../../api/client";

/** Resolve evidence_ids against the workspace citations, keeping order. */
export function citationsByIds(workspace: Workspace, ids: string[]): Citation[] {
  const out: Citation[] = [];
  for (const id of ids) {
    const found = workspace.citations.find((c) => c.id === id);
    if (found && !out.some((c) => c.id === found.id)) out.push(found);
  }
  return out;
}

/** Tender Atom metadata for one key (pbl_net, pbl_gross, estimated_value). */
export function metadataForKey(tender: Tender, key: string): MetadataEvidence | null {
  return tender.metadata_evidence.find((m) => m.key === key) ?? null;
}

const REASON_ES: Record<string, string> = {
  incomplete_scenario: "escenario incompleto: falta el conjunto completo de ofertas",
  incomplete_rival_set: "conjunto rival incompleto: puntuación y anormalidad sin determinar",
  missing_variable: "falta una variable de la fórmula",
  out_of_range: "resultado fuera del rango 0..máximo (sin clamp autorizado)",
  zero_denominator: "división por cero en la fórmula (denominador nulo)",
  below_threshold: "oferta propia bajo el umbral de la rama",
  below_relative_threshold: "oferta propia bajo el umbral relativo (90 % de la media)",
  absolute_25_close: "cierre absoluto: baja superior al 25 % sobre la base (rama n=3)",
  group_membership_unconfirmed: "pertenencia a grupos sin confirmar: anormalidad sin determinar",
  incomplete_group_data: "faltan grupos en alguna oferta: anormalidad sin determinar",
  unsupported_variant: "variante de anormalidad sin política implementada",
  unsupported_percentage_reduction: "reducción de un tercio no implementada",
  percentage_reduction_unsupported: "reducción de un tercio no implementada",
};

/** Backend reason code -> Spanish label. Unknown codes pass through. */
export function reasonEs(code: string): string {
  return REASON_ES[code] ?? code;
}

const BRANCH_ES: Record<string, string> = {
  n1: "un licitador (umbral 75 % de la base)",
  n2: "dos licitadores (umbral 80 % de la otra oferta)",
  n3_trimmed: "tres licitadores, media podada (máxima retirada)",
  n3_no_trim: "tres licitadores, media sin poda",
  n4_trimmed: "cuatro o más, media podada",
  n4_no_trim: "cuatro o más, media sin poda",
  n4_fallback_lowest3: "cuatro o más, media de las tres más bajas",
};

/** Anomaly branch id -> Spanish label. Unknown branches pass through. */
export function branchEs(branch: string | null): string {
  if (branch === null) return "sin rama aplicable";
  return BRANCH_ES[branch] ?? branch;
}

const VARIABLE_ES: Record<string, string> = {
  best_price: "mejor oferta",
  own_price: "precio propio",
  reference_price: "precio de referencia",
  max_points: "puntos máximos",
};

/** Formula variable name -> Spanish label. Unknown names pass through. */
export function variableEs(name: string): string {
  return VARIABLE_ES[name] ?? name;
}

/** Anomaly status -> Spanish label. Unknown codes stay "Sin determinar". */
export function anomalyEs(status: string): string {
  switch (status) {
    case "possible_justification_required":
      return "Posible necesidad de justificación";
    case "not_flagged_under_assumptions":
      return "Sin presunción bajo estos supuestos";
    case "not_applicable":
      return "No aplicable";
    default:
      return "Sin determinar";
  }
}

const MATCH_STATUS_ES: Record<string, string> = {
  exact: "literal",
  normalized_match: "normalizada",
  missing: "ausente",
  manual_visual: "visual manual",
};

/** Citation match status -> Spanish label. Unknown codes pass through. */
export function matchStatusEs(status: string): string {
  return MATCH_STATUS_ES[status] ?? status;
}

const RIGHTS_STATUS_ES: Record<string, string> = {
  research_only: "solo investigación",
  reviewed_for_demo: "revisada para la demo",
  redistribution_allowed: "redistribución permitida",
  unknown: "sin determinar",
};

/** Document rights status -> Spanish label. Unknown codes pass through. */
export function rightsStatusEs(status: string): string {
  return RIGHTS_STATUS_ES[status] ?? status;
}

const PARSE_STATUS_ES: Record<string, string> = {
  queued: "en cola",
  ready: "lista",
  needs_review: "por revisar",
  failed: "fallida",
};

/** Document parse status -> Spanish label. Unknown codes pass through. */
export function parseStatusEs(status: string): string {
  return PARSE_STATUS_ES[status] ?? status;
}

/** Match a source hash to the tender snapshot or a workspace document. */
export function hashOrigin(
  workspace: Workspace,
  hash: string
): { kind: "snapshot" | "document" | "unknown"; label: string } {
  if (workspace.tender.raw_snapshot_sha256 === hash) {
    return { kind: "snapshot", label: "snapshot Atom del anuncio" };
  }
  const doc = workspace.documents.find((d) => d.sha256 === hash);
  if (doc) return { kind: "document", label: doc.display_name };
  return { kind: "unknown", label: "origen no localizado en esta licitación" };
}
