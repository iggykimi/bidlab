import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearTrackedAnalysis,
  loadTrackedAnalysis,
  parseTrackedAnalysis,
  saveTrackedAnalysis,
  serializeTrackedAnalysis,
} from "./analysisJobStore";

describe("parseTrackedAnalysis", () => {
  it("devuelve vacío con nulo, basura o versión distinta", () => {
    expect(parseTrackedAnalysis(null)).toEqual({});
    expect(parseTrackedAnalysis("no-json")).toEqual({});
    expect(parseTrackedAnalysis(JSON.stringify({ version: 999, jobs: { a: "b" } }))).toEqual({});
    expect(parseTrackedAnalysis(JSON.stringify({ version: 1, jobs: null }))).toEqual({});
  });

  it("conserva solo pares id válidos", () => {
    const parsed = parseTrackedAnalysis(
      JSON.stringify({
        version: 1,
        jobs: {
          tias: { jobId: "job-1", location: "/api/v1/jobs/job-1" },
          legacy: "job-2",
          "": { jobId: "x", location: null },
          bad: { jobId: 42, location: null },
          long: { jobId: "y".repeat(201), location: null },
        },
      })
    );
    expect(parsed).toEqual({ tias: { jobId: "job-1", location: "/api/v1/jobs/job-1" } });
  });

  it("serializa con versión", () => {
    expect(
      JSON.parse(serializeTrackedAnalysis({ tias: { jobId: "job-1", location: null } }))
    ).toEqual({
      version: 1,
      jobs: { tias: { jobId: "job-1", location: null } },
    });
  });
});

describe("localStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guarda, lee y borra por licitación", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    expect(loadTrackedAnalysis("tias")).toBeNull();
    expect(saveTrackedAnalysis("tias", { jobId: "job-1", location: "/j/job-1" })).toBe(true);
    expect(saveTrackedAnalysis("own-2", { jobId: "job-9", location: null })).toBe(true);
    expect(loadTrackedAnalysis("tias")).toEqual({ jobId: "job-1", location: "/j/job-1" });
    clearTrackedAnalysis("tias");
    expect(loadTrackedAnalysis("tias")).toBeNull();
    expect(loadTrackedAnalysis("own-2")).toEqual({ jobId: "job-9", location: null });
  });

  it("sin almacenamiento, leer da nulo y guardar da falso", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadTrackedAnalysis("tias")).toBeNull();
    expect(saveTrackedAnalysis("tias", { jobId: "job-1", location: null })).toBe(false);
    expect(() => clearTrackedAnalysis("tias")).not.toThrow();
  });

  it("si escribir falla, guardar da falso sin lanzar", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      removeItem: () => {},
    });
    expect(saveTrackedAnalysis("tias", { jobId: "job-1", location: null })).toBe(false);
  });
});
