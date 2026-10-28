// Prueba de resistencia: malla de rebajas contra hipótesis rivales.
// El backend calcula cada celda; aquí solo viajan tus entradas.

import { useMemo, useRef, useState } from "react";
import {
  getStress,
  isAbort,
  runStress,
  type StressHypothesisInput,
  type StressTestResult,
} from "../../api/client";
import { Alert, Badge, Button, Card } from "../../components/ui";
import { errorCode, errorEs } from "../../lib/errors";
import {
  PRECIO_INPUT_MODE,
  formatEurosExact,
  formatPercent,
  formatPoints1,
  parsePrecioInput,
} from "../../lib/format";
import { errorCodeOnly, reasonEs } from "./sources";
import {
  STRESS_MAX_HYPOTHESES,
  buildCandidateDiscounts,
  isGridOk,
  rateToDiscountPercent,
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

function normPoints(raw: string): string | null {
  const clean = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,4})?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? clean : null;
}

function normPeriod(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
}

/** Etiquetas de hipótesis en orden de aparición en las celdas. */
function hypothesisLabels(result: StressTestResult): string[] {
  const labels: string[] = [];
  for (const cell of result.cells) {
    if (!labels.includes(cell.hypothesis_label)) labels.push(cell.hypothesis_label);
  }
  return labels;
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
      setResult(res);
    } catch (err: unknown) {
      if (isAbort(err)) return;
      setResult(null);
      setError(errorEs(err, "No pudimos probar tu malla. Vuelve a intentarlo en unos segundos."));
      setRawError(errorCode(err));
    } finally {
      setPending(false);
    }
  }

  async function handleReload() {
    if (!result) return;
    setError(null);
    setRawError(null);
    setPending(true);
    try {
      setResult(await getStress(result.id));
    } catch (err: unknown) {
      if (isAbort(err)) return;
      setError(errorEs(err, "No pudimos recargar tu prueba. Vuelve a intentarlo en unos segundos."));
      setRawError(errorCode(err));
    } finally {
      setPending(false);
    }
  }

  function handleApply() {
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

  return (
    <Card aria-label="Prueba de resistencia" data-testid="stress-section">
      <h2 className="text-lg font-semibold">Prueba de resistencia</h2>
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
            <legend className="px-1 text-sm font-semibold">Hipótesis {i + 1}</legend>
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
                <span className="font-medium">Rival A · precio sin impuestos en €</span>
                <input
                  type="text"
                  inputMode={PRECIO_INPUT_MODE}
                  value={d.rivalA}
                  onChange={(e) => updateDraft(d.key, { rivalA: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                <span className="font-medium">Rival B · precio sin impuestos en €</span>
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
              <span>Tomar estos como todos los rivales</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.groups}
                onChange={(e) => updateDraft(d.key, { groups: e.target.checked })}
                className="mt-1"
              />
              <span>Cada rival es de una empresa distinta</span>
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
          <div>
            <h3 className="text-sm font-semibold">Tu conclusión</h3>
            {selection ? (
              <p data-testid="stress-selection" className="mt-1 text-lg font-semibold">
                La rebaja del {formatPercent(selection.discount_rate)} cumple tus límites en las{" "}
                {selection.feasible_count} hipótesis. En el peor caso sacas{" "}
                {formatPoints1(selection.worst_score)} puntos por precio y{" "}
                {formatEurosExact(selection.worst_profit_net)} de beneficio.
              </p>
            ) : (
              <p data-testid="stress-selection" className="mt-1 text-lg font-semibold">
                Ninguna rebaja cumple tus límites en todas las hipótesis.
              </p>
            )}
            <p className="mt-1 text-xs text-muted">{result.selection_reason}</p>
            <p className="mt-1 text-xs text-muted">
              <Button variant="subtle" onClick={handleReload} disabled={pending}>
                Recargar resultado
              </Button>
            </p>
          </div>

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
              {hypothesisLabels(result).map((label) => (
                <details key={label} className="rounded-lg border border-border p-3">
                  <summary className="flex min-h-[48px] cursor-pointer items-center text-sm font-semibold">
                    {label}
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
                          .filter((c) => c.hypothesis_label === label)
                          .map((c) => (
                            <tr
                              key={`${c.hypothesis_label}-${c.discount_rate}`}
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
                <Button data-testid="stress-apply" onClick={handleApply}>
                  Aplicar esta rebaja
                </Button>
                {applied && (
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
