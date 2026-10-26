"""Three-valued eligibility logic (met / not_met / unknown).

AND: not_met if any child fails; met if all met; else unknown.
OR: met if any child holds; not_met if all fail; else unknown.
NOT: flips met/not_met; unknown stays unknown. A missing document yields
unknown, never not_met. Empty AND is met and empty OR is not_met (vacuous).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import assert_never

__all__ = [
    "MAX_TREE_DEPTH",
    "And",
    "Leaf",
    "Node",
    "Not",
    "Or",
    "Verdict",
    "evaluate",
    "leaf_from_review",
    "leaf_missing_document",
]

# S2: shared bound for requirements-tree walkers (eligibility evaluation and
# scenario pending-items). Trees nest groups shallowly in practice; anything
# deeper than this is a corrupt or hostile payload, rejected with 422 before
# recursion can grow unbounded.
MAX_TREE_DEPTH = 32


class Verdict(StrEnum):
    MET = "met"
    NOT_MET = "not_met"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class Leaf:
    verdict: Verdict


@dataclass(frozen=True)
class And:
    children: tuple[Node, ...] = ()


@dataclass(frozen=True)
class Or:
    children: tuple[Node, ...] = ()


@dataclass(frozen=True)
class Not:
    child: Node


Node = Leaf | And | Or | Not

_NOT_TABLE: dict[Verdict, Verdict] = {
    Verdict.MET: Verdict.NOT_MET,
    Verdict.NOT_MET: Verdict.MET,
    Verdict.UNKNOWN: Verdict.UNKNOWN,
}


def evaluate(node: Node) -> Verdict:
    """Fold a requirement tree to a single three-valued verdict."""
    if isinstance(node, Leaf):
        return node.verdict
    if isinstance(node, Not):
        return _NOT_TABLE[evaluate(node.child)]
    if isinstance(node, And):
        seen_unknown = False
        for child in node.children:
            verdict = evaluate(child)
            if verdict is Verdict.NOT_MET:
                return Verdict.NOT_MET
            if verdict is Verdict.UNKNOWN:
                seen_unknown = True
        return Verdict.UNKNOWN if seen_unknown else Verdict.MET
    if isinstance(node, Or):
        seen_unknown = False
        for child in node.children:
            verdict = evaluate(child)
            if verdict is Verdict.MET:
                return Verdict.MET
            if verdict is Verdict.UNKNOWN:
                seen_unknown = True
        return Verdict.UNKNOWN if seen_unknown else Verdict.NOT_MET
    assert_never(node)


def leaf_from_review(
    *, rule_approved: bool, evidence_sufficient: bool, value_met: bool | None
) -> Leaf:
    """Build a leaf: computed only with a reviewed rule and sufficient evidence.

    Missing documents, unreviewed rules, manual conditions, or unresolved
    alternative means all yield unknown. A confirmed below-threshold value with
    sufficient evidence yields not_met for that leaf.
    """
    if not rule_approved or not evidence_sufficient:
        return Leaf(Verdict.UNKNOWN)
    if value_met is None:
        return Leaf(Verdict.UNKNOWN)
    return Leaf(Verdict.MET if value_met else Verdict.NOT_MET)


def leaf_missing_document() -> Leaf:
    """Absence of a document is unknown, never not_met."""
    return Leaf(Verdict.UNKNOWN)
