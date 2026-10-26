"""U07: safe-expression whitelist, limits, and no-execution rejections."""

from __future__ import annotations

from decimal import Decimal

import pytest
from bidlab.domain.expressions import (
    Call,
    Const,
    EvalUnknown,
    EvalValue,
    ExprError,
    Var,
    evaluate,
    inverse_template,
    linear_template,
    log_ratio_template,
    parse_expr,
    required_vars,
    template_for,
    validate_expr,
)

INVERSE_JSON: dict[str, object] = {
    "kind": "call",
    "op": "div",
    "args": [
        {
            "kind": "call",
            "op": "mul",
            "args": [
                {"kind": "var", "name": "max_points"},
                {"kind": "var", "name": "best_price"},
            ],
        },
        {"kind": "var", "name": "own_price"},
    ],
}


def test_parse_inverse_json_shape() -> None:
    assert parse_expr(INVERSE_JSON) == inverse_template()
    assert required_vars(inverse_template()) == {"max_points", "best_price", "own_price"}
    assert required_vars(linear_template()) == {
        "max_points",
        "reference_price",
        "own_price",
        "best_price",
    }
    assert template_for("log_ratio") == log_ratio_template()
    with pytest.raises(ExprError):
        template_for("nope")


def test_reject_non_expression_inputs() -> None:
    for bad in [
        {"kind": "eval", "code": "1+1"},
        {"kind": "call", "op": "import", "args": [{"kind": "var", "name": "own_price"}]},
        {"kind": "call", "op": "getattr", "args": [{"kind": "var", "name": "own_price"}]},
        {"kind": "var", "name": "__class__"},
        {"kind": "var", "name": "profit"},
        {"kind": "var", "name": "own_price", "extra": 1},
        {"kind": "const", "value": "1.5", "extra": 1},
        {"kind": "call", "op": "add", "args": []},
        {"kind": "call", "op": "add", "args": [{"kind": "const", "value": "1"}]},
        {
            "kind": "call",
            "op": "add",
            "args": [
                {"kind": "const", "value": "1"},
                {"kind": "const", "value": "2"},
                {"kind": "const", "value": "3"},
            ],
        },
        {
            "kind": "call",
            "op": "min",
            "args": [{"kind": "const", "value": "1"}],
        },
        {
            "kind": "call",
            "op": "max",
            "args": [{"kind": "const", "value": "1"}] * 9,
        },
        {
            "kind": "call",
            "op": "log10",
            "args": [{"kind": "const", "value": "2"}, {"kind": "const", "value": "3"}],
        },
        {"kind": "const", "value": 1.5},
        {"kind": "const", "value": True},
        {"kind": "const", "value": "10000000000000"},
        {"kind": "const", "value": "NaN"},
        {"kind": "call", "op": "log10", "args": [{"kind": "const", "value": "0"}]},
        {"kind": "call", "op": "log10", "args": [{"kind": "const", "value": "-2"}]},
        ["not", "an", "object"],
        "add(1,2)",
        None,
        42,
    ]:
        with pytest.raises(ExprError):
            parse_expr(bad)


def _nested_add(depth_calls: int) -> object:
    node: object = {"kind": "var", "name": "own_price"}
    for _ in range(depth_calls):
        node = {"kind": "call", "op": "add", "args": [node, {"kind": "const", "value": "0"}]}
    return node


def test_depth_boundary() -> None:
    parse_expr(_nested_add(11))  # depth 12: allowed
    with pytest.raises(ExprError) as exc:
        parse_expr(_nested_add(12))  # depth 13: rejected
    assert exc.value.code == "max_depth"


def _wide_tree(n_consts: int) -> object:
    level: list[object] = [{"kind": "const", "value": "1"} for _ in range(n_consts)]
    while len(level) > 8:
        grouped: list[object] = []
        for index in range(0, len(level), 8):
            chunk = level[index : index + 8]
            if len(chunk) == 1:
                grouped.append(chunk[0])
            else:
                grouped.append({"kind": "call", "op": "max", "args": chunk})
        level = grouped
    if len(level) == 1:
        return level[0]
    return {"kind": "call", "op": "max", "args": level}


def test_node_limit() -> None:
    parse_expr(_wide_tree(110))  # 110 + 14 + 2 + 1 = 127 nodes, depth 4: allowed
    with pytest.raises(ExprError) as exc:
        parse_expr(_wide_tree(120))  # 120 + 15 + 2 + 1 = 138 nodes: rejected
    assert exc.value.code == "too_many_nodes"


def test_ops_budget_with_sharing() -> None:
    shared: Const | Var | Call = Var(name="own_price")
    for _ in range(9):
        shared = Call(op="mul", args=(shared, shared))
    validate_expr(shared)  # 10 unique nodes, depth 10: static limits pass
    with pytest.raises(ExprError) as exc:
        evaluate(shared, {"own_price": Decimal(2)})
    assert exc.value.code == "too_many_ops"


def test_cycle_rejected() -> None:
    cyclic = Call(op="add", args=(Var(name="own_price"), Var(name="own_price")))
    object.__setattr__(cyclic, "args", (cyclic, Var(name="own_price")))
    with pytest.raises(ExprError) as exc:
        validate_expr(cyclic)
    assert exc.value.code == "cycle"
    with pytest.raises(ExprError):
        evaluate(cyclic, {"own_price": Decimal(1)})


def test_div_by_zero_is_unknown_never_infinite() -> None:
    expr = parse_expr(
        {
            "kind": "call",
            "op": "add",
            "args": [
                {
                    "kind": "call",
                    "op": "div",
                    "args": [
                        {"kind": "var", "name": "max_points"},
                        {"kind": "call", "op": "sub", "args": [
                            {"kind": "var", "name": "own_price"},
                            {"kind": "var", "name": "own_price"},
                        ]},
                    ],
                },
                {"kind": "const", "value": "5"},
            ],
        }
    )
    outcome = evaluate(expr, {"max_points": Decimal(49), "own_price": Decimal(95)})
    assert isinstance(outcome, EvalUnknown)
    assert outcome.reason == "zero_denominator"
    assert "inf" not in "".join(outcome.trace).lower()
    assert "nan" not in "".join(outcome.trace).lower()


def test_log_domain() -> None:
    expr = parse_expr(
        {"kind": "call", "op": "log10", "args": [{"kind": "var", "name": "own_price"}]}
    )
    with pytest.raises(ExprError) as exc:
        evaluate(expr, {"own_price": Decimal(0)})
    assert exc.value.code == "log_non_positive"
    with pytest.raises(ExprError):
        evaluate(expr, {"own_price": Decimal("-3")})
    exact = parse_expr(
        {"kind": "call", "op": "log10", "args": [{"kind": "const", "value": "1000"}]}
    )
    outcome = evaluate(exact, {})
    assert isinstance(outcome, EvalValue)
    assert outcome.value == Decimal(3)


def test_min_max_and_trace() -> None:
    expr = parse_expr(
        {
            "kind": "call",
            "op": "max",
            "args": [
                {"kind": "const", "value": "3"},
                {
                    "kind": "call",
                    "op": "min",
                    "args": [
                        {"kind": "const", "value": "1"},
                        {"kind": "const", "value": "2"},
                        {"kind": "var", "name": "own_price"},
                    ],
                },
            ],
        }
    )
    outcome = evaluate(expr, {"own_price": Decimal(5)})
    assert isinstance(outcome, EvalValue)
    assert outcome.value == Decimal(3)
    assert outcome.ops == 2
    assert len(outcome.trace) == 2
    assert "min(1, 2, 5) = 1" in outcome.trace


def test_missing_and_float_variables() -> None:
    with pytest.raises(ExprError) as exc:
        evaluate(inverse_template(), {"own_price": Decimal(95)})
    assert exc.value.code == "missing_variable"
    with pytest.raises(ExprError):
        evaluate(inverse_template(), {"own_price": 95.0})  # type: ignore[dict-item]
