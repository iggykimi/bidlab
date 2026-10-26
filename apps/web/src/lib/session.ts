// Session + saved-scenario persistence (localStorage).
// Only identifiers and UI state live here; every figure is re-fetched from the API.

import type { DemoSession } from "../api/client";

const SESSION_KEY = "bidlab.session.v1";
const SCENARIOS_KEY = "bidlab.scenarios.v1";
const REPORTS_KEY = "bidlab.reports.v1";

export interface StoredSession extends DemoSession {
  createdAt: string;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.tender_id || !parsed.scope_id || !parsed.company_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(session: DemoSession): StoredSession {
  const stored: StoredSession = { ...session, createdAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  return stored;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function idList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberId(key: string, id: string): string[] {
  const ids = [id, ...idList(key).filter((v) => v !== id)].slice(0, 50);
  localStorage.setItem(key, JSON.stringify(ids));
  return ids;
}

export function listSavedScenarios(): string[] {
  return idList(SCENARIOS_KEY);
}

export function rememberScenario(id: string): string[] {
  return rememberId(SCENARIOS_KEY, id);
}

export function listSavedReports(): string[] {
  return idList(REPORTS_KEY);
}

export function rememberReport(id: string): string[] {
  return rememberId(REPORTS_KEY, id);
}
