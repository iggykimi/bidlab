import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyPersistError,
  contextKey,
  defaultDrafts,
  parseDraftStore,
  saveDraftStore,
  serializeDraftStore,
  stableKey,
} from "./draftStore";

describe("stableKey", () => {
  it("ignora el orden de las claves", () => {
    expect(stableKey({ a: 1, b: 2 })).toBe(stableKey({ b: 2, a: 1 }));
  });

  it("ordena objetos anidados y conserva el orden de los arrays", () => {
    const left = { offers: [{ price: "1", label: "A" }], z: { y: 1, x: 2 } };
    const right = { z: { x: 2, y: 1 }, offers: [{ label: "A", price: "1" }] };
    expect(stableKey(left)).toBe(stableKey(right));
    expect(stableKey({ offers: [1, 2] })).not.toBe(stableKey({ offers: [2, 1] }));
  });

  it("distingue valores distintos", () => {
    expect(stableKey({ discount: "0.05" })).not.toBe(stableKey({ discount: "0.14" }));
  });
});

describe("contextKey", () => {
  it("separa los tres identificadores", () => {
    expect(contextKey({ tenderId: "tias", scopeId: "s1", companyId: "c1" })).toBe("tias|s1|c1");
  });

  it("escapa el separador dentro de un id", () => {
    const key = contextKey({ tenderId: "a|b", scopeId: "s", companyId: "c" });
    expect(key).toBe("a%7Cb|s|c");
  });
});

describe("parseDraftStore", () => {
  it("devuelve vacío con JSON roto, versión ajena o formas ajenas", () => {
    expect(parseDraftStore(null)).toEqual({});
    expect(parseDraftStore("no-json")).toEqual({});
    expect(parseDraftStore(JSON.stringify({ version: 1, contexts: {} }))).toEqual({});
    expect(parseDraftStore(JSON.stringify({ version: 2, contexts: null }))).toEqual({});
    expect(parseDraftStore(JSON.stringify([1, 2]))).toEqual({});
  });

  it("sanea una entrada válida y recorta la nota", () => {
    const raw = JSON.stringify({
      version: 2,
      contexts: {
        "tias|s|c": {
          pricing: { h: { discountPct: 14 }, scenarioName: "Mi prueba", savedCopy: null },
          report: { decision: "prepare", note: "x".repeat(5000), selectedScenario: "abc" },
        },
      },
    });
    const parsed = parseDraftStore(raw);
    expect(parsed["tias|s|c"]?.pricing.h.discountPct).toBe(14);
    expect(parsed["tias|s|c"]?.pricing.h.rivalAPrice).toBe("106502.40");
    expect(parsed["tias|s|c"]?.report.decision).toBe("prepare");
    expect(parsed["tias|s|c"]?.report.note).toHaveLength(4000);
  });

  it("repara valores fuera de rango o decisión desconocida", () => {
    const raw = JSON.stringify({
      version: 2,
      contexts: {
        k: {
          pricing: { h: { discountPct: 99, noRivals: "sí" } },
          report: { decision: "maybe", selectedScenario: "" },
        },
      },
    });
    const parsed = parseDraftStore(raw);
    expect(parsed.k?.pricing.h.discountPct).toBe(5);
    expect(parsed.k?.pricing.h.noRivals).toBe(false);
    expect(parsed.k?.report.decision).toBeNull();
    expect(parsed.k?.report.selectedScenario).toBeNull();
  });

  it("sanea el borrador de empresa y sus filas", () => {
    const raw = JSON.stringify({
      version: 2,
      contexts: {
        k: {
          company: {
            name: "Mi pyme",
            direct: "70000",
            baseRevision: 4,
            addedEvidence: [
              { field_key: "k", value: "v", unit: "EUR", reference: "r" },
              { field_key: "", value: "sin clave" },
            ],
          },
        },
      },
    });
    const company = parseDraftStore(raw).k?.company;
    expect(company?.name).toBe("Mi pyme");
    expect(company?.baseRevision).toBe(4);
    expect(company?.addedEvidence).toHaveLength(1);
    expect(company?.addedEvidence[0]?.source_type).toBe("user_attestation");
  });

  it("descarta copias guardadas incompletas", () => {
    const raw = JSON.stringify({
      version: 2,
      contexts: { k: { pricing: { savedCopy: { id: "1", name: "x" } }, report: {} } },
    });
    expect(parseDraftStore(raw).k?.pricing.savedCopy).toBeNull();
  });
});

describe("serializeDraftStore", () => {
  it("limita el número de contextos guardados", () => {
    const store: Record<string, ReturnType<typeof defaultDrafts>> = {};
    for (let i = 0; i < 25; i += 1) store[`k${i}`] = defaultDrafts();
    const parsed = parseDraftStore(serializeDraftStore(store));
    expect(Object.keys(parsed)).toHaveLength(20);
    expect(parsed.k24).toBeDefined();
    expect(parsed.k0).toBeUndefined();
  });
});

describe("saveDraftStore (R04)", () => {
  function installMemoryStorage() {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        data.set(key, String(value));
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => data.clear(),
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size;
      },
    };
    vi.stubGlobal("localStorage", storage);
    return { data, storage };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("devuelve ok y persiste cuando hay sitio", () => {
    const { data } = installMemoryStorage();
    expect(saveDraftStore({ k: defaultDrafts() })).toBe("ok");
    expect(data.get("bidlab.drafts.v2")).toContain("contexts");
  });

  it("clasifica la cuota llena sin lanzar ni borrar lo anterior", () => {
    const { data, storage } = installMemoryStorage();
    saveDraftStore({ k: defaultDrafts() });
    const before = data.get("bidlab.drafts.v2");
    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    vi.spyOn(storage, "setItem").mockImplementationOnce(() => {
      throw quota;
    });
    expect(saveDraftStore({ k: defaultDrafts(), other: defaultDrafts() })).toBe("quota");
    expect(data.get("bidlab.drafts.v2")).toBe(before);
  });

  it("clasifica el acceso denegado", () => {
    const { storage } = installMemoryStorage();
    const denied = new Error("denied");
    denied.name = "SecurityError";
    vi.spyOn(storage, "setItem").mockImplementationOnce(() => {
      throw denied;
    });
    expect(saveDraftStore({ k: defaultDrafts() })).toBe("denied");
    expect(classifyPersistError({ code: 22 })).toBe("quota");
    expect(classifyPersistError(null)).toBe("denied");
  });
});
