// Session pointer persistence (localStorage).
// Only the session pointer lives here. Scenario/report collections come
// from the API (UX-10); editable drafts live in lib/draftStore.
//
// Two session kinds share this slot: the curated example ("demo", from
// POST /demo/sessions) and your own tenders ("manual", created step by
// step in intake). The API DemoSession only knows "demo"; the manual
// shape is a local pointer with the same ids.

const SESSION_KEY = "bidlab.session.v1";
const OWN_COMPANIES_KEY = "bidlab.ownCompanies.v1";

export type SessionMode = "demo" | "manual";

export interface StoredSession {
  tender_id: string;
  scope_id: string;
  company_id: string;
  mode: SessionMode;
  createdAt: string;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.tender_id || !parsed.scope_id || !parsed.company_id) return null;
    if (parsed.mode !== "demo" && parsed.mode !== "manual") return null;
    return {
      tender_id: parsed.tender_id,
      scope_id: parsed.scope_id,
      company_id: parsed.company_id,
      mode: parsed.mode,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
    };
  } catch {
    return null;
  }
}

export function storeSession(session: {
  tender_id: string;
  scope_id: string;
  company_id: string;
  mode: SessionMode;
}): StoredSession {
  const stored: StoredSession = { ...session, createdAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  return stored;
}

/**
 * Own tender -> company pointer. The API has no company list, so intake
 * step 3 records which company belongs to each own tender; the library
 * restores the manual session from here when you reopen it.
 */
export function rememberOwnCompany(tenderId: string, scopeId: string, companyId: string): void {
  try {
    const raw = localStorage.getItem(OWN_COMPANIES_KEY);
    const map = (raw ? (JSON.parse(raw) as Record<string, { scope_id: string; company_id: string }>) : {});
    map[tenderId] = { scope_id: scopeId, company_id: companyId };
    localStorage.setItem(OWN_COMPANIES_KEY, JSON.stringify(map));
  } catch {
    // The session still works for this visit; reopening asks for the company again.
  }
}

export function ownCompanyFor(tenderId: string): { scope_id: string; company_id: string } | null {
  try {
    const raw = localStorage.getItem(OWN_COMPANIES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { scope_id: string; company_id: string }>;
    const found = map[tenderId];
    if (!found?.scope_id || !found?.company_id) return null;
    return { scope_id: found.scope_id, company_id: found.company_id };
  } catch {
    return null;
  }
}
