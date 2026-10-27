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
import { discountPercentToRate, parsePrecioInput } from "../../lib/format";
import { LatestOnly } from "../../lib/requestSequence";
import { loadSession, type StoredSession } from "../../lib/session";
import { stableKey, type SavedCopy } from "../../lib/draftStore";
import {
  discountPercentSchema,
  rivalPriceSchema,
  scenarioNameSchema,
} from "../../lib/validation";
import { useWorkspaceDrafts } from "../workspace/WorkspaceDrafts";
import { citationsByIds, metadataForKey } from "./sources";
import type { Hypotheses } from "./hypotheses";

export type { Hypotheses } from "./hypotheses";

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
  /** Canonical identity of the current inputs; the painted result belongs to resultKey. */
  inputKey: string | null;
  result: EvaluationResult | null;
  /** True while the painted result belongs to older inputs (UX-04). */
  resultStale: boolean;
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
  saveState: SavedCopy | null;
  /** False once you edit after saving: the copy stays, the draft moved (UX-03). */
  saveIsCurrent: boolean;
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

  // Editable state lives in the workspace drafts store (above the tabs),
  // so switching sections never loses it (UX-01). Figures stay server-side.
  const { drafts, updatePricing } = useWorkspaceDrafts({
    tenderId: workspace.tender.id,
    scopeId: scope?.id ?? "none",
    companyId: companyId ?? "none",
  });
  const h = drafts.pricing.h;
  const scenarioName = drafts.pricing.scenarioName;
  const saveState = drafts.pricing.savedCopy;
  const [fetched, setFetched] = useState<EvaluationResult | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
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

  // Spanish users write "106502,40"; the protocol wants "106502.40".
  // Normalize once here so validation and the request share the same value.
  const rivalANorm = h.noRivals ? "0.00" : parsePrecioInput(h.rivalAPrice);
  const rivalBNorm = h.noRivals ? "0.00" : parsePrecioInput(h.rivalBPrice);

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const discount = discountPercentSchema.safeParse(h.discountPct);
    if (!discount.success) errors.discount = "La rebaja va de 0 % a 40 %.";
    if (!h.noRivals) {
      const a = rivalANorm === null ? null : rivalPriceSchema.safeParse(rivalANorm);
      if (!a?.success) errors.rivalA = "Escribe el precio con dos decimales (como 1234,56).";
      const b = rivalBNorm === null ? null : rivalPriceSchema.safeParse(rivalBNorm);
      if (!b?.success) errors.rivalB = "Escribe el precio con dos decimales (como 1234,56).";
    }
    return errors;
  }, [h, rivalANorm, rivalBNorm]);
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
                  { label: "Rival A", price_net: rivalANorm ?? h.rivalAPrice, group_id: h.rivalAGroup || null },
                  { label: "Rival B", price_net: rivalBNorm ?? h.rivalBPrice, group_id: h.rivalBGroup || null },
                ],
              },
          curve: { from_discount_rate: "0.0000", to_discount_rate: "0.4000", points: CURVE_POINTS },
        }
      : null;

  // requestInput is rebuilt every render; its canonical key is the
  // value-stable identity (UX-04: key order must not change it).
  const inputKey = requestInput ? stableKey(requestInput) : null;
  const ruleReviewStatus = rule?.review_status;
  // C4: invalid input hides the last fetch instead of showing stale figures.
  const result = inputsValid && requestInput !== null ? fetched : null;
  // Stale the moment inputs change, even during the debounce (UX-04).
  const resultStale = result !== null && inputKey !== null && resultKey !== inputKey;
  useEffect(() => {
    if (!requestInput || !inputsValid || ruleReviewStatus !== "approved") {
      return;
    }
    const payload = requestInput;
    const payloadKey = stableKey(payload);
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
          setResultKey(payloadKey);
        })
        .catch((err: unknown) => {
          if (isAbort(err)) return;
          if (seqRef.current !== seq) return;
          setFetched(null);
          setResultKey(null);
          setError(errorEs(err, "No pudimos evaluar tu oferta. Vuelve a intentarlo en unos segundos."));
          setRawError(errorCode(err));
        })
        .finally(() => {
          if (seqRef.current === seq) setPending(false);
        });
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inputKey is the value-stable form of requestInput.
  }, [inputKey, inputsValid, ruleReviewStatus]);

  useEffect(() => () => latestRef.current.abort(), []);

  async function handleSave() {
    setSaveError(null);
    setSaveRawError(null);
    updatePricing({ savedCopy: null });
    const name = scenarioNameSchema.safeParse(scenarioName);
    if (!name.success) {
      setSaveError(name.error.issues[0]?.message ?? "Nombre no válido");
      return;
    }
    if (!requestInput || !inputKey) {
      setSaveError("Te faltan datos para guardar (sesión, regla o empresa).");
      return;
    }
    // Freeze what we send: edits during the flight stay in the draft,
    // and the copy keeps the key of its own inputs (UX-03).
    const payload = requestInput;
    const payloadKey = inputKey;
    setSaving(true);
    try {
      const saved = await saveScenario(name.data, payload);
      updatePricing({
        savedCopy: { id: saved.id, hash: saved.snapshot_sha256, name: name.data, inputKey: payloadKey },
      });
    } catch (err) {
      setSaveError(errorEs(err, "No pudimos guardar tu prueba. Vuelve a intentarlo en unos segundos."));
      setSaveRawError(errorCode(err));
    } finally {
      setSaving(false);
    }
  }

  const saveIsCurrent = saveState !== null && inputKey !== null && saveState.inputKey === inputKey;

  function setField<K extends keyof Hypotheses>(key: K, value: Hypotheses[K]) {
    updatePricing({ h: { ...h, [key]: value } });
  }

  function setScenarioName(name: string) {
    updatePricing({ scenarioName: name });
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
    inputKey,
    result,
    resultStale,
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
    saveIsCurrent,
    saveError,
    saveRawError,
    saving,
    handleSave,
  };
}
