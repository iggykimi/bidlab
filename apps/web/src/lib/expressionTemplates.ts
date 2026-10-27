// Canonical scoring-formula ASTs for manual review of own tenders.
// Exact frontend copy of apps/api/bidlab/domain/expressions.py template_for
// (inverse_template, linear_template, log_ratio_template). The backend
// rejects any stored AST that differs from its template
// (evaluation._expression -> ast_template_mismatch), so these objects must
// stay byte-identical to the Python originals. Display only the plain
// explanations; template ids never reach the UI (copy-style-es, glosario).

import type { components } from "../api/generated";

export type Expr = components["schemas"]["Expr"];
export type TemplateId = "proportional_inverse" | "linear_discount" | "log_ratio";

export const TEMPLATE_IDS: TemplateId[] = ["proportional_inverse", "linear_discount", "log_ratio"];

/** S(P) = max_points * best_price / own_price. */
export function proportionalInverseTemplate(): Expr {
  return {
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
  };
}

/** S(P) = max_points * (reference_price - own_price) / (reference_price - best_price). */
export function linearDiscountTemplate(): Expr {
  return {
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
            args: [{ kind: "var", name: "reference_price" }, { kind: "var", name: "own_price" }],
          },
        ],
      },
      {
        kind: "call",
        op: "sub",
        args: [{ kind: "var", name: "reference_price" }, { kind: "var", name: "best_price" }],
      },
    ],
  };
}

/** S(P) = max_points * (1 + log10(best_price / own_price)); no silent clamp. */
export function logRatioTemplate(): Expr {
  return {
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
  };
}

/** Canonical AST for a template id. Fresh objects every call: callers may embed them. */
export function templateExpression(id: TemplateId): Expr {
  if (id === "proportional_inverse") return proportionalInverseTemplate();
  if (id === "linear_discount") return linearDiscountTemplate();
  return logRatioTemplate();
}

/** Plain question + explanation per template (≤20 words each, tú, no jerga). */
export const TEMPLATE_COPY: Record<TemplateId, { question: string; plain: string }> = {
  proportional_inverse: {
    question: "¿La oferta más barata se lleva todos los puntos?",
    plain: "La más barata suma el máximo. Las demás bajan en proporción a su precio.",
  },
  linear_discount: {
    question: "¿Los puntos bajan en línea recta entre dos precios?",
    plain: "Eliges esta si tu pliego reparte los puntos de forma proporcional entre topes.",
  },
  log_ratio: {
    question: "¿Las rebajas grandes pesan cada vez menos?",
    plain: "Eliges esta si tu pliego da menos valor a cada euro extra de rebaja.",
  },
};
