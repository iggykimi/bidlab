// Borradores por contexto (UX-01..03, UX-10): el texto editable vive fuera
// de las pestañas desmontadas, con clave tender+scope+company, y sobrevive
// a navegar y recargar. Solo guarda texto de formulario y selecciones;
// las cifras se recalculan siempre desde el API. Sin secretos.

import type { CompanyEvidence } from "../api/client";
import { DEFAULTS, type Hypotheses } from "../features/pricing/hypotheses";
import { DISCOUNT_MAX, DISCOUNT_MIN } from "./validation";

export interface DraftContext {
  tenderId: string;
  scopeId: string;
  companyId: string;
}

export function contextKey(ctx: DraftContext): string {
  return [ctx.tenderId, ctx.scopeId, ctx.companyId].map(encodeURIComponent).join("|");
}

export interface SavedCopy {
  id: string;
  hash: string;
  name: string;
  inputKey: string;
}

export interface PricingDraft {
  h: Hypotheses;
  scenarioName: string;
  savedCopy: SavedCopy | null;
}

export interface ReportDraft {
  decision: string;
  note: string;
  selectedScenario: string | null;
}

export interface CompanyDraft {
  name: string;
  direct: string;
  overhead: string;
  addedEvidence: CompanyEvidence[];
  /** Company revision this draft was initialized from; null until then. */
  baseRevision: number | null;
}

export interface ContextDrafts {
  pricing: PricingDraft;
  report: ReportDraft;
  company: CompanyDraft;
}

export function defaultPricingDraft(): PricingDraft {
  return { h: { ...DEFAULTS }, scenarioName: "Base 5 %", savedCopy: null };
}

export function defaultReportDraft(): ReportDraft {
  return { decision: "study", note: "", selectedScenario: null };
}

export function defaultCompanyDraft(): CompanyDraft {
  return { name: "", direct: "", overhead: "", addedEvidence: [], baseRevision: null };
}

export function defaultDrafts(): ContextDrafts {
  return { pricing: defaultPricingDraft(), report: defaultReportDraft(), company: defaultCompanyDraft() };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Identidad canónica de una entrada (UX-04): el orden de las claves no
 * altera la huella, a diferencia de un JSON.stringify directo.
 */
export function stableKey(value: unknown): string {
  return JSON.stringify(canonical(value)) ?? "null";
}

const STORE_VERSION = 2;
const MAX_CONTEXTS = 20;
const MAX_NOTE = 4000;
const MAX_SHORT = 200;
const MAX_PRICE = 64;

function shortText(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeHypotheses(value: unknown): Hypotheses {
  const raw = (value !== null && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const discount = finiteNumber(raw.discountPct);
  return {
    discountPct:
      discount !== null && discount >= DISCOUNT_MIN && discount <= DISCOUNT_MAX
        ? discount
        : DEFAULTS.discountPct,
    rivalAPrice: shortText(raw.rivalAPrice, MAX_PRICE) ?? DEFAULTS.rivalAPrice,
    rivalAGroup: shortText(raw.rivalAGroup, MAX_SHORT) ?? DEFAULTS.rivalAGroup,
    rivalBPrice: shortText(raw.rivalBPrice, MAX_PRICE) ?? DEFAULTS.rivalBPrice,
    rivalBGroup: shortText(raw.rivalBGroup, MAX_SHORT) ?? DEFAULTS.rivalBGroup,
    ownGroup: shortText(raw.ownGroup, MAX_SHORT) ?? DEFAULTS.ownGroup,
    complete: flag(raw.complete, DEFAULTS.complete),
    groupsConfirmed: flag(raw.groupsConfirmed, DEFAULTS.groupsConfirmed),
    noRivals: flag(raw.noRivals, DEFAULTS.noRivals),
    rivalState: raw.rivalState === "unspecified" ? "unspecified" : "assumed",
  };
}

function sanitizeSavedCopy(value: unknown): SavedCopy | null {
  if (value === null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = shortText(raw.id, MAX_SHORT);
  const hash = shortText(raw.hash, MAX_SHORT);
  const name = shortText(raw.name, MAX_SHORT);
  const inputKey = typeof raw.inputKey === "string" ? raw.inputKey : null;
  if (!id || !hash || !name || !inputKey) return null;
  return { id, hash, name, inputKey };
}

const DECISIONS = new Set(["study", "prepare", "discard"]);
const SOURCE_TYPES = new Set(["synthetic", "user_attestation", "document_reference"]);
const MAX_EVIDENCE_ROWS = 20;

function sanitizeEvidenceRow(value: unknown): CompanyEvidence | null {
  if (value === null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const fieldKey = shortText(raw.field_key, MAX_SHORT);
  const rowValue = shortText(raw.value, MAX_SHORT);
  if (!fieldKey || !rowValue) return null;
  const source = shortText(raw.source_type, 32);
  return {
    field_key: fieldKey,
    value: rowValue,
    unit: shortText(raw.unit, 32) ?? "",
    period_from: null,
    period_to: null,
    source_type: source !== null && SOURCE_TYPES.has(source) ? (source as CompanyEvidence["source_type"]) : "user_attestation",
    reference: shortText(raw.reference, MAX_SHORT) ?? "",
    reviewed: flag(raw.reviewed, false),
  };
}

function sanitizeCompanyDraft(value: unknown): CompanyDraft {
  const raw = (value !== null && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const base = finiteNumber(raw.baseRevision);
  const rows: CompanyEvidence[] = [];
  if (Array.isArray(raw.addedEvidence)) {
    for (const item of raw.addedEvidence.slice(0, MAX_EVIDENCE_ROWS)) {
      const clean = sanitizeEvidenceRow(item);
      if (clean) rows.push(clean);
    }
  }
  return {
    name: shortText(raw.name, MAX_SHORT) ?? "",
    direct: shortText(raw.direct, MAX_PRICE) ?? "",
    overhead: shortText(raw.overhead, MAX_PRICE) ?? "",
    addedEvidence: rows,
    baseRevision: base !== null && Number.isInteger(base) && base >= 0 ? base : null,
  };
}

function sanitizeDrafts(value: unknown): ContextDrafts {
  const raw = (value !== null && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const pricing = (raw.pricing !== null && typeof raw.pricing === "object" ? raw.pricing : {}) as Record<
    string,
    unknown
  >;
  const report = (raw.report !== null && typeof raw.report === "object" ? raw.report : {}) as Record<
    string,
    unknown
  >;
  const decision = shortText(report.decision, 16);
  const selected = shortText(report.selectedScenario, MAX_SHORT);
  return {
    pricing: {
      h: sanitizeHypotheses(pricing.h),
      scenarioName: shortText(pricing.scenarioName, MAX_SHORT) ?? defaultPricingDraft().scenarioName,
      savedCopy: sanitizeSavedCopy(pricing.savedCopy),
    },
    report: {
      decision: decision !== null && DECISIONS.has(decision) ? decision : "study",
      note: shortText(report.note, MAX_NOTE) ?? "",
      selectedScenario: selected && selected.length > 0 ? selected : null,
    },
    company: sanitizeCompanyDraft(raw.company),
  };
}

/** Puras para unit tests: (de)serialización sin tocar localStorage. */
export function parseDraftStore(raw: string | null): Record<string, ContextDrafts> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    const root = parsed as Record<string, unknown>;
    if (root.version !== STORE_VERSION || root.contexts === null || typeof root.contexts !== "object") {
      return {};
    }
    const out: Record<string, ContextDrafts> = {};
    for (const [key, value] of Object.entries(root.contexts as Record<string, unknown>)) {
      if (typeof key === "string" && key.length > 0 && key.length <= 400) out[key] = sanitizeDrafts(value);
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeDraftStore(store: Record<string, ContextDrafts>): string {
  const entries = Object.entries(store).slice(-MAX_CONTEXTS);
  return JSON.stringify({ version: STORE_VERSION, contexts: Object.fromEntries(entries) });
}

const STORAGE_KEY = "bidlab.drafts.v2";

function storageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

export function loadDraftStore(): Record<string, ContextDrafts> {
  if (!storageAvailable()) return {};
  try {
    return parseDraftStore(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveDraftStore(store: Record<string, ContextDrafts>): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeDraftStore(store));
  } catch {
    // Cuota llena o almacenamiento bloqueado: el borrador sigue en memoria.
  }
}
