// El estado editable del workspace vive aquí, por encima de las pestañas
// desmontables: cambiar de sección ya no pierde la edición (UX-01, UX-02).

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  contextKey,
  defaultDrafts,
  loadDraftStore,
  saveDraftStore,
  type CompanyDraft,
  type ContextDrafts,
  type DraftContext,
  type PersistResult,
  type PricingDraft,
  type ReportDraft,
  type ReviewDraft,
} from "../../lib/draftStore";

export type DurableError = Exclude<PersistResult, "ok">;

interface StoreApi {
  store: Record<string, ContextDrafts>;
  setStore: React.Dispatch<React.SetStateAction<Record<string, ContextDrafts>>>;
  durableError: DurableError | null;
  retryPersist: () => void;
}

const DraftsContext = createContext<StoreApi | null>(null);

export function WorkspaceDraftsProvider({ children }: { children: React.ReactNode }) {
  const [store, setStoreState] = useState<Record<string, ContextDrafts>>(loadDraftStore);
  // R04: a failed persist shows once and stays until a persist succeeds.
  // Primitive state bails out on repeats: no write/announce loop.
  const [durableError, setDurableError] = useState<DurableError | null>(null);
  // Persist runs inside the update (never in an effect): one write per
  // edit, and the ref mirror keeps back-to-back updates exact.
  const storeRef = useRef(store);
  const setStore: React.Dispatch<React.SetStateAction<Record<string, ContextDrafts>>> = useCallback(
    (action) => {
      const prev = storeRef.current;
      const next = typeof action === "function" ? action(prev) : action;
      storeRef.current = next;
      const result = saveDraftStore(next);
      setDurableError(result === "ok" ? null : result);
      setStoreState(next);
    },
    []
  );
  const retryPersist = useCallback(() => {
    const result = saveDraftStore(storeRef.current);
    setDurableError(result === "ok" ? null : result);
  }, []);
  const api = useMemo(
    () => ({ store, setStore, durableError, retryPersist }),
    [store, setStore, durableError, retryPersist]
  );
  return <DraftsContext.Provider value={api}>{children}</DraftsContext.Provider>;
}

/** Visible, stable warning while drafts live only in memory (R04). */
export function DraftDurableBanner() {
  const api = useContext(DraftsContext);
  const reason = api?.durableError ?? null;
  if (reason === null) return null;
  return (
    <div
      role="alert"
      data-testid="draft-durable-error"
      className="rounded-lg border border-alert bg-warn-bg p-3 text-sm"
    >
      <p className="font-semibold">Tu borrador no se guardó en este navegador.</p>
      <p className="mt-1">
        {reason === "quota"
          ? "El almacenamiento está lleno o bloqueado. "
          : "El navegador no deja guardar. "}
        Sigue en memoria: no recargues ni cierres esta pestaña.
      </p>
      <button
        type="button"
        onClick={() => api?.retryPersist()}
        className="pressable mt-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-primary bg-white px-4 py-2 font-semibold text-primary hover:bg-primary-soft"
      >
        Reintentar guardado
      </button>
    </div>
  );
}

export interface WorkspaceDrafts {
  drafts: ContextDrafts;
  updatePricing: (patch: Partial<PricingDraft>) => void;
  updateReport: (patch: Partial<ReportDraft>) => void;
  updateCompany: (patch: Partial<CompanyDraft>) => void;
  updateReview: (patch: Partial<ReviewDraft>) => void;
}

export function useWorkspaceDrafts(ctx: DraftContext): WorkspaceDrafts {
  const api = useContext(DraftsContext);
  if (!api) throw new Error("useWorkspaceDrafts needs WorkspaceDraftsProvider");
  const key = contextKey(ctx);
  const drafts = api.store[key] ?? defaultDrafts();
  const updatePricing = useCallback(
    (patch: Partial<PricingDraft>) => {
      api.setStore((prev) => {
        const current = prev[key] ?? defaultDrafts();
        return { ...prev, [key]: { ...current, pricing: { ...current.pricing, ...patch } } };
      });
    },
    [api, key]
  );
  const updateReport = useCallback(
    (patch: Partial<ReportDraft>) => {
      api.setStore((prev) => {
        const current = prev[key] ?? defaultDrafts();
        return { ...prev, [key]: { ...current, report: { ...current.report, ...patch } } };
      });
    },
    [api, key]
  );
  const updateCompany = useCallback(
    (patch: Partial<CompanyDraft>) => {
      api.setStore((prev) => {
        const current = prev[key] ?? defaultDrafts();
        return { ...prev, [key]: { ...current, company: { ...current.company, ...patch } } };
      });
    },
    [api, key]
  );
  const updateReview = useCallback(
    (patch: Partial<ReviewDraft>) => {
      api.setStore((prev) => {
        const current = prev[key] ?? defaultDrafts();
        return { ...prev, [key]: { ...current, review: { ...current.review, ...patch } } };
      });
    },
    [api, key]
  );
  return { drafts, updatePricing, updateReport, updateCompany, updateReview };
}
