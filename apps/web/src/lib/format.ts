// Display-only formatting (es-ES). Backend strings stay authoritative.
// Numeric conversion here is presentation only; the UI never recomputes figures.
//
// CANONICAL RULE (voice guide v1): no other file may format numbers.
// Every number shown in the UI goes through this module. Later phases
// migrate CurveChart.tsx and sources.ts call sites; this phase only adds.

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

// --- Canonical formatters (voice guide v1). New display code uses these. ---

const eurHeadline = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const points1 = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const maxPointsShort = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const fechaNormalDate = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
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

export function formatPoints(points: string, maxPoints?: string): string {
  const n = finiteOrNull(points);
  if (n === null) return "—";
  // Single-argument form is legacy (4 decimals); existing call sites keep it.
  // The canonical two-argument form renders "46,4 de 49" (1 decimal).
  if (maxPoints === undefined) return points4.format(n);
  const m = finiteOrNull(maxPoints);
  if (m === null) return "—";
  return `${points1.format(n)} de ${maxPointsShort.format(m)}`;
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

// --- Canonical display API (voice guide v1). ---

/** Canonical headline euros: "118.336 €" (0 decimals). Presentation only. */
export function formatEurosHeadline(amount: string): string {
  const n = finiteOrNull(amount);
  return n === null ? "—" : eurHeadline.format(n);
}

/** Canonical exact euros: "118.336,00 €" (2 decimals). Presentation only. */
export function formatEurosExact(amount: string): string {
  const n = finiteOrNull(amount);
  return n === null ? "—" : eur.format(n);
}

/** Canonical percent: backend rate string ("0.0500") -> "5,0 %". Presentation only. */
export function formatPercent(rate: string): string {
  const n = finiteOrNull(rate);
  return n === null ? "—" : percent1.format(n);
}

/**
 * Canonical date: ISO -> "25 de noviembre de 2026, 23:59".
 * Same local-timezone semantics as formatDateTime; invalid input echoes back.
 */
export function formatFechaNormal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fechaNormalDate.format(d)}, ${hh}:${mm}`;
}

/** Mobile keyboard hint for price inputs: `<input inputMode={PRECIO_INPUT_MODE} />`. */
export const PRECIO_INPUT_MODE = "decimal" as const;

const PROTOCOL_MONEY = /^\d{1,12}\.\d{2}$/;

/**
 * Parses Spanish price input into protocol money ("118336.50").
 * Accepts comma and dot as decimal separators ("118336,50", "118336.50",
 * "118.336,50"); bare integers gain ".00". Returns null when unusable.
 *
 * Single-dot ambiguity ("118.336"): one dot with exactly 3 trailing digits
 * and a 1-3 digit leading group counts as Spanish thousands. Every other
 * single dot counts as a decimal separator. Multiple dots must all be
 * thousands groups (first 1-3 digits, rest exactly 3). Two commas reject.
 */
export function parsePrecioInput(raw: string): string | null {
  const clean = raw.replace(/[\s\u00A0\u202F]/g, "");
  if (clean === "" || !/^[0-9.,]+$/.test(clean)) return null;

  const firstComma = clean.indexOf(",");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    // Both separators: the last one is decimal, the other is thousands.
    normalized =
      lastComma > lastDot ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (lastComma !== -1) {
    if (firstComma !== lastComma) return null;
    normalized = clean.replace(",", ".");
  } else if (lastDot !== -1) {
    const parts = clean.split(".");
    if (parts.length === 2) {
      const [head, tail] = parts as [string, string];
      const thousands = tail.length === 3 && /^[1-9]\d{0,2}$/.test(head);
      normalized = thousands ? head + tail : clean;
    } else {
      // Multiple dots: every group after the first must hold exactly 3 digits.
      const [head, ...rest] = parts as [string, ...string[]];
      if (!/^[1-9]\d{0,2}$/.test(head) || !rest.every((g) => /^\d{3}$/.test(g))) return null;
      normalized = parts.join("");
    }
  } else {
    normalized = clean;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const protocol = n.toFixed(2);
  return PROTOCOL_MONEY.test(protocol) ? protocol : null;
}
