// Malla de rebajas de la prueba de resistencia: desde/hasta/paso
// (tanto por ciento) a tipos de protocolo ("0.0500"). Sin cifras
// calculadas; este módulo solo construye la lista de candidatas.

import { discountPercentToRate } from "../../lib/format";
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
