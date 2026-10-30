// Typed client for the BidLab local API (docs/API_CONTRACT.yaml).
// Vite proxies /api in development; the production build shares the API origin.
// All money/points stay backend strings; this module never computes figures.

import type { z } from "zod";
import type { components } from "./generated";
import { evaluationResultSchema, workspaceSchema } from "./schemas";

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "/api/v1";

export const LOCAL_CLIENT = "local-ui";

export type Capabilities = components["schemas"]["Capabilities"];
export type Tender = components["schemas"]["Tender"];
export type TenderList = components["schemas"]["TenderList"];
export type TenderCreate = components["schemas"]["TenderCreate"];
export type TenderBasisInput = components["schemas"]["TenderBasisInput"];
export type TenderDocument = components["schemas"]["Document"];
export type TenderDocumentKind = components["schemas"]["Document"]["kind"];
export type Workspace = components["schemas"]["Workspace"];
export type DemoSession = components["schemas"]["DemoSession"];
export type MetadataEvidence = components["schemas"]["MetadataEvidence"];
export type PriceBasis = components["schemas"]["PriceBasis"];
export type PageText = components["schemas"]["PageText"];
export type Citation = components["schemas"]["Citation"];
export type ClaimProposal = components["schemas"]["ClaimProposal"];
export type CitationProposal = components["schemas"]["CitationProposal"];
export type ConsistencyEvidence = components["schemas"]["ConsistencyEvidence"];
export type ConsistencyFinding = components["schemas"]["ConsistencyFinding"];
export type ConsistencyReport = components["schemas"]["ConsistencyReport"];
export type RequirementNode = components["schemas"]["RequirementNode"];
export type RequirementLeaf = components["schemas"]["RequirementLeaf"];
export type RequirementGroup = components["schemas"]["RequirementGroup"];
export type PricingRule = components["schemas"]["PricingRule"];
export type Company = components["schemas"]["Company"];
export type CompanyUpdate = components["schemas"]["CompanyUpdate"];
export type CompanyEvidence = components["schemas"]["CompanyEvidence"];
export type EligibilityRequest = components["schemas"]["EligibilityRequest"];
export type EligibilityResult = components["schemas"]["EligibilityResult"];
export type EvaluationRequest = components["schemas"]["EvaluationRequest"];
export type EvaluationResult = components["schemas"]["EvaluationResult"];
export type CurvePoint = components["schemas"]["CurvePoint"];
export type Scenario = components["schemas"]["Scenario"];
export type ScenarioSummary = components["schemas"]["ScenarioSummary"];
export type ScenarioList = components["schemas"]["ScenarioList"];
export type ReportSummary = components["schemas"]["ReportSummary"];
export type ReportList = components["schemas"]["ReportList"];
export type CompareRequest = components["schemas"]["CompareRequest"];
export type FrontierRequest = components["schemas"]["FrontierRequest"];
export type FrontierResult = components["schemas"]["FrontierResult"];
export type FrontierEntry = components["schemas"]["FrontierEntry"];
export type CompareResult = components["schemas"]["CompareResult"];
export type CompareEntry = components["schemas"]["CompareEntry"];
export type CompareDelta = components["schemas"]["CompareDelta"];
export type Report = components["schemas"]["Report"];
export type Decision = components["schemas"]["ReportCreate"]["decision"];
export type ReviewRequest = components["schemas"]["ReviewRequest"];
export type AnalysisRequest = components["schemas"]["AnalysisRequest"];
export type Job = components["schemas"]["Job"];
export type CompanyWrite = components["schemas"]["CompanyWrite"];

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

export interface TenderSearchParams {
  q?: string;
  page?: number;
  page_size?: number;
}

export function listTenders(params?: TenderSearchParams, signal?: AbortSignal): Promise<TenderList> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  query.set("page", String(params?.page ?? 1));
  query.set("page_size", String(params?.page_size ?? 20));
  return getJson<TenderList>(`/tenders?${query.toString()}`, signal);
}

export async function getWorkspace(tenderId: string, signal?: AbortSignal): Promise<Workspace> {
  const payload: unknown = await getJson(`/tenders/${encodeURIComponent(tenderId)}/workspace`, signal);
  return parseOrThrow(workspaceSchema, payload);
}

export function getCompany(companyId: string, signal?: AbortSignal): Promise<Company> {
  return getJson<Company>(`/companies/${encodeURIComponent(companyId)}`, signal);
}

export function updateCompany(companyId: string, payload: CompanyUpdate, signal?: AbortSignal): Promise<Company> {
  return sendJson<Company>("PUT", `/companies/${encodeURIComponent(companyId)}`, payload, { idempotencyKey: newIdempotencyKey(), signal });
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

/** Exact rendered PNG of one physical page; 404 JSON when never rendered. */
export function documentPageImageUrl(documentId: string, pageNumber: number): string {
  return `${API_BASE}/documents/${encodeURIComponent(documentId)}/pages/${pageNumber}/image`;
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

export function listTenderScenarios(
  tenderId: string,
  opts?: { scopeId?: string; page?: number; pageSize?: number; signal?: AbortSignal },
): Promise<ScenarioList> {
  const params = new URLSearchParams({
    page: String(opts?.page ?? 1),
    page_size: String(opts?.pageSize ?? 20),
  });
  if (opts?.scopeId) params.set("scope_id", opts.scopeId);
  return getJson<ScenarioList>(
    `/tenders/${encodeURIComponent(tenderId)}/scenarios?${params}`,
    opts?.signal,
  );
}

export function listTenderReports(
  tenderId: string,
  opts?: { scopeId?: string; page?: number; pageSize?: number; signal?: AbortSignal },
): Promise<ReportList> {
  const params = new URLSearchParams({
    page: String(opts?.page ?? 1),
    page_size: String(opts?.pageSize ?? 20),
  });
  if (opts?.scopeId) params.set("scope_id", opts.scopeId);
  return getJson<ReportList>(
    `/tenders/${encodeURIComponent(tenderId)}/reports?${params}`,
    opts?.signal,
  );
}

export function compareScenarios(
  payload: CompareRequest,
  signal?: AbortSignal,
): Promise<CompareResult> {
  return sendJson<CompareResult>("POST", "/scenarios/compare", payload, { signal });
}

export function decisionFrontier(
  payload: FrontierRequest,
  signal?: AbortSignal,
): Promise<FrontierResult> {
  return sendJson<FrontierResult>("POST", "/scenarios/frontier", payload, { signal });
}

export function createTender(payload: TenderCreate, signal?: AbortSignal): Promise<Tender> {
  return sendJson<Tender>("POST", "/tenders", payload, { idempotencyKey: newIdempotencyKey(), signal });
}

export async function uploadTenderDocument(
  tenderId: string,
  file: File,
  opts?: { kind?: TenderDocumentKind; idempotencyKey?: string; signal?: AbortSignal },
): Promise<TenderDocument> {
  const form = new FormData();
  form.append("file", file);
  if (opts?.kind) form.append("kind", opts.kind);
  const res = await fetch(`${API_BASE}/tenders/${encodeURIComponent(tenderId)}/documents`, {
    method: "POST",
    headers: {
      "X-BidLab-Client": LOCAL_CLIENT,
      "Idempotency-Key": opts?.idempotencyKey ?? newIdempotencyKey(),
    },
    body: form,
    signal: opts?.signal,
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as TenderDocument;
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

export function createCompany(payload: CompanyWrite, signal?: AbortSignal): Promise<Company> {
  return sendJson<Company>("POST", "/companies", payload, { signal });
}

export interface StartedAnalysis {
  job: Job;
  /** Raw Location header (points at the job resource); null when absent. */
  location: string | null;
}

/** Queue extraction (202 + Location). Reads the Location header, so no sendJson. */
export async function startAnalysis(
  tenderId: string,
  payload: AnalysisRequest,
  signal?: AbortSignal,
): Promise<StartedAnalysis> {
  const res = await fetch(`${API_BASE}/tenders/${encodeURIComponent(tenderId)}/analysis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BidLab-Client": LOCAL_CLIENT,
      "Idempotency-Key": newIdempotencyKey(),
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) await parseError(res);
  const job = (await res.json()) as Job;
  return { job, location: res.headers.get("Location") };
}

export function getJob(jobId: string, signal?: AbortSignal): Promise<Job> {
  return getJson<Job>(`/jobs/${encodeURIComponent(jobId)}`, signal);
}

// Prueba de resistencia: malla de rebajas contra hipótesis rivales.
// Tipos del contrato (docs/API_CONTRACT.yaml vía ./generated).

export type StressHypothesisInput = components["schemas"]["StressHypothesisInput"];
export type StressConstraintsInput = components["schemas"]["StressConstraints"];
export type StressTestRequest = components["schemas"]["StressTestRequest"];
export type StressCell = components["schemas"]["StressCell"];
export type StressByDiscount = components["schemas"]["StressByDiscount"];
export type StressSelection = components["schemas"]["StressSelection"];
export type StressTestResult = components["schemas"]["StressTestResult"];

export function runStress(
  scopeId: string,
  payload: StressTestRequest,
  signal?: AbortSignal,
): Promise<StressTestResult> {
  return sendJson<StressTestResult>(
    "POST",
    `/scopes/${encodeURIComponent(scopeId)}/stress-tests`,
    payload,
    { signal },
  );
}

export function getStress(stressId: string, signal?: AbortSignal): Promise<StressTestResult> {
  return getJson<StressTestResult>(`/stress-tests/${encodeURIComponent(stressId)}`, signal);
}

/** Submit a manual review; the response is the new Workspace revision. */
export async function submitReview(
  tenderId: string,
  payload: ReviewRequest,
  signal?: AbortSignal,
): Promise<Workspace> {
  const raw: unknown = await sendJson(
    "POST",
    `/tenders/${encodeURIComponent(tenderId)}/reviews`,
    payload,
    { idempotencyKey: newIdempotencyKey(), signal },
  );
  return parseOrThrow(workspaceSchema, raw);
}

// Pregunta al ayuntamiento: borrador de aclaración redactado por el modelo
// (una llamada live). El servidor construye el prompt desde la cita guardada.

export type ClarificationRequest = components["schemas"]["ClarificationRequest"];
export type ClarificationDraft = components["schemas"]["ClarificationDraft"];
export type ClarificationList = components["schemas"]["ClarificationList"];

/**
 * Draft one clarification question (201; 200 on an idempotent replay).
 * Reuse the same idempotencyKey when retrying one user action: a replay
 * returns the stored draft instead of paying for a second model call.
 */
export function draftClarification(
  tenderId: string,
  payload: ClarificationRequest,
  opts?: { idempotencyKey?: string; signal?: AbortSignal },
): Promise<ClarificationDraft> {
  return sendJson<ClarificationDraft>(
    "POST",
    `/tenders/${encodeURIComponent(tenderId)}/clarifications`,
    payload,
    { idempotencyKey: opts?.idempotencyKey ?? newIdempotencyKey(), signal: opts?.signal },
  );
}

/** Stored drafts for one tender, newest first. Never calls the model. */
export function listClarifications(tenderId: string, signal?: AbortSignal): Promise<ClarificationList> {
  return getJson<ClarificationList>(`/tenders/${encodeURIComponent(tenderId)}/clarifications`, signal);
}
