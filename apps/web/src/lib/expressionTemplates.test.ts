// Pins the canonical AST JSON: the backend rejects any stored AST that
// differs from its template (ast_template_mismatch), so these snapshots
// must match apps/api/bidlab/domain/expressions.py template_for exactly.

import { describe, expect, it } from "vitest";
import {
  linearDiscountTemplate,
  logRatioTemplate,
  proportionalInverseTemplate,
  TEMPLATE_COPY,
  templateExpression,
  TEMPLATE_IDS,
  type TemplateId,
} from "./expressionTemplates";

describe("expressionTemplates: canonical JSON", () => {
  it("pins proportional_inverse as max_points * best_price / own_price", () => {
    expect(proportionalInverseTemplate()).toEqual({
      kind: "call",
      op: "div",
      args: [
        {
          kind: "call",
          op: "mul",
          args: [
            { kind: "var", name: "max_points" },
            { kind: "var", name: "best_price" },
          ],
        },
        { kind: "var", name: "own_price" },
      ],
    });
  });

  it("pins linear_discount as max_points * (ref - own) / (ref - best)", () => {
    expect(linearDiscountTemplate()).toEqual({
      kind: "call",
      op: "div",
      args: [
        {
          kind: "call",
          op: "mul",
          args: [
            { kind: "var", name: "max_points" },
            {
              kind: "call",
              op: "sub",
              args: [
                { kind: "var", name: "reference_price" },
                { kind: "var", name: "own_price" },
              ],
            },
          ],
        },
        {
          kind: "call",
          op: "sub",
          args: [
            { kind: "var", name: "reference_price" },
            { kind: "var", name: "best_price" },
          ],
        },
      ],
    });
  });

  it("pins log_ratio as max_points * (1 + log10(best / own))", () => {
    expect(logRatioTemplate()).toEqual({
      kind: "call",
      op: "mul",
      args: [
        { kind: "var", name: "max_points" },
        {
          kind: "call",
          op: "add",
          args: [
            { kind: "const", value: "1" },
            {
              kind: "call",
              op: "log10",
              args: [
                {
                  kind: "call",
                  op: "div",
                  args: [
                    { kind: "var", name: "best_price" },
                    { kind: "var", name: "own_price" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("dispatches every template id to its canonical AST", () => {
    const ids: TemplateId[] = [...TEMPLATE_IDS];
    expect(ids).toEqual(["proportional_inverse", "linear_discount", "log_ratio"]);
    expect(templateExpression("proportional_inverse")).toEqual(proportionalInverseTemplate());
    expect(templateExpression("linear_discount")).toEqual(linearDiscountTemplate());
    expect(templateExpression("log_ratio")).toEqual(logRatioTemplate());
  });

  it("returns fresh objects so callers can embed them safely", () => {
    expect(templateExpression("proportional_inverse")).not.toBe(templateExpression("proportional_inverse"));
  });

  it("keeps template copy short, plain and free of jargon", () => {
    for (const id of TEMPLATE_IDS) {
      const copy = TEMPLATE_COPY[id];
      expect(copy.question.endsWith("?")).toBe(true);
      for (const text of [copy.question, copy.plain]) {
        expect(text.split(/\s+/).length).toBeLessThanOrEqual(20);
      }
      expect(`${copy.question} ${copy.plain}`).not.toContain(id);
      expect(`${copy.question} ${copy.plain}`).not.toMatch(/template|logarítmica|AST/i);
    }
  });
});
