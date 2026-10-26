// Estado del Pricing Lab: hipótesis, validación, evaluación (LatestOnly) y guardado.
// Toda cifra viaja como cadena del backend; aquí no hay aritmética.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluateScenario,
  getCompany,
  isAbort,
  saveScenario,
  type Citation,
  type EvaluationRequest,
  type EvaluationResult,
  type MetadataEvidence,
  type Workspace,
} from "../../api/client";
import type { EvidenceTarget } from "../evidence/EvidenceDrawer";
import { errorCode, errorEs } from "../../lib/errors";
import { discountPercentToRate } from "../../lib/format";
import { LatestOnly } from "../../lib/requestSequence";
import { loadSession, rememberScenario, type StoredSession } from "../../lib/session";
import {
  discountPercentSchema,
  rivalPriceSchema,
  scenarioNameSchema,
} from "../../lib/validation";
import { citationsByIds, metadataForKey } from "./sources";

export interface Hypotheses {
  discountPct: number;
  rivalAPrice: string;
  rivalAGroup: string;
  rivalBPrice: string;
  rivalBGroup: string;
  ownGroup: string;
  complete: boolean;
  groupsConfirmed: boolean;
  noRivals: boolean;
  rivalState: "assumed" | "unspecified";
}

export const DEFAULTS: Hypotheses = {
  discountPct: 5,
  rivalAPrice: "106502.40",
  rivalAGroup: "a",
  rivalBPrice: "110052.48",
  rivalBGroup: "b",
  ownGroup: "own",
  complete: true,
  groupsConfirmed: true,
  noRivals: false,
  rivalState: "assumed",
};

export type PricingScope = Workspace["tender"]["scopes"][number];
export type PricingRule = Workspace["pricing_rules"][number];

const CURVE_POINTS = 41;

export interface PricingState {
  session: StoredSession | null;
  scope: PricingScope | null;
  rule: PricingRule | null;
  companyId: string | null;
  h: Hypotheses;
  setField: <K extends keyof Hypotheses>(key: K, value: Hypotheses[K]) => void;
  fieldErrors: Record<string, string>;
  inputsValid: boolean;
  requestInput: EvaluationRequest | null;
  result: EvaluationResult | null;
  pending: boolean;
  error: string | null;
  rawError: string | null;
  requestCount: number;
  companyName: string | undefined;
  companySynthetic: boolean | undefined;
  companyRevision: number | undefined;
  ruleCitations: Citation[];
  anomalyCitations: Citation[];
  basisCitations: Citation[];
  pblMeta: MetadataEvidence | null;
  evidence: EvidenceTarget | null;
  openEvidence: (citation: Citation) => void;
  closeEvidence: () => void;
  scenarioName: string;
  setScenarioName: (name: string) => void;
  saveState: { id: string; hash: string } | null;
  saveError: string | null;
  saveRawError: string | null;
  saving: boolean;
  handleSave: () => Promise<void>;
}

export function usePricingState(workspace: Workspace): PricingState {
  const session = loadSession();
  const scope = workspace.tender.scopes[0] ?? null;
  const rule = workspace.pricing_rules[0] ?? null;
  const companyId = session?.company_id ?? null;

  const [h, setH] = useState<Hypotheses>(DEFAULTS);
  const [fetched, setFetched] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [scenarioName, setScenarioName] = useState("Base 5 %");
  const [saveState, setSaveState] = useState<{ id: string; hash: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveRawError, setSaveRawError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);
  const latestRef = useRef(new LatestOnly());
  const seqRef = useRef(0);

  const ruleCitations = citationsByIds(workspace, rule?.evidence_ids ?? []);
  const anomalyCitations = citationsByIds(workspace, rule?.anomaly_policy.evidence_ids ?? []);
  const basisCitations = citationsByIds(workspace, scope?.basis.evidence_ids ?? []);
  const pblMeta = metadataForKey(workspace.tender, "pbl_net");

  function openEvidence(citation: Citation) {
    setEvidence({ citation });
  }

  function closeEvidence() {
    setEvidence(null);
  }

  const companyQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: ({ signal }) => getCompany(companyId ?? "", signal),
    enabled: companyId !== null,
  });
  const companyRevision = companyQuery.data?.revision;

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const discount = discountPercentSchema.safeParse(h.discountPct);
    if (!discount.success) errors.discount = discount.error.issues[0]?.message ?? "Baja no válida";
    if (!h.noRivals) {
      const a = rivalPriceSchema.safeParse(h.rivalAPrice);
      if (!a.success) errors.rivalA = a.error.issues[0]?.message ?? "Precio A no válido";
      const b = rivalPriceSchema.safeParse(h.rivalBPrice);
      if (!b.success) errors.rivalB = b.error.issues[0]?.message ?? "Precio B no válido";
    }
    return errors;
  }, [h]);
  const inputsValid = Object.keys(fieldErrors).length === 0;

  const requestInput: EvaluationRequest | null =
    scope && rule && companyId && companyRevision !== undefined
      ? {
          scope_id: scope.id,
          pricing_rule_id: rule.id,
          pricing_rule_revision: rule.revision,
          company_id: companyId,
          company_revision: companyRevision,
          discount_rate: discountPercentToRate(h.discountPct),
          rivals: h.noRivals
            ? { state: "unspecified", complete: false, group_membership_confirmed: false, own_group_id: null, offers: [] }
            : {
                state: h.rivalState,
                complete: h.complete,
                group_membership_confirmed: h.groupsConfirmed,
                own_group_id: h.ownGroup || null,
                offers: [
                  { label: "Hipótesis A", price_net: h.rivalAPrice, group_id: h.rivalAGroup || null },
                  { label: "Hipótesis B", price_net: h.rivalBPrice, group_id: h.rivalBGroup || null },
                ],
              },
          curve: { from_discount_rate: "0.0000", to_discount_rate: "0.4000", points: CURVE_POINTS },
        }
      : null;

  // requestInput is rebuilt every render; stringify once to depend on values only.
  const requestKey = JSON.stringify(requestInput);
  const ruleReviewStatus = rule?.review_status;
  // C4: invalid input hides the last fetch instead of showing stale figures.
  const result = inputsValid && requestInput !== null ? fetched : null;
  useEffect(() => {
    if (!requestInput || !inputsValid || ruleReviewStatus !== "approved") {
      return;
    }
    const payload = requestInput;
    const timer = window.setTimeout(() => {
      const seq = ++seqRef.current;
      setPending(true);
      setError(null);
      setRawError(null);
      setRequestCount((c) => c + 1);
      void evaluateScenario(payload, latestRef.current.signal())
        .then((res) => {
          if (seqRef.current !== seq) return; // stale response: never paint it
          setFetched(res);
        })
        .catch((err: unknown) => {
          if (isAbort(err)) return;
          if (seqRef.current !== seq) return;
          setFetched(null);
          setError(errorEs(err, "No se pudo evaluar. Reintenta cuando la API local responda."));
          setRawError(errorCode(err));
        })
        .finally(() => {
          if (seqRef.current === seq) setPending(false);
        });
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey is the value-stable form of requestInput.
  }, [requestKey, inputsValid, ruleReviewStatus]);

  useEffect(() => () => latestRef.current.abort(), []);

  async function handleSave() {
    setSaveError(null);
    setSaveRawError(null);
    setSaveState(null);
    const name = scenarioNameSchema.safeParse(scenarioName);
    if (!name.success) {
      setSaveError(name.error.issues[0]?.message ?? "Nombre no válido");
      return;
    }
    if (!requestInput) {
      setSaveError("Faltan identificadores para guardar (sesión, regla o empresa).");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveScenario(name.data, requestInput);
      rememberScenario(saved.id, name.data);
      setSaveState({ id: saved.id, hash: saved.snapshot_sha256 });
    } catch (err) {
      setSaveError(errorEs(err, "No se pudo guardar. Reintenta cuando la API local responda."));
      setSaveRawError(errorCode(err));
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof Hypotheses>(key: K, value: Hypotheses[K]) {
    setH((prev) => ({ ...prev, [key]: value }));
  }

  return {
    session,
    scope,
    rule,
    companyId,
    h,
    setField,
    fieldErrors,
    inputsValid,
    requestInput,
    result,
    pending,
    error,
    rawError,
    requestCount,
    companyName: companyQuery.data?.name,
    companySynthetic: companyQuery.data?.synthetic,
    companyRevision,
    ruleCitations,
    anomalyCitations,
    basisCitations,
    pblMeta,
    evidence,
    openEvidence,
    closeEvidence,
    scenarioName,
    setScenarioName,
    saveState,
    saveError,
    saveRawError,
    saving,
    handleSave,
  };
}
