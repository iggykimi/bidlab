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

/** Non-finite backend values render as an em dash, never NaN/Infinity. */
function finiteOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function formatEUR(amount: string): string {
  const n = finiteOrNull(amount);
  return n === null ? "—" : eur.format(n);
}

export function formatSignedEUR(amount: string): string {
  const n = finiteOrNull(amount);
  return n === null ? "—" : signedEur.format(n);
}

export function formatPoints(points: string): string {
  const n = finiteOrNull(points);
  return n === null ? "—" : points4.format(n);
}

/** Backend rate string ("0.0500") -> "5,0 %". Presentation only. */
export function formatRate(rate: string): string {
  const n = finiteOrNull(rate);
  return n === null ? "—" : percent1.format(n);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTime.format(d);
}

/** Discount percent (0-40, step 0.1) -> protocol rate string with 4 decimals. */
export function discountPercentToRate(percent: number): string {
  return (percent / 100).toFixed(4);
}
