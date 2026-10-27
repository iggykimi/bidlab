// Hipótesis del Pricing Lab: entradas editables del simulador.
// Separado del hook para que el almacén de borradores lo reuse sin ciclos.

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
  ownGroup: "c",
  complete: true,
  groupsConfirmed: true,
  noRivals: false,
  rivalState: "assumed",
};
