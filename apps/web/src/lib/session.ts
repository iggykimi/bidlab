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

export interface SavedScenarioEntry {
  id: string;
  name: string;
  savedAt: string;
}

export interface SavedReportEntry {
  id: string;
  savedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function entryList(key: string): { id: string; name: string; savedAt: string }[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: { id: string; name: string; savedAt: string }[] = [];
    for (const item of parsed) {
      // Backward compatible: v1 stored bare id strings.
      if (typeof item === "string") {
        out.push({ id: item, name: "", savedAt: "" });
        continue;
      }
      if (isRecord(item) && typeof item.id === "string") {
        out.push({
          id: item.id,
          name: typeof item.name === "string" ? item.name : "",
          savedAt: typeof item.savedAt === "string" ? item.savedAt : "",
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function rememberEntry(
  key: string,
  entry: { id: string; name: string; savedAt: string }
): { id: string; name: string; savedAt: string }[] {
  const entries = [entry, ...entryList(key).filter((v) => v.id !== entry.id)].slice(0, 50);
  localStorage.setItem(key, JSON.stringify(entries));
  return entries;
}

export function listSavedScenarios(): SavedScenarioEntry[] {
  return entryList(SCENARIOS_KEY);
}

export function rememberScenario(id: string, name: string): SavedScenarioEntry[] {
  return rememberEntry(SCENARIOS_KEY, { id, name, savedAt: new Date().toISOString() });
}

export function listSavedReports(): SavedReportEntry[] {
  return entryList(REPORTS_KEY).map(({ id, savedAt }) => ({ id, savedAt }));
}

export function rememberReport(id: string): SavedReportEntry[] {
  return rememberEntry(REPORTS_KEY, { id, name: "", savedAt: new Date().toISOString() }).map(
    ({ id: entryId, savedAt }) => ({ id: entryId, savedAt })
  );
}
