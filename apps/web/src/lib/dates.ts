// Deadline/countdown display helpers (es-ES). Display only; backend ISO
// strings stay authoritative and the UI never recomputes figures.
//
// formatFechaNormal is re-exported from the canonical ./format module so
// the "25 de noviembre de 2026, 23:59" shape keeps one definition.

export { formatFechaNormal } from "./format";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/** Strict local-time parse; rejects rollover dates such as 2026-02-30. */
function parseLocal(iso: string): Date | null {
  const trimmed = iso.trim();
  if (trimmed === "") return null;

  const dateOnly = DATE_ONLY.exec(trimmed);
  if (dateOnly) {
    const [, y, m, d] = dateOnly as unknown as [string, string, string, string];
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    const ok =
      dt.getFullYear() === Number(y) &&
      dt.getMonth() === Number(m) - 1 &&
      dt.getDate() === Number(d);
    return ok ? dt : null;
  }

  const dtm = LOCAL_DATETIME.exec(trimmed);
  if (dtm) {
    const [, y, mo, d, hh, mm, ss, ms] = dtm as unknown as [
      string,
      string,
      string,
      string,
      string,
      string,
      string | undefined,
      string | undefined,
    ];
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss ?? "0"),
      Number(ms ?? "0")
    );
    const ok =
      dt.getFullYear() === Number(y) &&
      dt.getMonth() === Number(mo) - 1 &&
      dt.getDate() === Number(d) &&
      dt.getHours() === Number(hh) &&
      dt.getMinutes() === Number(mm);
    return ok ? dt : null;
  }

  // Offset/UTC shapes ("...+01:00", "...Z"): honour the instant, compare its
  // local calendar day below.
  const fallback = new Date(trimmed.replace(" ", "T"));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function resolveNow(now?: Date | string): Date {
  if (now instanceof Date) return Number.isNaN(now.getTime()) ? new Date() : now;
  if (typeof now === "string") return parseLocal(now) ?? new Date();
  return new Date();
}

/**
 * Deadline countdown against the local calendar day.
 *
 * - 2+ days out -> "Quedan N días"
 * - 1 day out -> "Queda 1 día"
 * - same local day -> "Último día: hoy"
 * - past -> "Plazo cerrado"
 * - unparseable deadline -> "—" (unknown marker, never a false claim)
 *
 * `now` is injectable (Date or ISO string) so tests stay deterministic;
 * it defaults to the current local time.
 */
export function diasRestantes(deadlineIso: string, now?: Date | string): string {
  const deadline = parseLocal(deadlineIso);
  if (deadline === null) return "—";
  const today = resolveNow(now);
  const diffDays = Math.round(
    (startOfLocalDay(deadline) - startOfLocalDay(today)) / 86_400_000
  );
  if (diffDays < 0) return "Plazo cerrado";
  if (diffDays === 0) return "Último día: hoy";
  if (diffDays === 1) return "Queda 1 día";
  return `Quedan ${diffDays} días`;
}
