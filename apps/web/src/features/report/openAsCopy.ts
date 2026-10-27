// Una prueba guardada vuelve al simulador como borrador editable (UX-15).
// La copia original no se toca: el borrador reevalúa con los datos
// vigentes y se guarda, si quieres, con otro nombre.

import type { EvaluationRequest, Scenario } from "../../api/client";
import type { Hypotheses } from "../pricing/hypotheses";
import { DISCOUNT_MAX, DISCOUNT_MIN } from "../../lib/validation";

export interface CopyPatch {
  h: Hypotheses;
  scenarioName: string;
}

/** Decimal rate ("0.1300") -> percent for the editor, clamped to the slider. */
export function rateToDiscountPct(rate: string): number | null {
  const pct = Math.round(Number(rate) * 1000) / 10;
  if (!Number.isFinite(pct)) return null;
  return Math.min(DISCOUNT_MAX, Math.max(DISCOUNT_MIN, pct));
}

function offerPrice(input: EvaluationRequest, index: number, fallback: string): string {
  return input.rivals.offers[index]?.price_net ?? fallback;
}

function offerGroup(input: EvaluationRequest, index: number, fallback: string): string {
  return input.rivals.offers[index]?.group_id ?? fallback;
}

export function scenarioToDraft(scenario: Scenario, current: Hypotheses): CopyPatch {
  const input = scenario.input;
  const pct = rateToDiscountPct(input.discount_rate);
  return {
    h: {
      discountPct: pct ?? current.discountPct,
      rivalAPrice: offerPrice(input, 0, current.rivalAPrice),
      rivalAGroup: offerGroup(input, 0, current.rivalAGroup),
      rivalBPrice: offerPrice(input, 1, current.rivalBPrice),
      rivalBGroup: offerGroup(input, 1, current.rivalBGroup),
      ownGroup: input.rivals.own_group_id ?? current.ownGroup,
      complete: input.rivals.complete,
      groupsConfirmed: input.rivals.group_membership_confirmed,
      noRivals: input.rivals.offers.length === 0,
      rivalState: input.rivals.state,
    },
    scenarioName: `${scenario.name} (copia)`.slice(0, 200),
  };
}
