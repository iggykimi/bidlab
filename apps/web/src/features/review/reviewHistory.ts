// Local review history per own tender (localStorage).
// The API exposes no revision list (only the latest revision number via
// the workspace), so this store records the reviews you approve in this
// browser: revision, actor, reason and date. Honest by construction: the
// UI says these are your local approvals, not the server log.

const HISTORY_KEY = "bidlab.reviewHistory.v1";
const MAX_ENTRIES = 50;

export interface ReviewHistoryEntry {
  tenderId: string;
  revision: number;
  actor: string;
  reason: string;
  createdAt: string;
}

function readAll(): ReviewHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ReviewHistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as ReviewHistoryEntry).tenderId === "string" &&
        typeof (e as ReviewHistoryEntry).revision === "number" &&
        typeof (e as ReviewHistoryEntry).actor === "string" &&
        typeof (e as ReviewHistoryEntry).reason === "string" &&
        typeof (e as ReviewHistoryEntry).createdAt === "string"
    );
  } catch {
    return [];
  }
}

export function loadReviewHistory(tenderId: string): ReviewHistoryEntry[] {
  return readAll().filter((e) => e.tenderId === tenderId);
}

export function appendReviewHistory(entry: Omit<ReviewHistoryEntry, "createdAt">): ReviewHistoryEntry {
  const full: ReviewHistoryEntry = { ...entry, createdAt: new Date().toISOString() };
  try {
    const next = [...readAll(), full].slice(-MAX_ENTRIES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // History is a nicety: the review itself already succeeded server-side.
  }
  return full;
}
