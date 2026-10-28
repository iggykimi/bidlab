"""Atomic live-spend reservations. Amounts are integer micro-USD.

Adapted from the Plan Integral reference ledger to the app models: each
live attempt reserves a cost estimate before the network call, then
settles the reported cost (even above the estimate) or releases the hold
when nothing was sent.

Atomicity without ``BEGIN IMMEDIATE`` (which the SQLAlchemy/pysqlite
driver does not expose per connection): the admission check and the hold
move live in ONE conditional ``UPDATE`` on a single-row account, and
SQLite serializes concurrent writers, so the ``WHERE`` always evaluates
against committed state. Every operation commits on its own short
connection, separate from the long job transaction, so a hold is visible
to concurrent attempts immediately.

Fail-closed rules: a sent attempt without reported usage settles at the
estimate, never zero; an ``uncertain`` reservation blocks further
reserves until it settles. The ceiling always comes from the
``BIDLAB_META_BUDGET_USD`` setting, so admin changes apply to new
reserves; settled spend is never rewritten.
"""

from __future__ import annotations

import datetime as dt
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal, InvalidOperation
from typing import TYPE_CHECKING, Any

from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError

if TYPE_CHECKING:
    from sqlalchemy.engine import Connection, Engine

_MICRO = Decimal(1_000_000)

# Pre-call reservation assumes the provider output cap (PKG-T06): billed
# completions can never exceed max_completion_tokens, so admission blocks
# exactly what the attempt may spend.
_INPUT_CHARS_PER_TOKEN = 4


class BudgetBlockedError(Exception):
    """The attempt does not fit the available budget, or needs reconcile."""


class ReservationConflictError(Exception):
    """The reservation exists in an incompatible state, amount or receipt."""


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def budget_cap_micro_usd() -> int:
    """Configured ceiling in micro-USD (floored; garbage means zero)."""
    from bidlab.settings import get_settings

    try:
        cap = Decimal(get_settings().bidlab_meta_budget_usd)
    except InvalidOperation:
        return 0
    if cap < 0:
        return 0
    return int((cap * _MICRO).to_integral_value(rounding=ROUND_FLOOR))


def usd_str_to_micro(raw: str) -> int:
    """Parse a ``0.000001``-style cost string to micro-USD (ceiled)."""
    try:
        value = Decimal(raw)
    except InvalidOperation as exc:
        msg = f"invalid usd amount {raw!r}"
        raise ValueError(msg) from exc
    if value < 0:
        msg = f"invalid usd amount {raw!r}"
        raise ValueError(msg)
    return int((value * _MICRO).to_integral_value(rounding=ROUND_CEILING))


def estimate_attempt_micro_usd(input_chars: int) -> int:
    """Pre-call estimate: ~chars/4 input tokens plus the real output cap."""
    from bidlab.services import meta_adapter

    tokens_in = max(1, -(-max(0, input_chars) // _INPUT_CHARS_PER_TOKEN))
    cost = (
        Decimal(tokens_in) * meta_adapter.META_INPUT_USD_PER_MTOK
        + Decimal(meta_adapter.MAX_COMPLETION_TOKENS) * meta_adapter.META_OUTPUT_USD_PER_MTOK
    ) / _MICRO
    return max(1, int((cost * _MICRO).to_integral_value(rounding=ROUND_CEILING)))


def _get_reservation(conn: Connection, key: str) -> dict[str, Any] | None:
    row = (
        conn.execute(
            text("SELECT * FROM model_spend_reservation WHERE key = :key"),
            {"key": key},
        )
        .mappings()
        .first()
    )
    return dict(row) if row is not None else None


def totals(engine: Engine, *, ceiling_micro: int) -> dict[str, int]:
    """Settled spend, held estimates and availability under the ceiling."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT OR IGNORE INTO model_spend_account (id, held_micro_usd,"
                " spent_micro_usd) VALUES (1, 0, 0)"
            )
        )
        account = (
            conn.execute(
                text("SELECT held_micro_usd, spent_micro_usd FROM model_spend_account WHERE id = 1")
            )
            .mappings()
            .first()
        )
        if account is None:
            msg = "spend account row missing"
            raise ReservationConflictError(msg)
        uncertain = conn.execute(
            text("SELECT COUNT(*) FROM model_spend_reservation WHERE state = 'uncertain'")
        ).scalar_one()
    spent = int(account["spent_micro_usd"])
    held = int(account["held_micro_usd"])
    return {
        "ceiling": ceiling_micro,
        "spent": spent,
        "held": held,
        "available": ceiling_micro - spent - held,
        "uncertain": int(uncertain),
    }


def reserve(
    engine: Engine, *, key: str, job_id: str, amount_micro: int, ceiling_micro: int
) -> dict[str, Any]:
    """Hold ``amount_micro`` for one attempt, or raise :class:`BudgetBlockedError`.

    Idempotent for the same key + amount (returns the existing row); a
    different amount for a known key raises :class:`ReservationConflictError`.
    """
    if not key or amount_micro <= 0:
        msg = "key and a positive reservation amount are required"
        raise ValueError(msg)
    try:
        with engine.begin() as conn:
            existing = _get_reservation(conn, key)
            if existing is not None:
                if existing["amount_micro_usd"] != amount_micro:
                    msg = "idempotency key changed reservation"
                    raise ReservationConflictError(msg)
                return existing
            conn.execute(
                text(
                    "INSERT OR IGNORE INTO model_spend_account (id, held_micro_usd,"
                    " spent_micro_usd) VALUES (1, 0, 0)"
                )
            )
            admitted = conn.execute(
                text(
                    "UPDATE model_spend_account"
                    " SET held_micro_usd = held_micro_usd + :amount"
                    " WHERE id = 1"
                    " AND held_micro_usd + spent_micro_usd + :amount <= :ceiling"
                    " AND (SELECT COUNT(*) FROM model_spend_reservation"
                    " WHERE state = 'uncertain') = 0"
                ),
                {"amount": amount_micro, "ceiling": ceiling_micro},
            )
            if admitted.rowcount != 1:
                msg = "insufficient unreserved budget"
                raise BudgetBlockedError(msg)
            conn.execute(
                text(
                    "INSERT INTO model_spend_reservation"
                    " (key, job_id, amount_micro_usd, state, created_at)"
                    " VALUES (:key, :job_id, :amount, 'reserved', :now)"
                ),
                {"key": key, "job_id": job_id, "amount": amount_micro, "now": _now()},
            )
            created = _get_reservation(conn, key)
            if created is None:
                msg = "reservation insert did not persist"
                raise ReservationConflictError(msg)
            return created
    except IntegrityError:
        # Lost a same-key race: the winner committed; apply idempotency rules.
        with engine.connect() as conn:
            winner = _get_reservation(conn, key)
        if winner is None or winner["amount_micro_usd"] != amount_micro:
            msg = "idempotency key changed reservation"
            raise ReservationConflictError(msg) from None
        return winner


def _transition(engine: Engine, key: str, allowed: tuple[str, ...], target: str) -> None:
    stmt = text(
        "UPDATE model_spend_reservation SET state = :target WHERE key = :key AND state IN :states"
    ).bindparams(bindparam("states", expanding=True))
    with engine.begin() as conn:
        moved = conn.execute(stmt, {"target": target, "key": key, "states": list(allowed)})
        if moved.rowcount != 1:
            msg = "invalid attempt transition"
            raise ReservationConflictError(msg)


def mark_sent(engine: Engine, key: str) -> None:
    _transition(engine, key, ("reserved",), "sent")


def mark_uncertain(engine: Engine, key: str) -> None:
    _transition(engine, key, ("sent",), "uncertain")


def release_before_send(engine: Engine, key: str) -> None:
    with engine.begin() as conn:
        moved = conn.execute(
            text(
                "UPDATE model_spend_reservation SET state = 'released'"
                " WHERE key = :key AND state = 'reserved'"
            ),
            {"key": key},
        )
        if moved.rowcount != 1:
            msg = "invalid attempt transition"
            raise ReservationConflictError(msg)
        conn.execute(
            text(
                "UPDATE model_spend_account"
                " SET held_micro_usd = held_micro_usd -"
                " (SELECT amount_micro_usd FROM model_spend_reservation"
                " WHERE key = :key) WHERE id = 1"
            ),
            {"key": key},
        )


def settle(engine: Engine, key: str, *, actual_micro: int, receipt: str) -> dict[str, int]:
    """Book the real cost of a sent attempt. Overspend is kept, never clipped.

    Idempotent for the same actual + receipt; anything else on a settled
    row raises :class:`ReservationConflictError`.
    """
    if actual_micro < 0 or not receipt:
        msg = "non-negative actual and a receipt identifier are required"
        raise ValueError(msg)
    with engine.begin() as conn:
        row = _get_reservation(conn, key)
        if row is None:
            msg = "unknown reservation"
            raise ReservationConflictError(msg)
        if row["state"] == "settled":
            if row["actual_micro_usd"] != actual_micro or row["receipt"] != receipt:
                msg = "receipt changed"
                raise ReservationConflictError(msg)
            spent = conn.execute(
                text("SELECT spent_micro_usd FROM model_spend_account WHERE id = 1")
            ).scalar_one()
            return {"spent": int(spent)}
        if row["state"] not in ("sent", "uncertain"):
            msg = "attempt was not sent"
            raise ReservationConflictError(msg)
        conn.execute(
            text(
                "UPDATE model_spend_reservation"
                " SET state = 'settled', actual_micro_usd = :actual,"
                " receipt = :receipt WHERE key = :key"
            ),
            {"actual": actual_micro, "receipt": receipt, "key": key},
        )
        conn.execute(
            text(
                "UPDATE model_spend_account"
                " SET held_micro_usd = held_micro_usd - :amount,"
                " spent_micro_usd = spent_micro_usd + :actual WHERE id = 1"
            ),
            {"amount": row["amount_micro_usd"], "actual": actual_micro},
        )
        spent = conn.execute(
            text("SELECT spent_micro_usd FROM model_spend_account WHERE id = 1")
        ).scalar_one()
        return {"spent": int(spent)}
