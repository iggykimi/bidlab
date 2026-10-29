import type {
  ClaimProposal,
  Job,
  PricingRule,
  ReportSummary,
  TenderDocument,
} from "../../api/client";
import { decisionEs } from "../report/ReportTab";

/**
 * Rastro de decisión BL-V2-12 (§14): view-model puro que traduce estados
 * ya existentes a cinco nodos de lectura. Nunca inventa detalles: cada
 * texto sale de datos reales y cada enlace apunta a una pestaña real.
 * Sin CTA ficticias en etapas inaccesibles (sin href entonces).
 */
export type FlowState = "not-started" | "pending" | "complete" | "blocked" | "manual";
export type TraceStepId = "source" | "extract" | "review" | "evaluate" | "decide";

export interface TraceStep {
  id: TraceStepId;
  label: string;
  state: FlowState;
  detail: string;
  href?: string;
}

export interface TraceInput {
  /**
   * Licitación propia (source_id === id) frente al ejemplo curado.
   * workspace.mode es global de la app, no procedencia del caso.
   */
  own: boolean;
  documents: TenderDocument[];
  claims: ClaimProposal[];
  rule: PricingRule | null;
  /** Último análisis seguido en esta sesión, si lo hay. */
  trackedJob: Job | null;
  /** null = desconocido (sin sesión de ámbito). */
  scenarioTotal: number | null;
  /** null = desconocido (sin sesión de ámbito). */
  reports: ReportSummary[] | null;
}

export const TRACE_STATE_ES: Record<FlowState, string> = {
  "not-started": "Sin empezar",
  pending: "Pendiente",
  complete: "Listo",
  blocked: "Bloqueado",
  manual: "Manual",
};

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? uno : varios;
}

function sourceStep(documents: TenderDocument[]): TraceStep {
  const base = { id: "source" as const, label: "Fuente" };
  if (documents.length === 0) {
    return { ...base, state: "not-started", detail: "Sin documento todavía." };
  }
  const doc = documents[0];
  if (doc === undefined) {
    return { ...base, state: "not-started", detail: "Sin documento todavía." };
  }
  const desc = `${doc.display_name} · ${doc.pages_count} ${plural(doc.pages_count, "página", "páginas")}`;
  if (doc.parse_status === "failed") {
    return { ...base, state: "blocked", detail: `No pudimos leer ${doc.display_name}.` };
  }
  if (doc.parse_status === "queued") {
    return { ...base, state: "pending", detail: `Preparando ${doc.display_name}…` };
  }
  return { ...base, state: "complete", detail: desc, href: "?tab=evidencia" };
}

function extractStep(own: boolean, trackedJob: Job | null): TraceStep {
  const base = { id: "extract" as const, label: "Propuesta" };
  if (!own) {
    return { ...base, state: "manual", detail: "Ejemplo preparado.", href: "?tab=evidencia" };
  }
  if (trackedJob !== null) {
    if (trackedJob.status === "queued" || trackedJob.status === "running") {
      return { ...base, state: "pending", detail: "Analizando con Meta…", href: "?tab=revisar" };
    }
    if (trackedJob.status === "failed" || trackedJob.status === "cancelled") {
      return { ...base, state: "blocked", detail: "El análisis falló.", href: "?tab=revisar" };
    }
    if (trackedJob.mode === "live") {
      return { ...base, state: "complete", detail: "Lectura de Meta lista.", href: "?tab=revisar" };
    }
    return { ...base, state: "manual", detail: "Prueba simulada.", href: "?tab=revisar" };
  }
  return { ...base, state: "manual", detail: "Datos introducidos a mano.", href: "?tab=revisar" };
}

function reviewStep(claims: ClaimProposal[], rule: PricingRule | null): TraceStep {
  const base = { id: "review" as const, label: "Revisión" };
  if (rule === null) {
    return { ...base, state: "not-started", detail: "Sin fórmula todavía." };
  }
  if (rule.review_status === "blocked") {
    return {
      ...base,
      state: "blocked",
      detail: "Fórmula bloqueada. No uses sus puntos.",
      href: "?tab=revisar",
    };
  }
  if (rule.review_status === "pending") {
    const pendientes = claims.filter((c) => c.status === "proposed").length;
    const detail =
      pendientes === 0
        ? "Fórmula sin aprobar."
        : `${pendientes} ${plural(pendientes, "propuesta pendiente", "propuestas pendientes")}.`;
    return { ...base, state: "pending", detail, href: "?tab=revisar" };
  }
  return {
    ...base,
    state: "complete",
    detail: `Fórmula aprobada (rev. ${rule.revision}).`,
    href: "?tab=revisar",
  };
}

function evaluateStep(rule: PricingRule | null, scenarioTotal: number | null): TraceStep {
  const base = { id: "evaluate" as const, label: "Cálculo" };
  if (rule === null || rule.review_status !== "approved") {
    return { ...base, state: "pending", detail: "Necesita la fórmula aprobada." };
  }
  if (scenarioTotal === null) {
    return { ...base, state: "pending", detail: "Cargando tus pruebas…" };
  }
  if (scenarioTotal === 0) {
    return { ...base, state: "not-started", detail: "Sin pruebas todavía.", href: "?tab=precio" };
  }
  return {
    ...base,
    state: "complete",
    detail: `${scenarioTotal} ${plural(scenarioTotal, "prueba guardada", "pruebas guardadas")}.`,
    href: "?tab=precio",
  };
}

function decideStep(reports: ReportSummary[] | null): TraceStep {
  const base = { id: "decide" as const, label: "Decisión" };
  if (reports === null) {
    return { ...base, state: "pending", detail: "Cargando tus informes…" };
  }
  if (reports.length === 0) {
    return { ...base, state: "not-started", detail: "Sin informes todavía.", href: "?tab=informe" };
  }
  const latest = reports.reduce((a, b) => (a.created_at >= b.created_at ? a : b));
  return {
    ...base,
    state: "complete",
    detail: `Última: ${decisionEs(latest.decision).toLowerCase()}.`,
    href: "?tab=informe",
  };
}

export function buildDecisionTrace(input: TraceInput): readonly TraceStep[] {
  return [
    sourceStep(input.documents),
    extractStep(input.own, input.trackedJob),
    reviewStep(input.claims, input.rule),
    evaluateStep(input.rule, input.scenarioTotal),
    decideStep(input.reports),
  ];
}
