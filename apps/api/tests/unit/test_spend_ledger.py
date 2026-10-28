"""PKG-T02: atomic live-spend reservations ledger."""

import threading
from pathlib import Path

import pytest
from bidlab.db import models
from bidlab.services import budget as budget_service
from bidlab.settings import get_settings
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


@pytest.fixture()
def engine(tmp_path: Path) -> Engine:
    eng = create_engine(f"sqlite:///{tmp_path}/ledger.sqlite3")
    models.Base.metadata.create_all(eng)
    return eng


def test_reserve_and_totals(engine: Engine) -> None:
    budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000)
    budget_service.reserve(engine, key="a2", job_id="j1", amount_micro=200, ceiling_micro=1000)
    totals = budget_service.totals(engine, ceiling_micro=1000)
    assert (totals["spent"], totals["held"], totals["available"]) == (0, 300, 700)


def test_reserve_idempotent_same_amount(engine: Engine) -> None:
    first = budget_service.reserve(
        engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000
    )
    second = budget_service.reserve(
        engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000
    )
    assert first == second


def test_reserve_conflict_on_changed_amount(engine: Engine) -> None:
    budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000)
    with pytest.raises(budget_service.ReservationConflictError):
        budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=200, ceiling_micro=1000)


def test_reserve_blocked_when_insufficient(engine: Engine) -> None:
    budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=900, ceiling_micro=1000)
    with pytest.raises(budget_service.BudgetBlockedError):
        budget_service.reserve(engine, key="a2", job_id="j1", amount_micro=200, ceiling_micro=1000)
    assert budget_service.totals(engine, ceiling_micro=1000)["held"] == 900


def test_uncertain_blocks_until_settled(engine: Engine) -> None:
    budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000)
    budget_service.mark_sent(engine, "a1")
    budget_service.mark_uncertain(engine, "a1")
    with pytest.raises(budget_service.BudgetBlockedError):
        budget_service.reserve(engine, key="a2", job_id="j1", amount_micro=10, ceiling_micro=1000)
    budget_service.settle(engine, "a1", actual_micro=100, receipt="r1")
    budget_service.reserve(engine, key="a2", job_id="j1", amount_micro=10, ceiling_micro=1000)


def test_settle_keeps_overspend(engine: Engine) -> None:
    budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000)
    budget_service.mark_sent(engine, "a1")
    budget_service.settle(engine, "a1", actual_micro=250, receipt="r1")
    assert budget_service.totals(engine, ceiling_micro=1000)["spent"] == 250


def test_settle_idempotent_and_conflicts(engine: Engine) -> None:
    budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000)
    budget_service.mark_sent(engine, "a1")
    budget_service.settle(engine, "a1", actual_micro=90, receipt="r1")
    budget_service.settle(engine, "a1", actual_micro=90, receipt="r1")
    with pytest.raises(budget_service.ReservationConflictError):
        budget_service.settle(engine, "a1", actual_micro=91, receipt="r1")
    with pytest.raises(budget_service.ReservationConflictError):
        budget_service.settle(engine, "unknown", actual_micro=1, receipt="r9")
    budget_service.reserve(engine, key="a2", job_id="j1", amount_micro=10, ceiling_micro=1000)
    with pytest.raises(budget_service.ReservationConflictError):
        budget_service.settle(engine, "a2", actual_micro=10, receipt="r2")


def test_release_frees_hold(engine: Engine) -> None:
    budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000)
    budget_service.release_before_send(engine, "a1")
    assert budget_service.totals(engine, ceiling_micro=1000)["held"] == 0
    with pytest.raises(budget_service.ReservationConflictError):
        budget_service.release_before_send(engine, "a1")


def test_transitions_reject_bad_states(engine: Engine) -> None:
    with pytest.raises(budget_service.ReservationConflictError):
        budget_service.mark_sent(engine, "missing")
    budget_service.reserve(engine, key="a1", job_id="j1", amount_micro=100, ceiling_micro=1000)
    with pytest.raises(budget_service.ReservationConflictError):
        budget_service.mark_uncertain(engine, "a1")
    budget_service.mark_sent(engine, "a1")
    with pytest.raises(budget_service.ReservationConflictError):
        budget_service.release_before_send(engine, "a1")


def test_concurrent_reserves_admit_once(engine: Engine) -> None:
    """PKG-T02 acceptance: concurrent reserves never exceed availability."""
    barrier = threading.Barrier(2)
    outcomes: dict[str, str] = {}

    def _worker(name: str) -> None:
        barrier.wait()
        try:
            budget_service.reserve(
                engine, key=name, job_id="j1", amount_micro=600, ceiling_micro=1000
            )
            outcomes[name] = "reserved"
        except budget_service.BudgetBlockedError:
            outcomes[name] = "blocked"

    threads = [threading.Thread(target=_worker, args=(n,)) for n in ("w1", "w2")]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    assert sorted(outcomes.values()) == ["blocked", "reserved"]
    assert budget_service.totals(engine, ceiling_micro=1000)["held"] == 600


def test_estimate_positive_and_grows() -> None:
    assert budget_service.estimate_attempt_micro_usd(0) >= 1
    assert budget_service.estimate_attempt_micro_usd(
        100_000
    ) > budget_service.estimate_attempt_micro_usd(10)
    # 10 chars -> 3 input tokens: ceil((3 * 1.25 + 4096 * 4.25) * 1e6 / 1e6).
    assert budget_service.estimate_attempt_micro_usd(10) == 17412


def test_budget_cap_and_conversions(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", "20.00")
    get_settings.cache_clear()
    try:
        assert budget_service.budget_cap_micro_usd() == 20_000_000
    finally:
        get_settings.cache_clear()
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", "19.9999999")
    get_settings.cache_clear()
    try:
        assert budget_service.budget_cap_micro_usd() == 19_999_999
    finally:
        get_settings.cache_clear()
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", "junk")
    get_settings.cache_clear()
    try:
        assert budget_service.budget_cap_micro_usd() == 0
    finally:
        get_settings.cache_clear()
    assert budget_service.usd_str_to_micro("0.000338") == 338
    assert budget_service.usd_str_to_micro("0.0000001") == 1
    with pytest.raises(ValueError):
        budget_service.usd_str_to_micro("junk")
    with pytest.raises(ValueError):
        budget_service.usd_str_to_micro("-1")
