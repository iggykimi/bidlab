import { describe, expect, it } from "vitest";
import { diasRestantes, formatFechaNormal } from "./dates";

describe("dates: formatFechaNormal (re-exported canonical)", () => {
  it("formats space-separated local ISO as day de month de year, HH:MM", () => {
    expect(formatFechaNormal("2026-11-25 23:59")).toBe("25 de noviembre de 2026, 23:59");
  });

  it("formats T-separated local ISO the same way", () => {
    expect(formatFechaNormal("2026-11-25T23:59")).toBe("25 de noviembre de 2026, 23:59");
  });

  it("echoes invalid input back (canonical fallback)", () => {
    expect(formatFechaNormal("no-fecha")).toBe("no-fecha");
  });
});

describe("dates: diasRestantes", () => {
  const now = new Date(2026, 10, 1, 12, 0); // 1 nov 2026, local noon

  it("counts 29 days out with the plural form", () => {
    expect(diasRestantes("2026-11-30 23:59", now)).toBe("Quedan 29 días");
  });

  it("counts 2 days out with the plural form", () => {
    expect(diasRestantes("2026-11-03 09:00", now)).toBe("Quedan 2 días");
  });

  it("uses the singular form 1 day out", () => {
    expect(diasRestantes("2026-11-02 00:00", now)).toBe("Queda 1 día");
  });

  it("reports the same local day as the last day, whatever the hour", () => {
    expect(diasRestantes("2026-11-01 00:01", now)).toBe("Último día: hoy");
    expect(diasRestantes("2026-11-01 23:59", now)).toBe("Último día: hoy");
    expect(diasRestantes("2026-11-01", now)).toBe("Último día: hoy");
  });

  it("reports past deadlines as closed", () => {
    expect(diasRestantes("2026-10-31 23:59", now)).toBe("Plazo cerrado");
    expect(diasRestantes("2026-01-01", now)).toBe("Plazo cerrado");
  });

  it("accepts a date-only deadline as a local day", () => {
    expect(diasRestantes("2026-11-25", now)).toBe("Quedan 24 días");
  });

  it("accepts an injectable string now for deterministic tests", () => {
    expect(diasRestantes("2026-11-30 23:59", "2026-11-01 12:00")).toBe("Quedan 29 días");
  });

  it("accepts an injectable Date now across month boundaries", () => {
    expect(diasRestantes("2026-12-01", new Date(2026, 10, 30))).toBe("Queda 1 día");
  });

  it("honours explicit offsets by their local calendar day", () => {
    // 2026-11-02 00:30 +01:00 is still 1 nov locally behind UTC-0:59 or less;
    // assert shape stability instead of a zone-dependent literal.
    const label = diasRestantes("2026-11-02T00:30:00+01:00", now);
    expect(["Queda 1 día", "Último día: hoy"]).toContain(label);
  });

  it("falls back to the unknown marker on invalid input, never a false claim", () => {
    for (const bad of ["", "   ", "no-fecha", "2026-02-30", "2026-11-25 25:00", "25/11/2026"]) {
      expect(diasRestantes(bad, now)).toBe("—");
    }
  });

  it("defaults now to the real current time", () => {
    expect(diasRestantes("2000-01-01")).toBe("Plazo cerrado");
    const far = diasRestantes("2999-01-01");
    expect(far.startsWith("Quedan ")).toBe(true);
    expect(far.endsWith(" días")).toBe(true);
  });
});
