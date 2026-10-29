import { afterEach, describe, expect, it, vi } from "vitest";
import type { PricingRule, Workspace } from "../../api/client";
import type { StoredSession } from "../../lib/session";
import {
  appendReviewHistory,
  loadReviewHistory,
} from "./reviewHistory";
import {
  approvedPricingRule,
  hasOwnCompany,
  isOwnTender,
  isTerminalJobStatus,
  jobStatusEs,
  jobWarningEs,
  nextRuleRevision,
  ownChecklist,
  ruleIdFor,
} from "./ownTender";

function makeRule(reviewStatus: PricingRule["review_status"]): PricingRule {
  return {
    id: "t1-rule-1",
    revision: 1,
    scope_id: "t1-whole",
    template_id: "proportional_inverse",
    max_points: "49",
    expression: null,
    review_status: reviewStatus,
    zero_denominator_policy: "unknown",
    evidence_ids: [],
    anomaly_policy: {
      id: "t1-rule-1-anomaly",
      source_kind: "unknown",
      variant: "unsupported",
      review_status: reviewStatus,
      three_bidder_absolute_25: false,
      percentage_reduction_one_third: false,
      evidence_ids: [],
    },
  };
}

function makeSession(mode: StoredSession["mode"], tenderId: string): StoredSession {
  return { tender_id: tenderId, scope_id: `${tenderId}-whole`, company_id: "c1", mode, createdAt: "" };
}

describe("isOwnTender", () => {
  it("treats source_id === id as your own intake, feed URLs as curated", () => {
    expect(isOwnTender({ id: "abc123", source_id: "abc123" })).toBe(true);
    expect(
      isOwnTender({ id: "tias", source_id: "https://contrataciondelestado.es/sindicacion/20777838" })
    ).toBe(false);
  });
});

describe("approvedPricingRule", () => {
  it("finds the approved rule and ignores pending or blocked ones", () => {
    const ws = { pricing_rules: [makeRule("pending"), makeRule("approved")] } as Pick<
      Workspace,
      "pricing_rules"
    >;
    expect(approvedPricingRule(ws)?.review_status).toBe("approved");
    expect(approvedPricingRule({ pricing_rules: [makeRule("pending")] })).toBeNull();
    expect(approvedPricingRule({ pricing_rules: [] })).toBeNull();
  });
});

describe("ruleIdFor and nextRuleRevision", () => {
  it("keeps a stable id and starts at revision 1", () => {
    expect(ruleIdFor("t1")).toBe("t1-rule-1");
    expect(nextRuleRevision([], "t1-rule-1")).toBe(1);
  });

  it("bumps past the highest existing revision of the same id", () => {
    const rules = [
      { id: "t1-rule-1", revision: 1 },
      { id: "other-rule", revision: 9 },
      { id: "t1-rule-1", revision: 2 },
    ];
    expect(nextRuleRevision(rules, "t1-rule-1")).toBe(3);
    expect(nextRuleRevision(rules, "other-rule")).toBe(10);
  });
});

describe("hasOwnCompany", () => {
  it("requires a manual session pointing at this tender", () => {
    expect(hasOwnCompany(makeSession("manual", "t1"), "t1")).toBe(true);
    expect(hasOwnCompany(makeSession("manual", "t1"), "t2")).toBe(false);
    expect(hasOwnCompany(makeSession("demo", "t1"), "t1")).toBe(false);
    expect(hasOwnCompany(null, "t1")).toBe(false);
  });
});

describe("ownChecklist", () => {
  it("tracks Empresa -> Revisar -> Simular independently", () => {
    const ws = { pricing_rules: [makeRule("approved")] } as Pick<Workspace, "pricing_rules">;
    expect(
      ownChecklist({ workspace: ws, session: makeSession("manual", "t1"), tenderId: "t1", hasSavedCopy: true })
    ).toEqual({ company: true, review: true, simulated: true });
    expect(
      ownChecklist({ workspace: { pricing_rules: [] }, session: null, tenderId: "t1", hasSavedCopy: false })
    ).toEqual({ company: false, review: false, simulated: false });
  });
});

describe("job copy", () => {
  it("translates every job status to Spanish", () => {
    expect(jobStatusEs("queued")).toBe("En cola");
    expect(jobStatusEs("running")).toBe("En marcha");
    expect(jobStatusEs("succeeded")).toBe("Lista");
    expect(jobStatusEs("needs_review")).toBe("Lista para revisar");
    expect(jobStatusEs("failed")).toBe("Falló");
    expect(jobStatusEs("cancelled")).toBe("Cancelada");
    expect(jobStatusEs("mystery")).toBe("mystery");
  });

  it("stops polling only on terminal states", () => {
    for (const s of ["succeeded", "needs_review", "failed", "cancelled"]) {
      expect(isTerminalJobStatus(s)).toBe(true);
    }
    for (const s of ["queued", "running"]) {
      expect(isTerminalJobStatus(s)).toBe(false);
    }
  });

  it("explains offline warnings honestly and passes the rest through", () => {
    expect(jobWarningEs("fixture_stub: offline deterministic stub; no model was called")).toBe(
      "Sin propuestas automáticas; revisa a mano."
    );
    expect(jobWarningEs("demo: proposal is empty until a live extraction plus human review")).toBe(
      "La propuesta viene vacía; revísala a mano."
    );
    expect(jobWarningEs("citation 0: quote not found on doc p.3")).toBe(
      "citation 0: quote not found on doc p.3"
    );
  });

  it("translates the partial-coverage warnings job by job", () => {
    expect(
      jobWarningEs("document d1: 6 of 8 pages submitted to Meta (partial coverage)")
    ).toBe("Documento d1: se enviaron 6 de 8 páginas a Meta. Cobertura parcial.");
    expect(
      jobWarningEs("document d1: 6 of 8 page records available for local extraction")
    ).toBe("Documento d1: hay registros locales de 6 de 8 páginas.");
  });
});

describe("reviewHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function installMemoryStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        data.set(key, String(value));
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => data.clear(),
    });
  }

  it("records your approvals per tender with actor, reason and date", () => {
    installMemoryStorage();
    expect(loadReviewHistory("t1")).toEqual([]);
    const entry = appendReviewHistory({ tenderId: "t1", revision: 2, actor: "usuario", reason: "vale" });
    expect(entry.createdAt).not.toBe("");
    appendReviewHistory({ tenderId: "t2", revision: 1, actor: "usuario", reason: "otra" });
    const entries = loadReviewHistory("t1");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ tenderId: "t1", revision: 2, actor: "usuario", reason: "vale" });
  });
});
