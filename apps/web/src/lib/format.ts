// Display-only formatting (es-ES). Backend strings stay authoritative.
// Numeric conversion here is presentation only; the UI never recomputes figures.

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const signedEur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  signDisplay: "always",
});

const points4 = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const percent1 = new Intl.NumberFormat("es-ES", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateTime = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatEUR(amount: string): string {
  return eur.format(Number(amount));
}

export function formatSignedEUR(amount: string): string {
  return signedEur.format(Number(amount));
}

export function formatPoints(points: string): string {
  return points4.format(Number(points));
}

/** Backend rate string ("0.0500") -> "5,0 %". Presentation only. */
export function formatRate(rate: string): string {
  return percent1.format(Number(rate));
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTime.format(d);
}

/** Discount percent (0-40, step 0.1) -> protocol rate string with 4 decimals. */
export function discountPercentToRate(percent: number): string {
  return (percent / 100).toFixed(4);
}

/** Protocol rate string -> discount percent number for the slider. */
export function rateToDiscountPercent(rate: string): number {
  return Math.round(Number(rate) * 1000) / 10;
}
