// Typed client for the BidLab local API (docs/API_CONTRACT.yaml).
// Backend base URL comes from VITE_API_URL; default is the local API.
// All money/points stay backend strings; this module never computes figures.

import type { z } from "zod";
import type { components } from "./generated";
import { evaluationResultSchema, workspaceSchema } from "./schemas";

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api/v1";

export const LOCAL_CLIENT = "local-ui";

export type Capabilities = components["schemas"]["Capabilities"];
export type Tender = components["schemas"]["Tender"];
export type TenderList = components["schemas"]["TenderList"];
export type Workspace = components["schemas"]["Workspace"];
export type DemoSession = components["schemas"]["DemoSession"];
export type MetadataEvidence = components["schemas"]["MetadataEvidence"];
export type PageText = components["schemas"]["PageText"];
export type Citation = components["schemas"]["Citation"];
export type RequirementNode = components["schemas"]["RequirementNode"];
export type RequirementLeaf = components["schemas"]["RequirementLeaf"];
export type RequirementGroup = components["schemas"]["RequirementGroup"];
export type PricingRule = components["schemas"]["PricingRule"];
export type Company = components["schemas"]["Company"];
export type EligibilityRequest = components["schemas"]["EligibilityRequest"];
export type EligibilityResult = components["schemas"]["EligibilityResult"];
export type EvaluationRequest = components["schemas"]["EvaluationRequest"];
export type EvaluationResult = components["schemas"]["EvaluationResult"];
export type CurvePoint = components["schemas"]["CurvePoint"];
export type Scenario = components["schemas"]["Scenario"];
export type Report = components["schemas"]["Report"];
export type Decision = components["schemas"]["ReportCreate"]["decision"];

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];

  constructor(status: number, code: string, message: string, details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<never> {
  let code = `http_${res.status}`;
  let message = `La API devolvió ${res.status}`;
  let details: string[] = [];
  try {
    const body = (await res.json()) as { code?: unknown; message?: unknown; details?: unknown };
    if (typeof body.code === "string") code = body.code;
    if (typeof body.message === "string") message = body.message;
    if (Array.isArray(body.details)) details = body.details.filter((d): d is string => typeof d === "string");
  } catch {
    // Keep the generic message when the body is not JSON.
  }
  throw new ApiError(res.status, code, message, details);
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

async function sendJson<T>(method: "POST" | "PUT", path: string, body: unknown, opts?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-BidLab-Client": LOCAL_CLIENT,
  };
  if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Boundary-parse a payload; unexpected shapes fail closed, never half-render. */
function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(500, "invalid_response", "La API devolvió una respuesta inesperada");
  }
  return parsed.data;
}

export function getCapabilities(signal?: AbortSignal): Promise<Capabilities> {
  return getJson<Capabilities>("/capabilities", signal);
}

export function createDemoSession(signal?: AbortSignal): Promise<DemoSession> {
  return sendJson<DemoSession>("POST", "/demo/sessions", {}, { idempotencyKey: newIdempotencyKey(), signal });
}

export function listTenders(signal?: AbortSignal): Promise<TenderList> {
  return getJson<TenderList>("/tenders?page=1&page_size=100", signal);
}

export async function getWorkspace(tenderId: string, signal?: AbortSignal): Promise<Workspace> {
  const payload: unknown = await getJson(`/tenders/${encodeURIComponent(tenderId)}/workspace`, signal);
  return parseOrThrow(workspaceSchema, payload);
}

export function getCompany(companyId: string, signal?: AbortSignal): Promise<Company> {
  return getJson<Company>(`/companies/${encodeURIComponent(companyId)}`, signal);
}

export function checkEligibility(payload: EligibilityRequest, signal?: AbortSignal): Promise<EligibilityResult> {
  return sendJson<EligibilityResult>("POST", "/eligibility/check", payload, { signal });
}

export function getPage(documentId: string, pageNumber: number, signal?: AbortSignal): Promise<PageText> {
  return getJson<PageText>(`/documents/${encodeURIComponent(documentId)}/pages/${pageNumber}`, signal);
}

export async function getDocumentContentStatus(documentId: string, signal?: AbortSignal): Promise<{ ok: boolean; status: number; message: string }> {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/content`, { method: "GET", signal });
  if (res.ok) return { ok: true, status: res.status, message: "Disponible" };
  try {
    const body = (await res.json()) as { message?: unknown };
    const message = typeof body.message === "string" ? body.message : `Error ${res.status}`;
    return { ok: false, status: res.status, message };
  } catch {
    await res.body?.cancel().catch(() => undefined);
    return { ok: false, status: res.status, message: `Error ${res.status}` };
  }
}

export function documentContentUrl(documentId: string): string {
  return `${API_BASE}/documents/${encodeURIComponent(documentId)}/content`;
}

export async function evaluateScenario(payload: EvaluationRequest, signal?: AbortSignal): Promise<EvaluationResult> {
  const raw: unknown = await sendJson("POST", "/scenarios/evaluate", payload, { signal });
  return parseOrThrow(evaluationResultSchema, raw);
}

export function saveScenario(name: string, input: EvaluationRequest, signal?: AbortSignal): Promise<Scenario> {
  return sendJson<Scenario>("POST", "/scenarios", { name, input }, { idempotencyKey: newIdempotencyKey(), signal });
}

export function getScenario(scenarioId: string, signal?: AbortSignal): Promise<Scenario> {
  return getJson<Scenario>(`/scenarios/${encodeURIComponent(scenarioId)}`, signal);
}

export function createReport(scenarioId: string, decision: Decision, note: string, signal?: AbortSignal): Promise<Report> {
  return sendJson<Report>("POST", "/reports", { scenario_id: scenarioId, decision, note }, { idempotencyKey: newIdempotencyKey(), signal });
}

export function getReport(reportId: string, signal?: AbortSignal): Promise<Report> {
  return getJson<Report>(`/reports/${encodeURIComponent(reportId)}`, signal);
}

export function reportHtmlUrl(reportId: string): string {
  return `${API_BASE}/reports/${encodeURIComponent(reportId)}/html`;
}

export async function fetchReportHtml(reportId: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(reportHtmlUrl(reportId), { signal });
  if (!res.ok) await parseError(res);
  return res.text();
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
