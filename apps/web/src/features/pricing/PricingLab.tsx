import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ApiError,
  evaluateScenario,
  getCompany,
  isAbort,
  saveScenario,
  type Citation,
  type EvaluationRequest,
  type EvaluationResult,
  type Workspace,
} from "../../api/client";
import {
  discountPercentToRate,
  formatEUR,
  formatPoints,
  formatRate,
  formatSignedEUR,
} from "../../lib/format";
import { LatestOnly } from "../../lib/requestSequence";
import { loadSession, rememberScenario } from "../../lib/session";
import {
  DISCOUNT_MAX,
  DISCOUNT_MIN,
  DISCOUNT_STEP,
  discountPercentSchema,
  rivalPriceSchema,
  scenarioNameSchema,
} from "../../lib/validation";
import { CurveChart } from "./CurveChart";
import { SourceCitations } from "./SourceCitations";
import { EvidenceDrawer, type EvidenceTarget } from "../evidence/EvidenceDrawer";
import {
  anomalyEs,
  branchEs,
  citationsByIds,
  hashOrigin,
  metadataForKey,
  reasonEs,
  variableEs,
} from "./sources";

export { anomalyEs };

interface Props {
  workspace: Workspace;
}

const CURVE_POINTS = 41;

/** Protocol decimal -> es-ES display. Money gets €, long decimals get comma separators. */
function formatProtocol(value: string): string {
  if (/^\d{1,12}\.\d{2}$/.test(value)) return formatEUR(value);
  if (/^-?\d{1,12}\.\d{2}$/.test(value)) return formatSignedEUR(value);
  const n = Number(value);
  if (Number.isFinite(n)) {
    return n.toLocaleString("es-ES", { maximumFractionDigits: 12 });
  }
  return value;
}

interface Hypotheses {
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

const DEFAULTS: Hypotheses = {
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

export function PricingLab({ workspace }: Props) {
  const session = loadSession();
  const scope = workspace.tender.scopes[0] ?? null;
  const rule = workspace.pricing_rules[0] ?? null;
  const companyId = session?.company_id ?? null;

  const [h, setH] = useState<Hypotheses>(DEFAULTS);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [scenarioName, setScenarioName] = useState("Base 5 %");
  const [saveState, setSaveState] = useState<{ id: string; hash: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!requestInput || !inputsValid) return;
    if (rule?.review_status !== "approved") return;
    const payload = requestInput;
    const timer = window.setTimeout(() => {
      const seq = ++seqRef.current;
      setPending(true);
      setError(null);
      setRequestCount((c) => c + 1);
      void evaluateScenario(payload, latestRef.current.signal())
        .then((res) => {
          if (seqRef.current !== seq) return; // stale response: never paint it
          setResult(res);
        })
        .catch((err: unknown) => {
          if (isAbort(err)) return;
          if (seqRef.current !== seq) return;
          setError(err instanceof ApiError ? `${err.code}: ${err.message}` : "No se pudo evaluar");
        })
        .finally(() => {
          if (seqRef.current === seq) setPending(false);
        });
    }, 150);
    return () => window.clearTimeout(timer);
    // requestInput is rebuilt every render; stringify to depend on values only.
  }, [JSON.stringify(requestInput), inputsValid, rule?.review_status]);

  useEffect(() => () => latestRef.current.abort(), []);

  async function handleSave() {
    setSaveError(null);
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
      rememberScenario(saved.id);
      setSaveState({ id: saved.id, hash: saved.snapshot_sha256 });
    } catch (err) {
      setSaveError(err instanceof ApiError ? `${err.code}: ${err.message}` : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof Hypotheses>(key: K, value: Hypotheses[K]) {
    setH((prev) => ({ ...prev, [key]: value }));
  }

  if (!session || !companyId) {
    return (
      <p role="status" className="rounded-xl bg-white p-4 shadow-sm">
        Carga el ejemplo desde la biblioteca para simular con la empresa demo.
      </p>
    );
  }
  if (!scope || !rule) {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 shadow-sm">
        Esta licitación no tiene scope o regla de precio. No hay nada que simular.
      </p>
    );
  }
  if (rule.review_status !== "approved") {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 shadow-sm">
        Regla {rule.id} en estado {rule.review_status}: bloquea la puntuación hasta su revisión. No se
        evalúa.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <section
        aria-label="Indicadores"
        aria-live="polite"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-[#3A4560]">Precio neto de oferta</h2>
          <p data-testid="price-net" className="tnum text-2xl font-bold">
            {result ? formatEUR(result.price_net) : "—"}
          </p>
          <p className="mt-1 text-xs text-[#3A4560]">
            Calculado · {result ? `baja ${formatRate(discountPercentToRate(h.discountPct))}` : "pendiente"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#3A4560]">
            <span>
              Fuente: PBL neto {workspace.tender.pbl_net ? formatEUR(workspace.tender.pbl_net) : "—"}
              {pblMeta ? (
                <>
                  {" · "}
                  <a
                    href={pblMeta.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#3159D9] underline"
                  >
                    Fuente oficial (Atom)
                  </a>
                </>
              ) : null}
            </span>
            <SourceCitations citations={basisCitations} onSelect={openEvidence} emptyText="" />
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-[#3A4560]">Beneficio / margen</h2>
          <p data-testid="profit-net" className="tnum text-2xl font-bold">
            {result?.profit_net ? formatSignedEUR(result.profit_net) : "—"}
          </p>
          <p className="mt-1 text-xs text-[#3A4560]">
            {result?.margin_rate ? `Margen ${formatRate(result.margin_rate)}` : "Margen —"} · coste{" "}
            {result?.cost_net ? formatEUR(result.cost_net) : "—"} (empresa sintética)
          </p>
          <p className="mt-1 text-xs text-[#3A4560]">
            Fuente: coste de empresa sintética
            {companyQuery.data?.name ? ` «${companyQuery.data.name}»` : ""} (hipótesis declarada, sin
            cita documental).
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-[#3A4560]">Puntos de precio bajo este escenario</h2>
          <p data-testid="economic-score" className="tnum text-2xl font-bold">
            {result
              ? result.score.status === "defined" && result.score.value !== null
                ? `${formatPoints(result.score.value)} / ${formatPoints(result.score.max_points)}`
                : `Sin determinar (${result.score.status})`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-[#3A4560]">
            {result
              ? result.score.status === "defined"
                ? `Mejor oferta incluyendo la propia · máx. ${result.score.max_points}`
                : `${result.score.reason_codes.map(reasonEs).join("; ") || "sin motivo"} · faltan: ${result.score.unknown_variables.map(variableEs).join(", ") || "—"}`
              : "pendiente"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#3A4560]">
            <span>
              Fuente: regla {rule.template_id} · {rule.max_points} puntos (PCAP p. 10):{" "}
            </span>
            <SourceCitations citations={ruleCitations} onSelect={openEvidence} />
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-[#3A4560]">Presunción de anormalidad</h2>
          <p data-testid="anomaly-status" className="text-2xl font-bold">
            {result ? anomalyEs(result.anomaly.status) : "—"}
          </p>
          <p data-testid="anomaly-detail" className="tnum mt-1 text-xs text-[#3A4560]">
            {result
              ? result.anomaly.status === "unknown" || result.anomaly.status === "not_applicable"
                ? `${result.anomaly.policy_id} · ${result.anomaly.reason_codes.map(reasonEs).join("; ") || "sin motivo"}`
                : `${result.anomaly.policy_id} · rama ${branchEs(result.anomaly.branch)} · ` +
                  `media ${result.anomaly.reference_mean_net ? formatProtocol(result.anomaly.reference_mean_net) : "—"} · ` +
                  `umbral ${result.anomaly.threshold_net ? formatProtocol(result.anomaly.threshold_net) : "—"} · ` +
                  `${result.anomaly.reference_offer_count} ofertas de referencia`
              : "pendiente"}
          </p>
          <p className="mt-1 text-xs text-[#3A4560]">
            {result
              ? `Presunción condicional, no exclusión automática${result.anomaly.branch ? ` · rama ${result.anomaly.branch}` : ""}`
              : "pendiente"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#3A4560]">
            <span>Fuente: política {rule.anomaly_policy.variant} (PCAP p. 20): </span>
            <SourceCitations citations={anomalyCitations} onSelect={openEvidence} />
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid min-w-0 gap-4 lg:col-span-8 [&>*]:min-w-0">
          <section aria-label="Baja propia" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Baja propia sobre PBL neto</h2>
            <div className="mt-3 grid items-end gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Baja (%)</span>
                <input
                  type="number"
                  data-testid="discount-input"
                  min={DISCOUNT_MIN}
                  max={DISCOUNT_MAX}
                  step={DISCOUNT_STEP}
                  value={h.discountPct}
                  onChange={(e) => set("discountPct", Number(e.target.value))}
                  className="tnum mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Deslizador de baja (teclado: ← →)</span>
                <input
                  type="range"
                  data-testid="discount-slider"
                  aria-label="Deslizador de baja en tanto por ciento"
                  min={DISCOUNT_MIN}
                  max={DISCOUNT_MAX}
                  step={DISCOUNT_STEP}
                  value={h.discountPct}
                  onChange={(e) => set("discountPct", Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            </div>
            {fieldErrors.discount && (
              <p role="alert" className="mt-2 text-sm text-[#B42318]">
                {fieldErrors.discount}
              </p>
            )}
            <p className="mt-2 text-xs text-[#3A4560]">
              Límites de interfaz (0–40 %); no son umbrales legales.{" "}
              {pending ? (
                <span data-testid="updating" role="status">
                  Actualizando…
                </span>
              ) : (
                <span data-testid="request-count" className="tnum">
                  Petición n.º {requestCount}
                </span>
              )}
            </p>
            {error && (
              <p role="alert" className="mt-2 rounded-lg border border-[#B42318] p-3 text-sm text-[#B42318]">
                {error}
              </p>
            )}
          </section>

          <section aria-label="Curva precio-puntos" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Curva precio-puntos</h2>
            {!result && <p className="mt-2 text-sm">Pendiente de cálculo.</p>}
            {result && <CurveChart curve={result.curve} />}
            {result && (
              <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-[#3A4560]">
                <span>
                  Curva del backend con rivales fijos ({result.curve.length} puntos); la propia
                  oferta entra en cada punto. Fuente de la fórmula:{" "}
                </span>
                <SourceCitations citations={ruleCitations} onSelect={openEvidence} />
              </p>
            )}
          </section>

          <section aria-label="Cálculo" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Ver cálculo</h2>
            {!result && <p className="mt-2 text-sm">Pendiente de cálculo.</p>}
            {result && (
              <div data-testid="calculation-trace" className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <caption className="sr-only">
                    Pasos de cálculo devueltos por el backend: precio, mejor oferta, puntuación,
                    anormalidad y margen
                  </caption>
                  <thead>
                    <tr className="text-left">
                      <th scope="col" className="border-b border-[#C9D2E8] p-2">Paso</th>
                      <th scope="col" className="border-b border-[#C9D2E8] p-2">Expresión</th>
                      <th scope="col" className="border-b border-[#C9D2E8] p-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trace.map((step) => (
                      <tr key={step.label}>
                        <td className="border-b border-[#E5E9F2] p-2 font-medium">{step.label}</td>
                        <td className="border-b border-[#E5E9F2] p-2">
                          <code className="tnum break-all text-xs">{step.expression}</code>
                        </td>
                        <td className="tnum border-b border-[#E5E9F2] p-2">
                          {step.value === null ? "unknown" : formatProtocol(step.value)}{" "}
                          {step.value !== null && (
                            <code className="block text-xs text-[#3A4560]">{step.value}</code>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="tnum mt-2 text-xs text-[#3A4560]">
                  Regla {result.pricing_rule_id} rev. {result.pricing_rule_revision} · motor{" "}
                  {result.engine_version} · empresa rev. {result.company_revision}
                </p>
                <div data-testid="source-hashes" className="mt-3">
                  <h3 className="text-sm font-semibold">
                    Huellas de fuente ({result.source_hashes.length})
                  </h3>
                  {result.source_hashes.length === 0 && (
                    <p className="mt-1 text-xs text-[#3A4560]">
                      El backend no devolvió huellas de fuente.
                    </p>
                  )}
                  <ul className="mt-1 space-y-1 text-xs">
                    {result.source_hashes.map((hash) => (
                      <li key={hash} className="tnum break-all">
                        <code title={hash}>{hash.slice(0, 16)}…</code>{" "}
                        <span className="text-[#3A4560]">· {hashOrigin(workspace, hash).label}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#3A4560]">
                    <span>Fuentes de la regla y la política: </span>
                    <SourceCitations
                      citations={[...ruleCitations, ...anomalyCitations]}
                      onSelect={openEvidence}
                    />
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="grid min-w-0 content-start gap-4 lg:col-span-4">
          <section aria-label="Hipótesis de rivales" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Hipótesis de rivales</h2>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={h.noRivals}
                onChange={(e) => set("noRivals", e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Sin escenario rival</strong> (puntuación unknown; precio y margen siguen
                disponibles)
              </span>
            </label>
            <fieldset disabled={h.noRivals} className="mt-3 grid gap-3 disabled:opacity-50">
              <legend className="sr-only">Precios rivales hipotéticos</legend>
              <label className="block text-sm">
                <span className="font-medium">Hipótesis A · precio neto (€, formato 1234.56)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid="rival-a-price"
                  value={h.rivalAPrice}
                  onChange={(e) => set("rivalAPrice", e.target.value)}
                  className="tnum mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
                />
              </label>
              {fieldErrors.rivalA && (
                <p role="alert" className="text-sm text-[#B42318]">
                  {fieldErrors.rivalA}
                </p>
              )}
              <label className="block text-sm">
                <span className="font-medium">Hipótesis A · grupo supuesto</span>
                <input
                  type="text"
                  data-testid="rival-a-group"
                  value={h.rivalAGroup}
                  onChange={(e) => set("rivalAGroup", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Hipótesis B · precio neto (€, formato 1234.56)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid="rival-b-price"
                  value={h.rivalBPrice}
                  onChange={(e) => set("rivalBPrice", e.target.value)}
                  className="tnum mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
                />
              </label>
              {fieldErrors.rivalB && (
                <p role="alert" className="text-sm text-[#B42318]">
                  {fieldErrors.rivalB}
                </p>
              )}
              <label className="block text-sm">
                <span className="font-medium">Hipótesis B · grupo supuesto</span>
                <input
                  type="text"
                  data-testid="rival-b-group"
                  value={h.rivalBGroup}
                  onChange={(e) => set("rivalBGroup", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Grupo propio supuesto</span>
                <input
                  type="text"
                  data-testid="own-group"
                  value={h.ownGroup}
                  onChange={(e) => set("ownGroup", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Calificación del conjunto</span>
                <select
                  data-testid="rival-state"
                  value={h.rivalState}
                  onChange={(e) => set("rivalState", e.target.value as Hypotheses["rivalState"])}
                  className="mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
                >
                  <option value="assumed">Supuesto (hipótesis declarada)</option>
                  <option value="unspecified">Sin calificar</option>
                </select>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid="rivals-complete"
                  checked={h.complete}
                  onChange={(e) => set("complete", e.target.checked)}
                  className="mt-1"
                />
                <span>Conjunto completo supuesto (sin marcar: puntuación unknown)</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid="groups-confirmed"
                  checked={h.groupsConfirmed}
                  onChange={(e) => set("groupsConfirmed", e.target.checked)}
                  className="mt-1"
                />
                <span>Grupos independientes supuestos (sin marcar: anormalidad unknown)</span>
              </label>
            </fieldset>
            <div
              data-testid="rival-completeness"
              role="status"
              className="mt-3 rounded-lg bg-[#F6F7FB] p-3 text-sm"
            >
              {!result && <p>Pendiente de cálculo.</p>}
              {result && (h.noRivals || !h.complete) && (
                <p>
                  <strong>Conjunto incompleto supuesto.</strong> Puntuación unknown
                  {result.score.unknown_variables.length > 0 &&
                    ` (faltan: ${result.score.unknown_variables.map(variableEs).join(", ")})`}
                  {result.score.reason_codes.length > 0 &&
                    ` — ${result.score.reason_codes.map(reasonEs).join("; ")}`}
                  . Anormalidad unknown también. Precio, beneficio y margen siguen disponibles.
                </p>
              )}
              {result && !h.noRivals && h.complete && (
                <p>
                  <strong>Conjunto completo supuesto</strong> (hipótesis declarada). La puntuación
                  usa todas las ofertas declaradas, propia incluida
                  {result.score.status !== "defined" &&
                    `, pero el backend responde ${result.score.status}: ${result.score.reason_codes.map(reasonEs).join("; ") || "sin motivo"}`}
                  .
                </p>
              )}
              {result && !h.noRivals && (
                <p className="mt-1">
                  {h.groupsConfirmed ? (
                    <>Grupos independientes supuestos: la anormalidad usa mínimos por grupo.</>
                  ) : (
                    <>
                      <strong>Pertenencia a grupos sin confirmar:</strong> anormalidad unknown
                      {result.anomaly.reason_codes.length > 0 &&
                        ` — ${result.anomaly.reason_codes.map(reasonEs).join("; ")}`}
                      ; la puntuación no depende de los grupos.
                    </>
                  )}
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-[#3A4560]">
              Sin las ofertas reales, estos escenarios son hipótesis declaradas. No se infiere ninguna
              distribución de rivales.
            </p>
          </section>

          <section
            aria-label="Referencias de anormalidad por grupo"
            className="rounded-xl bg-white p-4 shadow-sm sm:p-6"
          >
            <h2 className="text-lg font-semibold">Referencias por grupo</h2>
            {!result && <p className="mt-2 text-sm">Pendiente de cálculo.</p>}
            {result && (
              <div data-testid="group-references" className="mt-2 grid gap-3 text-sm">
                <div>
                  <h3 className="text-sm font-semibold">Agrupación declarada (tus supuestos)</h3>
                  <ul className="tnum mt-1 space-y-1 text-xs">
                    <li>Oferta propia · grupo «{h.ownGroup.trim() || "sin indicar"}»</li>
                    {h.noRivals ? (
                      <li>Sin escenario rival: no hay ofertas rivales declaradas.</li>
                    ) : (
                      <>
                        <li>
                          Hipótesis A · {h.rivalAPrice || "—"} € · grupo «
                          {h.rivalAGroup.trim() || "sin indicar"}»
                        </li>
                        <li>
                          Hipótesis B · {h.rivalBPrice || "—"} € · grupo «
                          {h.rivalBGroup.trim() || "sin indicar"}»
                        </li>
                      </>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Mínimos por grupo (responde el backend)</h3>
                  {result.anomaly.status === "unknown" ||
                  result.anomaly.status === "not_applicable" ? (
                    <p className="mt-1 text-xs text-[#3A4560]">
                      Referencias unknown:{" "}
                      {result.anomaly.reason_codes.map(reasonEs).join("; ") || "sin motivo"}.
                    </p>
                  ) : (
                    <dl className="tnum mt-1 grid gap-1 text-xs">
                      <div className="flex flex-wrap justify-between gap-x-4">
                        <dt className="text-[#3A4560]">Ofertas de referencia (mínimos por grupo)</dt>
                        <dd data-testid="reference-count" className="font-semibold">
                          {result.anomaly.reference_offer_count}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4">
                        <dt className="text-[#3A4560]">Media de referencia</dt>
                        <dd className="break-all font-semibold">
                          {result.anomaly.reference_mean_net
                            ? formatProtocol(result.anomaly.reference_mean_net)
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4">
                        <dt className="text-[#3A4560]">Umbral</dt>
                        <dd className="break-all font-semibold">
                          {result.anomaly.threshold_net
                            ? formatProtocol(result.anomaly.threshold_net)
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4">
                        <dt className="text-[#3A4560]">Rama aplicada</dt>
                        <dd className="font-semibold">
                          {branchEs(result.anomaly.branch)}
                          {result.anomaly.branch ? ` (${result.anomaly.branch})` : ""}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
                <p className="text-xs text-[#3A4560]">
                  El backend usa la oferta más baja de cada grupo confirmado (LCSP 149.3); dos
                  rivales del mismo grupo no son dos observaciones independientes. El scoring
                  conserva todas las ofertas declaradas.
                </p>
                <p className="flex flex-wrap items-center gap-1 text-xs text-[#3A4560]">
                  <span>Fuente de la política: </span>
                  <SourceCitations citations={anomalyCitations} onSelect={openEvidence} />
                </p>
              </div>
            )}
          </section>

          <section aria-label="Supuestos" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Supuestos declarados</h2>
            {!result && <p className="mt-2 text-sm">Pendiente de cálculo.</p>}
            {result && (
              <ul data-testid="assumptions" className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            {result && result.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-[#9A5B00]">
                {result.warnings.map((w) => (
                  <li key={w}>Aviso: {w}</li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Guardar escenario" className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Comparar escenarios</h2>
            <label className="mt-2 block text-sm">
              <span className="font-medium">Nombre del escenario</span>
              <input
                type="text"
                data-testid="scenario-name"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-[#C9D2E8] px-3 py-2"
              />
            </label>
            <button
              type="button"
              data-testid="save-scenario"
              onClick={handleSave}
              disabled={saving || !inputsValid}
              className="mt-3 rounded-lg bg-[#3159D9] px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar escenario"}
            </button>
            {saveError && (
              <p role="alert" className="mt-2 text-sm text-[#B42318]">
                {saveError}
              </p>
            )}
            {saveState && (
              <p role="status" className="tnum mt-2 break-all text-sm">
                Guardado: <code>{saveState.hash.slice(0, 16)}…</code>{" "}
                <Link
                  to={`/tenders/${workspace.tender.id}?tab=informe&scenario=${saveState.id}`}
                  className="text-[#3159D9] underline"
                >
                  Abrir en Informe
                </Link>
              </p>
            )}
          </section>

          <details className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
            <summary className="cursor-pointer font-semibold">Identificadores y códigos</summary>
            <dl className="tnum mt-2 grid gap-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt>Scope</dt>
                <dd>{scope.id}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Regla</dt>
                <dd>
                  {rule.id} rev. {rule.revision} ({rule.review_status})
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Empresa</dt>
                <dd>
                  {companyId} rev. {companyRevision ?? "…"}
                  {companyQuery.data?.synthetic ? " (sintética)" : ""}
                </dd>
              </div>
            </dl>
            {result && (
              <dl className="tnum mt-2 grid gap-1 border-t border-[#E5E9F2] pt-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt>Puntos (código)</dt>
                  <dd>
                    {result.score.status}
                    {result.score.reason_codes.length > 0 &&
                      ` · ${result.score.reason_codes.join(", ")}`}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Anormalidad (código)</dt>
                  <dd>
                    {result.anomaly.status}
                    {result.anomaly.branch ? ` · ${result.anomaly.branch}` : ""}
                    {result.anomaly.reason_codes.length > 0 &&
                      ` · ${result.anomaly.reason_codes.join(", ")}`}
                  </dd>
                </div>
              </dl>
            )}
          </details>
        </div>
      </div>
      {evidence && (
        <EvidenceDrawer workspace={workspace} target={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
