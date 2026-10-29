// Malla de rebajas de la prueba de resistencia: desde/hasta/paso
// (tanto por ciento) a tipos de protocolo ("0.0500"). Sin cifras
// calculadas; este módulo solo construye la lista de candidatas.

import { discountPercentToRate, parsePrecioInput } from "../../lib/format";
import { DISCOUNT_MAX, DISCOUNT_MIN } from "../../lib/validation";

export const STRESS_MAX_CANDIDATES = 81;
export const STRESS_MAX_HYPOTHESES = 9;

export type GridResult = { rates: string[] } | { error: string };

export function isGridOk(result: GridResult): result is { rates: string[] } {
  return "rates" in result;
}

/** Tanto por ciento a tipo de protocolo; recorta duplicados de redondeo. */
export function buildCandidateDiscounts(
  fromPct: number,
  toPct: number,
  stepPct: number,
): GridResult {
  for (const value of [fromPct, toPct, stepPct]) {
    if (!Number.isFinite(value)) return { error: "Escribe desde, hasta y paso con números." };
  }
  if (fromPct < DISCOUNT_MIN || toPct > DISCOUNT_MAX || fromPct > toPct) {
    return { error: "La malla va de 0 % a 40 %, de menor a mayor." };
  }
  if (stepPct <= 0) return { error: "El paso debe ser mayor que cero." };
  const count = Math.round((toPct - fromPct) / stepPct) + 1;
  if (count > STRESS_MAX_CANDIDATES) {
    return { error: "La malla supera 81 rebajas. Amplía el paso." };
  }
  const rates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const pct = Math.round((fromPct + i * stepPct) * 10000) / 10000;
    if (pct > toPct + 1e-9) break;
    const rate = discountPercentToRate(pct);
    if (!rates.includes(rate)) rates.push(rate);
  }
  return { rates };
}

/** Puntos mínimos normalizados (punto decimal, 4 decimales). Null si no sirve. */
export function normPoints(raw: string): string | null {
  const clean = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,4})?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? clean : null;
}

/** Periodo en meses 1-120. Null si no sirve. */
export function normPeriod(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
}

export interface StressDraftLike {
  label: string;
  cost: string;
  period: string;
  rivalA: string;
  rivalB: string;
  complete: boolean;
  groups: boolean;
}

/**
 * Clave canónica de las entradas de una malla (BL-V2-01). Orden de claves
 * fijo y valores normalizados: el JSON es canónico por construcción.
 * Devuelve null si algún campo no normaliza (borrador inválido).
 */
export function stressInputKey(args: {
  scopeId: string | null;
  ruleId: string | null;
  ruleRevision: number | null;
  companyId: string | null;
  companyRevision: number | null | undefined;
  rates: string[] | null;
  drafts: StressDraftLike[];
  minPoints: string;
  minProfit: string;
}): string | null {
  if (
    args.scopeId === null ||
    args.ruleId === null ||
    args.ruleRevision === null ||
    args.companyId === null ||
    args.companyRevision === null ||
    args.companyRevision === undefined ||
    args.rates === null
  ) {
    return null;
  }
  const hyps: unknown[] = [];
  for (const d of args.drafts) {
    const label = d.label.trim();
    const cost = parsePrecioInput(d.cost);
    const period = normPeriod(d.period);
    const rivalA = parsePrecioInput(d.rivalA);
    const rivalB = parsePrecioInput(d.rivalB);
    if (label === "" || cost === null || period === null || rivalA === null || rivalB === null) {
      return null;
    }
    hyps.push({
      label,
      cost_net: cost,
      period_months: period,
      rival_a_net: rivalA,
      rival_b_net: rivalB,
      rival_set_complete: d.complete,
      independent_groups_assumed: d.groups,
    });
  }
  const points = normPoints(args.minPoints);
  const profit = parsePrecioInput(args.minProfit);
  if (points === null || profit === null) return null;
  return JSON.stringify({
    scope: args.scopeId,
    rule: args.ruleId,
    ruleRevision: args.ruleRevision,
    company: args.companyId,
    companyRevision: args.companyRevision,
    rates: args.rates,
    hypotheses: hyps,
    minPoints: points,
    minProfit: profit,
  });
}

/** Tipo de protocolo ("0.0500") a tanto por ciento (5). Null si no sirve. */
export function rateToDiscountPercent(rate: string): number | null {
  if (rate.trim() === "") return null;
  const n = Number(rate);
  if (!Number.isFinite(n) || n < 0 || n > DISCOUNT_MAX / 100) return null;
  return Math.round(n * 1000) / 10;
}

const HYP_COST = /^hypotheses\[(\d+)\]\.cost_net$/;
const CANDIDATE = /^candidate_discounts\[(\d+)\]$/;

/**
 * Rutas de campo del servidor (details del 422) a frases en español.
 * Solo traduce rutas conocidas; el resto lo cubre el mensaje general.
 */
export function stressDetailsEs(details: string[]): string[] {
  const out: string[] = [];
  for (const detail of details) {
    const hyp = HYP_COST.exec(detail);
    if (hyp) {
      out.push(`Hipótesis ${Number(hyp[1]) + 1}: revisa tu coste (mayor que cero).`);
      continue;
    }
    const cand = CANDIDATE.exec(detail);
    if (cand) {
      out.push(`Rebaja ${Number(cand[1]) + 1}: fuera de 0–40 %.`);
      continue;
    }
    if (detail === "constraints.min_price_points") {
      out.push("Revisa tus puntos mínimos (mayores que cero).");
      continue;
    }
    if (detail === "constraints.min_profit_net") {
      out.push("Revisa tu beneficio mínimo (mayor que cero).");
      continue;
    }
  }
  return out;
}
