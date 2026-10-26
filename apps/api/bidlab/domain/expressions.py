"""Safe expression AST: whitelist add/sub/mul/div/min/max/log10.

No eval, exec, ast.parse, imports, attribute calls, lambdas, file/net access,
or string interpolation into expressions. Recursive enum/arity validation with
depth <= 12, nodes <= 128 (unique nodes for in-memory DAGs), ops <= 256 per
evaluation. Division by zero yields unknown (never inf/nan/epsilon); log10
requires an argument > 0; overflow/non-finite is a documented domain error.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from bidlab.domain.money import DecimalInput, MoneyError, arithmetic, parse_decimal

MAX_DEPTH = 12
MAX_NODES = 128
MAX_OPS = 256
MAX_CONST_ABS = Decimal(10) ** 12

ALLOWED_VARS = frozenset({"own_price", "best_price", "reference_price", "max_points"})
BINARY_OPS = frozenset({"add", "sub", "mul", "div"})
VARIADIC_OPS = frozenset({"min", "max"})
ALLOWED_OPS = BINARY_OPS | VARIADIC_OPS | {"log10"}


class ExprError(ValueError):
    """Safe rejection of an expression (shape, limits, or domain error)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Const:
    value: Decimal


@dataclass(frozen=True)
class Var:
    name: str


@dataclass(frozen=True)
class Call:
    op: str
    args: tuple[Expr, ...]


Expr = Const | Var | Call


@dataclass(frozen=True)
class EvalValue:
    value: Decimal
    ops: int
    trace: tuple[str, ...]


@dataclass(frozen=True)
class EvalUnknown:
    reason: str
    trace: tuple[str, ...]


def _check_const(value: Decimal) -> None:
    if not value.is_finite():
        raise ExprError("const_non_finite", "const: non-finite value")
    if abs(value) > MAX_CONST_ABS:
        raise ExprError("const_too_large", "const: magnitude exceeds 10^12")


def _check_arity(op: str, count: int) -> None:
    if op in BINARY_OPS:
        if count != 2:
            raise ExprError("arity", f"{op}: requires exactly 2 args, got {count}")
    elif op in VARIADIC_OPS:
        if count < 2 or count > 8:
            raise ExprError("arity", f"{op}: requires 2..8 args, got {count}")
    elif op == "log10":
        if count != 1:
            raise ExprError("arity", f"log10: requires exactly 1 arg, got {count}")
    else:
        raise ExprError("unknown_op", f"call: unknown op {op!r}")


def validate_expr(expr: Expr) -> None:
    """Validate an in-memory expression: enums, arity, depth, nodes, cycles."""
    depths: dict[int, int] = {}
    seen: set[int] = set()
    count = 0

    def visit(node: Expr, path: frozenset[int]) -> int:
        nonlocal count
        key = id(node)
        if key in path:
            raise ExprError("cycle", "expression: cyclic reference rejected")
        cached = depths.get(key)
        if cached is not None:
            return cached
        if isinstance(node, Const):
            _check_const(node.value)
            depth = 1
        elif isinstance(node, Var):
            if node.name not in ALLOWED_VARS:
                raise ExprError("unknown_variable", f"var: unknown name {node.name!r}")
            depth = 1
        elif isinstance(node, Call):
            _check_arity(node.op, len(node.args))
            if node.op == "log10":
                child = node.args[0]
                if isinstance(child, Const) and child.value <= 0:
                    raise ExprError("log_non_positive", "log10: const argument must be > 0")
            child_path = path | {key}
            depth = 1 + max((visit(child, child_path) for child in node.args), default=0)
        else:
            raise ExprError("bad_node", "expression: unknown node type")
        if depth > MAX_DEPTH:
            raise ExprError("max_depth", f"expression: depth exceeds {MAX_DEPTH}")
        if key not in seen:
            seen.add(key)
            count += 1
            if count > MAX_NODES:
                raise ExprError("too_many_nodes", f"expression: nodes exceed {MAX_NODES}")
        depths[key] = depth
        return depth

    visit(expr, frozenset())


def parse_expr(data: object) -> Expr:
    """Parse and validate a JSON expression object into a canonical AST."""
    count = 0

    def build(node: object, depth: int) -> Expr:
        nonlocal count
        if depth > MAX_DEPTH:
            raise ExprError("max_depth", f"expression: depth exceeds {MAX_DEPTH}")
        if not isinstance(node, dict):
            raise ExprError("bad_shape", "expression: node must be an object")
        raw_kind: object = node.get("kind")
        if raw_kind == "const":
            if set(node.keys()) != {"kind", "value"}:
                raise ExprError("bad_shape", "const: keys must be exactly kind,value")
            raw_value: object = node["value"]
            if isinstance(raw_value, bool | float):
                raise ExprError("const_float_forbidden", "const: float/bool value forbidden")
            if not isinstance(raw_value, str | int | Decimal):
                raise ExprError("const_bad_type", "const: value must be a decimal string")
            try:
                value = parse_decimal(raw_value, field="value")
            except MoneyError as exc:
                raise ExprError(exc.code, f"const: {exc}") from None
            _check_const(value)
            count += 1
            if count > MAX_NODES:
                raise ExprError("too_many_nodes", f"expression: nodes exceed {MAX_NODES}")
            return Const(value=value)
        if raw_kind == "var":
            if set(node.keys()) != {"kind", "name"}:
                raise ExprError("bad_shape", "var: keys must be exactly kind,name")
            name: object = node["name"]
            if not isinstance(name, str) or name not in ALLOWED_VARS:
                raise ExprError("unknown_variable", f"var: unknown name {name!r}")
            count += 1
            if count > MAX_NODES:
                raise ExprError("too_many_nodes", f"expression: nodes exceed {MAX_NODES}")
            return Var(name=name)
        if raw_kind == "call":
            if set(node.keys()) != {"kind", "op", "args"}:
                raise ExprError("bad_shape", "call: keys must be exactly kind,op,args")
            op: object = node["op"]
            raw_args: object = node["args"]
            if not isinstance(op, str) or op not in ALLOWED_OPS:
                raise ExprError("unknown_op", f"call: unknown op {op!r}")
            if not isinstance(raw_args, list):
                raise ExprError("bad_shape", "call: args must be an array")
            _check_arity(op, len(raw_args))
            args = tuple(build(child, depth + 1) for child in raw_args)
            count += 1
            if count > MAX_NODES:
                raise ExprError("too_many_nodes", f"expression: nodes exceed {MAX_NODES}")
            return Call(op=op, args=args)
        raise ExprError("bad_kind", f"expression: unknown kind {raw_kind!r}")

    expr = build(data, 1)
    validate_expr(expr)
    return expr


def required_vars(expr: Expr) -> frozenset[str]:
    """Variable names referenced by an expression (cycle-safe)."""
    names: set[str] = set()
    seen: set[int] = set()
    stack: list[Expr] = [expr]
    while stack:
        node = stack.pop()
        key = id(node)
        if key in seen:
            continue
        seen.add(key)
        if isinstance(node, Var):
            names.add(node.name)
        elif isinstance(node, Call):
            stack.extend(node.args)
    return frozenset(names)


def _render(value: Decimal) -> str:
    return format(value, "f")


def evaluate(expr: Expr, variables: dict[str, DecimalInput]) -> EvalValue | EvalUnknown:
    """Evaluate a validated expression. Divisor 0 yields unknown, never inf/nan."""
    bound: dict[str, Decimal] = {}
    for name, raw in variables.items():
        if name not in ALLOWED_VARS:
            continue
        try:
            bound[name] = parse_decimal(raw, field=name)
        except MoneyError as exc:
            raise ExprError(exc.code, f"variable {name}: {exc}") from None
    trace: list[str] = []
    ops = 0

    def ev(node: Expr, path: frozenset[int]) -> Decimal | EvalUnknown:
        nonlocal ops
        key = id(node)
        if key in path:
            raise ExprError("cycle", "expression: cyclic reference rejected")
        if isinstance(node, Const):
            return node.value
        if isinstance(node, Var):
            if node.name not in bound:
                raise ExprError("missing_variable", f"evaluate: no value for {node.name}")
            return bound[node.name]
        if not isinstance(node, Call):
            raise ExprError("bad_node", "expression: unknown node type")
        child_path = path | {key}
        values: list[Decimal] = []
        for child in node.args:
            outcome = ev(child, child_path)
            if isinstance(outcome, EvalUnknown):
                return outcome
            values.append(outcome)
        ops += 1
        if ops > MAX_OPS:
            raise ExprError("too_many_ops", f"evaluate: operations exceed {MAX_OPS}")
        rendered = ", ".join(_render(v) for v in values)
        if node.op == "div" and values[1] == 0:
            trace.append(f"div({rendered}) = unknown:zero_denominator")
            return EvalUnknown(reason="zero_denominator", trace=tuple(trace))
        with arithmetic():
            if node.op == "add":
                result = values[0] + values[1]
            elif node.op == "sub":
                result = values[0] - values[1]
            elif node.op == "mul":
                result = values[0] * values[1]
            elif node.op == "div":
                result = values[0] / values[1]
            elif node.op == "min":
                result = min(values)
            elif node.op == "max":
                result = max(values)
            elif node.op == "log10":
                if values[0] <= 0:
                    raise ExprError("log_non_positive", "log10: argument must be > 0")
                result = values[0].log10()
            else:  # pragma: no cover - validate_expr rejects unknown ops first
                raise ExprError("unknown_op", f"call: unknown op {node.op!r}")
        if not result.is_finite():
            raise ExprError("domain_non_finite", f"{node.op}: non-finite result")
        trace.append(f"{node.op}({rendered}) = {_render(result)}")
        return result

    outcome = ev(expr, frozenset())
    if isinstance(outcome, EvalUnknown):
        return outcome
    return EvalValue(value=outcome, ops=ops, trace=tuple(trace))


def inverse_template() -> Expr:
    """S(P) = max_points * best_price / own_price."""
    expr = Call(
        op="div",
        args=(
            Call(
                op="mul",
                args=(Var(name="max_points"), Var(name="best_price")),
            ),
            Var(name="own_price"),
        ),
    )
    validate_expr(expr)
    return expr


def linear_template() -> Expr:
    """S(P) = max_points * (reference_price - own_price) / (reference_price - best_price)."""
    expr = Call(
        op="div",
        args=(
            Call(
                op="mul",
                args=(
                    Var(name="max_points"),
                    Call(
                        op="sub",
                        args=(Var(name="reference_price"), Var(name="own_price")),
                    ),
                ),
            ),
            Call(
                op="sub",
                args=(Var(name="reference_price"), Var(name="best_price")),
            ),
        ),
    )
    validate_expr(expr)
    return expr


def log_ratio_template() -> Expr:
    """S(P) = max_points * (1 + log10(best_price / own_price)); no silent clamp."""
    expr = Call(
        op="mul",
        args=(
            Var(name="max_points"),
            Call(
                op="add",
                args=(
                    Const(value=Decimal(1)),
                    Call(
                        op="log10",
                        args=(
                            Call(
                                op="div",
                                args=(Var(name="best_price"), Var(name="own_price")),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    )
    validate_expr(expr)
    return expr


def template_for(name: str) -> Expr:
    """Canonical AST for a template id (math only; activation is a review decision)."""
    if name == "proportional_inverse":
        return inverse_template()
    if name == "linear_discount":
        return linear_template()
    if name == "log_ratio":
        return log_ratio_template()
    raise ExprError("unknown_template", f"template: unknown id {name!r}")


__all__: list[str] = [
    "ALLOWED_OPS",
    "ALLOWED_VARS",
    "MAX_CONST_ABS",
    "MAX_DEPTH",
    "MAX_NODES",
    "MAX_OPS",
    "Call",
    "Const",
    "EvalUnknown",
    "EvalValue",
    "Expr",
    "ExprError",
    "Var",
    "evaluate",
    "inverse_template",
    "linear_template",
    "log_ratio_template",
    "parse_expr",
    "required_vars",
    "template_for",
    "validate_expr",
]
