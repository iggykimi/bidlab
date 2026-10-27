// Demo session persistence (localStorage).
// Only the session pointer lives here. Scenario/report collections come
// from the API (UX-10); editable drafts live in lib/draftStore.

import type { DemoSession } from "../api/client";

const SESSION_KEY = "bidlab.session.v1";

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
