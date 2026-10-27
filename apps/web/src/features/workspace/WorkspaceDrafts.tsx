// El estado editable del workspace vive aquí, por encima de las pestañas
// desmontables: cambiar de sección ya no pierde la edición (UX-01, UX-02).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  contextKey,
  defaultDrafts,
  loadDraftStore,
  saveDraftStore,
  type CompanyDraft,
  type ContextDrafts,
  type DraftContext,
  type PricingDraft,
  type ReportDraft,
} from "../../lib/draftStore";

interface StoreApi {
  store: Record<string, ContextDrafts>;
  setStore: React.Dispatch<React.SetStateAction<Record<string, ContextDrafts>>>;
}

const DraftsContext = createContext<StoreApi | null>(null);

export function WorkspaceDraftsProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Record<string, ContextDrafts>>(loadDraftStore);
  useEffect(() => {
    saveDraftStore(store);
  }, [store]);
  const api = useMemo(() => ({ store, setStore }), [store]);
  return <DraftsContext.Provider value={api}>{children}</DraftsContext.Provider>;
}

export interface WorkspaceDrafts {
  drafts: ContextDrafts;
  updatePricing: (patch: Partial<PricingDraft>) => void;
  updateReport: (patch: Partial<ReportDraft>) => void;
  updateCompany: (patch: Partial<CompanyDraft>) => void;
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
  return { drafts, updatePricing, updateReport, updateCompany };
}
