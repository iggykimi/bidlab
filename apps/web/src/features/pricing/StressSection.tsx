// Prueba de resistencia: malla de rebajas contra hipótesis rivales.
// El backend calcula cada celda; aquí solo viajan tus entradas.

import { useMemo, useRef, useState } from "react";
import {
  ApiError,
  getStress,
  isAbort,
  runStress,
  type StressCell,
  type StressHypothesisInput,
  type StressTestResult,
} from "../../api/client";
import { Alert, Badge, Button, Card } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import {
  PRECIO_INPUT_MODE,
  formatDateTime,
  formatEurosExact,
  formatPercent,
  formatPoints1,
  parsePrecioInput,
} from "../../lib/format";
import { errorCodeOnly, reasonEs, selectionReasonEs } from "./sources";
import {
  STRESS_MAX_HYPOTHESES,
  buildCandidateDiscounts,
  isGridOk,
  normPeriod,
  normPoints,
  rateToDiscountPercent,
  stressDetailsEs,
  stressInputKey,
} from "./stressGrid";
import type { PricingState } from "./usePricingState";

interface Props {
  state: PricingState;
}

interface HypothesisDraft {
  key: number;
  label: string;
  cost: string;
  period: string;
  rivalA: string;
  rivalB: string;
  complete: boolean;
  groups: boolean;
}

const inputCls = "tnum mt-1 w-full rounded-lg border border-border px-3 py-2 text-base";
const labelCls = "block text-sm";

/**
 * Hipótesis en orden de entrada, duplicadas incluidas. BL-V3 P1-03
 * (BL-FIX-02): la identidad es la posición, nunca la etiqueta.
 */
interface HypothesisHead {
  index: number;
  label: string;
}

function hypothesisHeads(result: StressTestResult): HypothesisHead[] {
  return result.hypotheses_echo.map((h, index) => ({ index, label: h.label }));
}

/** Visible header: duplicate labels gain their position so columns differ. */
function headLabel(head: HypothesisHead, heads: HypothesisHead[]): string {
  const dup = heads.filter((x) => x.label === head.label).length > 1;
  return dup ? `${head.label} (${head.index + 1})` : head.label;
}

/**
 * Rebajas × hipótesis como tabla de calor (BL-V2-06). Cada celda lleva texto
 * ("Cumple" / motivo), nunca solo color; los detalles por hipótesis siguen
 * debajo con las cifras. Los datos son las celdas del resultado.
 * BL-V3 P1-03: minimapa de 3 hipótesis con detalle por demanda, búsqueda
 * por índice (O(1) por celda) y leyenda con texto.
 */
function StressHeatmap({ result }: { result: StressTestResult }) {
  const heads = hypothesisHeads(result);
  const discounts = result.by_discount.map((row) => row.discount_rate);
  const cells = useMemo(() => {
    const map = new Map<string, StressCell>();
    for (const c of result.cells) map.set(`${c.discount_rate}|${c.hypothesis_index}`, c);
    return map;
  }, [result.cells]);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? heads : heads.slice(0, 3);
  return (
    <div>
      <div
        className="table-scroll overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Mapa de la malla, desplázate horizontalmente"
      >
        <table className="w-full border-collapse text-sm" data-testid="stress-heatmap">
          <caption className="py-2 text-left font-semibold">
            Mapa de la malla: rebajas por hipótesis
          </caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="border-b border-border p-2">
                Rebaja
              </th>
              {visible.map((head) => (
                <th key={head.index} scope="col" className="border-b border-border p-2">
                  {headLabel(head, heads)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {discounts.map((rate) => (
              <tr key={rate}>
                <th scope="row" className="tnum border-b border-line p-2 text-left">
                  {rateToDiscountPercent(rate)} %
                </th>
                {visible.map((head) => {
                  const cell = cells.get(`${rate}|${head.index}`) ?? null;
                  return (
                    <td key={head.index} className="border-b border-line p-2">
                      {cell === null ? (
                        <span className="text-muted">Sin probar</span>
                      ) : cell.feasible ? (
                        <Badge tone="live">Cumple</Badge>
                      ) : (
                        <span>
                          <Badge tone="neutral">No cumple</Badge>{" "}
                          <span className="text-muted">{reasonEs(cell.reason)}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-muted">
        Leyenda: «Cumple» supera tus límites en esa hipótesis; «No cumple» dice el motivo.
      </p>
      {heads.length > 3 && (
        <div className="mt-2">
          <Button
            variant="secondary"
            data-testid="stress-heatmap-more"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Ver solo 3 hipótesis" : `Ver las ${heads.length} hipótesis`}
          </Button>
        </div>
      )}
    </div>
  );
}

export function StressSection({ state }: Props) {
  const { scope, rule, companyId, companyRevision, h, setField } = state;
  const scopePeriod = scope?.basis.period_months ?? null;
  const keyRef = useRef(1);

  const [fromPct, setFromPct] = useState("0");
  const [toPct, setToPct] = useState("40");
  const [stepPct, setStepPct] = useState("0.5");
  const [drafts, setDrafts] = useState<HypothesisDraft[]>(() => [
    {
      key: 0,
      label: "Base",
      cost: "",
      period: scopePeriod === null ? "" : String(scopePeriod),
      rivalA: h.rivalAPrice,
      rivalB: h.rivalBPrice,
      complete: h.complete,
      groups: h.groupsConfirmed,
    },
  ]);
  const [minPoints, setMinPoints] = useState("47");
  const [minProfit, setMinProfit] = useState("8000");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [applied, setApplied] = useState(false);
  // BL-V2-01: canonical key of the inputs that produced `result`. The grid
  // stays visible as history when drafts drift, but never as current.
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);
  const latestSeq = useRef(0);

  const grid = useMemo(
    () => buildCandidateDiscounts(Number(fromPct), Number(toPct), Number(stepPct)),
    [fromPct, toPct, stepPct],
  );
  const rawCode = errorCodeOnly(rawError);

  function updateDraft(key: number, patch: Partial<HypothesisDraft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
    setApplied(false);
  }

  function addDraft() {
    if (drafts.length >= STRESS_MAX_HYPOTHESES) return;
    const key = keyRef.current;
    keyRef.current += 1;
    setDrafts((prev) => [
      ...prev,
      {
        key,
        label: `Hipótesis ${prev.length + 1}`,
        cost: "",
        period: scopePeriod === null ? "" : String(scopePeriod),
        rivalA: "",
        rivalB: "",
        complete: true,
        groups: true,
      },
    ]);
  }

  function removeDraft(key: number) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function buildPayload(): {
    rates: string[];
    hypotheses: StressHypothesisInput[];
    minPointsOk: string;
    minProfitOk: string;
  } | null {
    if (!isGridOk(grid)) {
      setFormError(grid.error);
      return null;
    }
    if (drafts.length === 0 || drafts.length > STRESS_MAX_HYPOTHESES) {
      setFormError("Usa entre 1 y 9 hipótesis rivales.");
      return null;
    }
    const hypotheses: StressHypothesisInput[] = [];
    for (const d of drafts) {
      const label = d.label.trim();
      if (label === "") {
        setFormError("Cada hipótesis necesita una etiqueta.");
        return null;
      }
      const cost = parsePrecioInput(d.cost);
      if (cost === null) {
        setFormError(`Revisa tu coste en «${label}» (como 80000,00).`);
        return null;
      }
      const period = normPeriod(d.period);
      if (period === null) {
        setFormError(`Revisa el periodo en «${label}» (1 a 120 meses).`);
        return null;
      }
      const rivalA = parsePrecioInput(d.rivalA);
      const rivalB = parsePrecioInput(d.rivalB);
      if (rivalA === null || rivalB === null) {
        setFormError(`Revisa los precios rivales en «${label}».`);
        return null;
      }
      hypotheses.push({
        label,
        cost_net: cost,
        period_months: period,
        rival_a_net: rivalA,
        rival_b_net: rivalB,
        rival_set_complete: d.complete,
        independent_groups_assumed: d.groups,
      });
    }
    const points = normPoints(minPoints);
    if (points === null) {
      setFormError("Tus puntos mínimos necesitan un número (como 47).");
      return null;
    }
    const profit = parsePrecioInput(minProfit);
    if (profit === null) {
      setFormError("Tu beneficio mínimo necesita un importe (como 8000,00).");
      return null;
    }
    return { rates: grid.rates, hypotheses, minPointsOk: points, minProfitOk: profit };
  }

  async function handleRun() {
    if (!scope || !rule || !companyId || companyRevision === undefined) return;
    setApplied(false);
    const built = buildPayload();
    if (!built) return;
    setFormError(null);
    setError(null);
    setRawError(null);
    setPending(true);
    const seq = latestSeq.current + 1;
    latestSeq.current = seq;
    const requestKey = stressInputKey({
      scopeId: scope.id,
      ruleId: rule.id,
      ruleRevision: rule.revision,
      companyId,
      companyRevision,
      rates: built.rates,
      drafts,
      minPoints,
      minProfit,
    });
    try {
      const res = await runStress(scope.id, {
        pricing_rule_id: rule.id,
        pricing_rule_revision: rule.revision,
        company_id: companyId,
        company_revision: companyRevision,
        candidate_discounts: built.rates,
        hypotheses: built.hypotheses,
        constraints: {
          min_price_points: built.minPointsOk,
          min_profit_net: built.minProfitOk,
        },
      });
      if (seq !== latestSeq.current) return;
      setResult(res);
      setSubmittedKey(requestKey);
    } catch (err: unknown) {
      if (isAbort(err) || seq !== latestSeq.current) return;
      setResult(null);
      setSubmittedKey(null);
      const lines = err instanceof ApiError ? stressDetailsEs(err.details) : [];
      setError(
        lines.length > 0
          ? lines.join(" ")
          : errorEs(err, "No pudimos probar tu malla. Vuelve a intentarlo en unos segundos.")
      );
      setRawError(errorCode(err));
    } finally {
      if (seq === latestSeq.current) setPending(false);
    }
  }

  async function handleReload() {
    if (!result) return;
    setError(null);
    setRawError(null);
    setPending(true);
    const seq = latestSeq.current + 1;
    latestSeq.current = seq;
    try {
      const res = await getStress(result.id);
      if (seq !== latestSeq.current) return;
      setResult(res);
    } catch (err: unknown) {
      if (isAbort(err) || seq !== latestSeq.current) return;
      setError(errorEs(err, "No pudimos recargar tu prueba. Vuelve a intentarlo en unos segundos."));
      setRawError(errorCode(err));
    } finally {
      if (seq === latestSeq.current) setPending(false);
    }
  }

  // The result freezes its rule/company; a newer revision invalidates it.
  const stale =
    result !== null &&
    rule !== null &&
    companyId !== null &&
    companyRevision !== undefined &&
    (result.rule.id !== rule.id ||
      result.rule.revision !== rule.revision ||
      result.company.id !== companyId ||
      result.company.base_revision !== companyRevision);

  const currentKey = stressInputKey({
    scopeId: scope?.id ?? null,
    ruleId: rule?.id ?? null,
    ruleRevision: rule?.revision ?? null,
    companyId,
    companyRevision,
    rates: isGridOk(grid) ? grid.rates : null,
    drafts,
    minPoints,
    minProfit,
  });
  // Drafts drifted after the run (or turned invalid): history, not current.
  const inputStale = result !== null && submittedKey !== null && currentKey !== submittedKey;

  function handleApply() {
    if (stale || inputStale) return;
    const rate = result?.selection?.discount_rate;
    if (!rate) return;
    const pct = rateToDiscountPercent(rate);
    if (pct === null) return;
    setField("discountPct", pct);
    setApplied(true);
  }

  function useFullGrid() {
    setFromPct("0");
    setToPct("40");
    setStepPct("0.5");
  }

  const ready = scope !== null && rule !== null && companyId !== null && companyRevision !== undefined;
  const selection = result?.selection ?? null;
  const heads = useMemo(() => (result ? hypothesisHeads(result) : []), [result]);
  // Backend ceiling for the selected rebate: lookup only, no frontend math.
  const ceilingRow =
    result && selection
      ? (result.by_discount.find((r) => r.discount_rate === selection.discount_rate) ?? null)
      : null;

  return (
    <Card aria-label="Prueba de resistencia" data-testid="stress-section">
      <h2>Prueba de resistencia</h2>
      <p className="mt-1 text-sm text-muted">
        Prueba hasta 81 rebajas contra 9 hipótesis rivales. Te decimos cuál aguanta tus límites.
      </p>

      <h3 className="mt-4 text-sm font-semibold">Tu malla de rebajas</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <label className={labelCls}>
          <span className="font-medium">Desde (%)</span>
          <input
            type="number"
            aria-label="Rebaja inicial en tanto por ciento"
            min={0}
            max={40}
            step={0.1}
            value={fromPct}
            onChange={(e) => setFromPct(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          <span className="font-medium">Hasta (%)</span>
          <input
            type="number"
            aria-label="Rebaja final en tanto por ciento"
            min={0}
            max={40}
            step={0.1}
            value={toPct}
            onChange={(e) => setToPct(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          <span className="font-medium">Paso (%)</span>
          <input
            type="number"
            aria-label="Paso de la malla en tanto por ciento"
            min={0.1}
            max={40}
            step={0.1}
            value={stepPct}
            onChange={(e) => setStepPct(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={useFullGrid}>
          Malla completa 0-40% paso 0,5
        </Button>
        <p role="status" className="text-sm text-muted">
          {isGridOk(grid)
            ? `Esta malla prueba ${grid.rates.length} rebajas.`
            : grid.error}
        </p>
      </div>

      <h3 className="mt-4 text-sm font-semibold">Tus hipótesis rivales (máximo 9)</h3>
      <div className="mt-2 grid gap-3">
        {drafts.map((d, i) => (
          <fieldset key={d.key} className="grid gap-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-semibold">Hipótesis {i + 1} (supuesto)</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                <span className="font-medium">Etiqueta</span>
                <input
                  type="text"
                  value={d.label}
                  onChange={(e) => updateDraft(d.key, { label: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                <span className="font-medium">Tu coste sin impuestos en € (coma o punto)</span>
                <input
                  type="text"
                  inputMode={PRECIO_INPUT_MODE}
                  value={d.cost}
                  onChange={(e) => updateDraft(d.key, { cost: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                <span className="font-medium">Periodo en meses</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  step={1}
                  value={d.period}
                  onChange={(e) => updateDraft(d.key, { period: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                <span className="font-medium">Rival A · precio sin impuestos en € (supuesto)</span>
                <input
                  type="text"
                  inputMode={PRECIO_INPUT_MODE}
                  value={d.rivalA}
                  onChange={(e) => updateDraft(d.key, { rivalA: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                <span className="font-medium">Rival B · precio sin impuestos en € (supuesto)</span>
                <input
                  type="text"
                  inputMode={PRECIO_INPUT_MODE}
                  value={d.rivalB}
                  onChange={(e) => updateDraft(d.key, { rivalB: e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.complete}
                onChange={(e) => updateDraft(d.key, { complete: e.target.checked })}
                className="mt-1"
              />
              <span>Tomar estos como todos los rivales (supuesto)</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.groups}
                onChange={(e) => updateDraft(d.key, { groups: e.target.checked })}
                className="mt-1"
              />
              <span>Cada rival es de una empresa distinta (supuesto)</span>
            </label>
            {drafts.length > 1 && (
              <div>
                <Button variant="subtle" onClick={() => removeDraft(d.key)}>
                  Quitar esta hipótesis
                </Button>
              </div>
            )}
          </fieldset>
        ))}
      </div>
      <div className="mt-2">
        <Button
          variant="secondary"
          onClick={addDraft}
          disabled={drafts.length >= STRESS_MAX_HYPOTHESES}
        >
          Añadir hipótesis
        </Button>
      </div>

      <h3 className="mt-4 text-sm font-semibold">Tus límites</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          <span className="font-medium">Puntos por precio mínimos</span>
          <input
            type="text"
            inputMode="decimal"
            value={minPoints}
            onChange={(e) => setMinPoints(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          <span className="font-medium">Beneficio mínimo en € (coma o punto)</span>
          <input
            type="text"
            inputMode={PRECIO_INPUT_MODE}
            value={minProfit}
            onChange={(e) => setMinProfit(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button data-testid="stress-run" onClick={handleRun} disabled={!ready || pending}>
          {pending ? "Probando tu malla…" : "Probar la malla"}
        </Button>
        {!ready && <p className="text-sm text-muted">Cargando tu empresa…</p>}
      </div>
      {formError && (
        <Alert tone="error" className="mt-2">
          {formError}
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mt-2">
          {error}
          {rawCode ? ` (código: ${rawCode})` : ""}
        </Alert>
      )}

      {result && (
        <div className="mt-4 grid gap-3">
          <p className="text-sm font-semibold">
            Qué rebajas siguen siendo viables bajo las hipótesis introducidas
          </p>
          {stale && (
            <Alert tone="warn" data-testid="stress-stale">
              Resultado anterior: la regla o tu empresa cambió después de esta malla. Vuelve a
              probarla.
            </Alert>
          )}
          {!stale && inputStale && (
            <Alert tone="warn" data-testid="stress-stale-input">
              Resultado anterior: has cambiado las entradas después de esta malla. Vuelve a
              probarla.
            </Alert>
          )}
          <div>
            <h3 className="text-sm font-semibold">
              {stale || inputStale ? "Resultado anterior: recalcula" : "Tu conclusión"}
            </h3>
            {selection ? (
              <p data-testid="stress-selection" className="mt-1 text-lg font-semibold">
                La rebaja del {formatPercent(selection.discount_rate)} cumple tus límites en{" "}
                {(ceilingRow?.comparable_count ?? result.tested_hypotheses) === 1
                  ? "1 hipótesis"
                  : `las ${ceilingRow?.comparable_count ?? result.tested_hypotheses} hipótesis`}
                . En el peor caso sacas{" "}
                {formatPoints1(selection.worst_score)} puntos por precio y{" "}
                {formatEurosExact(selection.worst_profit_net)} de beneficio.
              </p>
            ) : (
              <p data-testid="stress-selection" className="mt-1 text-lg font-semibold">
                Ninguna rebaja cumple tus límites en todas las hipótesis.
              </p>
            )}
            <p className="mt-1 text-xs text-muted">{selectionReasonEs(result.selection_reason)}</p>
            {ceilingRow !== null &&
              ceilingRow.price_net !== null &&
              ceilingRow.max_cost_net !== null && (
                <div className="mt-2 rounded-lg border border-border p-3">
                  <p data-testid="stress-cost-ceiling" className="text-sm font-semibold">
                    Con este precio ({formatEurosExact(ceilingRow.price_net)}) y este mínimo, tu
                    coste máximo es {formatEurosExact(ceilingRow.max_cost_net)}.
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
                    <li>
                      Válido solo en esta misma base: mismo precio, periodo, impuestos y moneda.
                    </li>
                    <li>
                      No incluye cambios futuros de precio, otros criterios ni elegibilidad legal.
                    </li>
                    <li>
                      No es una probabilidad ni una predicción de rivales: es el coste que agota tu
                      mínimo.
                    </li>
                  </ul>
                </div>
              )}
            <p data-testid="stress-computed-at" className="mt-1 text-xs text-muted">
              Calculada el {formatDateTime(result.created_at)}.
            </p>
            <p className="mt-1 text-xs text-muted">
              <Button variant="subtle" onClick={handleReload} disabled={pending}>
                Recargar resultado
              </Button>
            </p>
          </div>

          <StressHeatmap result={result} />
          <div className="overflow-x-auto">
            <table className="tnum w-full text-sm">
              <caption className="py-2 text-left font-semibold">Peor caso por rebaja</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Rebaja
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Puntos por precio (peor)
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Beneficio (peor)
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Tu coste máximo
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Resultado
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.by_discount.map((row) => (
                  <tr
                    key={row.discount_rate}
                    data-testid={`stress-row-${row.discount_rate}`}
                    className="border-b border-border"
                  >
                    <td className="py-2 pr-4">{formatPercent(row.discount_rate)}</td>
                    <td className="py-2 pr-4">
                      {row.worst_score === null ? "—" : formatPoints1(row.worst_score)}
                    </td>
                    <td className="py-2 pr-4">
                      {row.worst_profit_net === null ? "—" : formatEurosExact(row.worst_profit_net)}
                    </td>
                    <td className="py-2 pr-4">
                      {row.max_cost_net === null ? "—" : formatEurosExact(row.max_cost_net)}
                    </td>
                    <td className="py-2">
                      <Badge tone={row.all_feasible ? "live" : "neutral"}>
                        {row.all_feasible ? "Cumple" : "No cumple"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.warnings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">Avisos</h3>
              <ul data-testid="stress-warnings" className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {result.warnings.map((w, i) => (
                  <li key={`${i}-${w}`}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold">Detalle por hipótesis</h3>
            <div className="mt-2 grid gap-2">
              {heads.map((head) => (
                <details key={head.index} className="rounded-lg border border-border p-3">
                  <summary className="flex min-h-[48px] cursor-pointer items-center text-sm font-semibold">
                    {headLabel(head, heads)}
                  </summary>
                  <div className="overflow-x-auto">
                    <table className="tnum mt-2 w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th scope="col" className="py-2 pr-4 font-semibold">
                            Rebaja
                          </th>
                          <th scope="col" className="py-2 pr-4 font-semibold">
                            Tu precio
                          </th>
                          <th scope="col" className="py-2 pr-4 font-semibold">
                            Puntos por precio
                          </th>
                          <th scope="col" className="py-2 pr-4 font-semibold">
                            Beneficio
                          </th>
                          <th scope="col" className="py-2 font-semibold">
                            Motivo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.cells
                          .filter((c) => c.hypothesis_index === head.index)
                          .map((c) => (
                            <tr
                              key={`${c.hypothesis_index}-${c.discount_rate}`}
                              className="border-b border-border"
                            >
                              <td className="py-2 pr-4">{formatPercent(c.discount_rate)}</td>
                              <td className="py-2 pr-4">
                                {c.price_net === null ? "—" : formatEurosExact(c.price_net)}
                              </td>
                              <td className="py-2 pr-4">
                                {c.score === null ? "—" : formatPoints1(c.score)}
                              </td>
                              <td className="py-2 pr-4">
                                {c.profit_net === null ? "—" : formatEurosExact(c.profit_net)}
                              </td>
                              <td className="py-2 text-muted">
                                {c.feasible ? "Cumple" : reasonEs(c.reason)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          </div>

          {selection && (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  data-testid="stress-apply"
                  onClick={handleApply}
                  disabled={stale || inputStale}
                >
                  Aplicar esta rebaja
                </Button>
                {applied && !stale && !inputStale && (
                  <p role="status" className="text-sm">
                    Ya tienes esa rebaja en el simulador.
                  </p>
                )}
              </div>
              <p className="text-sm text-muted">
                Guarda un escenario con esta rebaja para llevarla al informe.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
