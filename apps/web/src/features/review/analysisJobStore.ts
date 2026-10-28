// Seguimiento del análisis (T09): el último análisis pedido por
// licitación sobrevive a recargar. Solo guarda el id del trabajo; el
// estado se relee del servidor (GET) y nunca se repite la petición
// (POST). Sin secretos: el id no autoriza nada por sí solo.

const STORAGE_KEY = "bidlab.analysis.v1";
const STORE_VERSION = 1;
const MAX_ID_LENGTH = 200;

export interface TrackedRun {
  jobId: string;
  location: string | null;
}

export type TrackedMap = Record<string, TrackedRun>;

/** Pura para unit tests: parseo sin tocar localStorage. */
export function parseTrackedAnalysis(raw: string | null): TrackedMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    const root = parsed as Record<string, unknown>;
    if (root.version !== STORE_VERSION || root.jobs === null || typeof root.jobs !== "object") {
      return {};
    }
    const out: TrackedMap = {};
    for (const [key, value] of Object.entries(root.jobs as Record<string, unknown>)) {
      if (typeof key !== "string" || key.length === 0 || key.length > MAX_ID_LENGTH) continue;
      if (value === null || typeof value !== "object") continue;
      const run = value as Record<string, unknown>;
      if (typeof run.jobId !== "string" || run.jobId.length === 0 || run.jobId.length > MAX_ID_LENGTH) {
        continue;
      }
      const location = run.location ?? null;
      if (location !== null && (typeof location !== "string" || location.length > MAX_ID_LENGTH)) {
        continue;
      }
      out[key] = { jobId: run.jobId, location };
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeTrackedAnalysis(jobs: TrackedMap): string {
  return JSON.stringify({ version: STORE_VERSION, jobs });
}

function storageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

export function loadTrackedAnalysis(tenderId: string): TrackedRun | null {
  if (!storageAvailable()) return null;
  try {
    return parseTrackedAnalysis(localStorage.getItem(STORAGE_KEY))[tenderId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Guarda el trabajo seguido. Devuelve false si el navegador no deja
 * persistir (modo privado, cuota): el análisis sigue en el servidor,
 * pero recargar perderá el seguimiento.
 */
export function saveTrackedAnalysis(tenderId: string, run: TrackedRun): boolean {
  if (!storageAvailable()) return false;
  try {
    const jobs = parseTrackedAnalysis(localStorage.getItem(STORAGE_KEY));
    jobs[tenderId] = run;
    localStorage.setItem(STORAGE_KEY, serializeTrackedAnalysis(jobs));
    return true;
  } catch {
    return false;
  }
}

export function clearTrackedAnalysis(tenderId: string): void {
  if (!storageAvailable()) return;
  try {
    const jobs = parseTrackedAnalysis(localStorage.getItem(STORAGE_KEY));
    delete jobs[tenderId];
    localStorage.setItem(STORAGE_KEY, serializeTrackedAnalysis(jobs));
  } catch {
    // Best effort: un resto huérfano solo provoca un GET de más.
  }
}
