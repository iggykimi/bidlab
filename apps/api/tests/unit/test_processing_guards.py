"""Process recovery, request identity and source versions are independent guards."""

import datetime as dt
import hashlib
import json
from collections.abc import Iterator
from dataclasses import replace
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock

import pytest
from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.services import budget, jobs, meta_adapter, page_selection, render, worker
from bidlab.settings import get_settings
from pypdf import PdfWriter
from sqlalchemy import create_engine, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session


@pytest.fixture()
def engine(tmp_path: Path) -> Iterator[Engine]:
    value = create_engine(f"sqlite:///{tmp_path / 'guards.sqlite3'}")
    models.Base.metadata.create_all(value)
    yield value
    value.dispose()


def _job(identifier: str, status: str, *, expected: int | None = None) -> models.Job:
    now = dt.datetime.now(dt.UTC)
    return models.Job(
        id=identifier,
        tender_id="t1",
        status=status,
        request_json={
            "input": {
                "mode": "live",
                "document_ids": [],
                "expected_interpretation_revision": expected,
            },
            "attempts": 1,
        },
        stage=status,
        generation=1,
        worker_id="old-process" if status == "running" else None,
        lease_until=(now + dt.timedelta(minutes=5)).isoformat(),
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )


def test_boot_never_retries_failed_jobs(engine: Engine, monkeypatch: pytest.MonkeyPatch) -> None:
    with Session(engine) as session:
        session.add_all([_job("failed-paid-call", "failed"), _job("never-started", "queued")])
        session.commit()
    queue = Mock()
    monkeypatch.setattr(worker, "get_engine", lambda: engine)
    monkeypatch.setattr(worker, "_ensure_started", lambda: None)
    monkeypatch.setattr(worker, "_QUEUE", queue)
    monkeypatch.setattr(worker, "_THREAD", None)
    worker.start()
    queue.put.assert_called_once_with("never-started")


@pytest.mark.parametrize("state", ["reserved", "sent"])
def test_recovery_retains_possible_send_without_retry(engine: Engine, state: str) -> None:
    with Session(engine) as session:
        session.add(_job("interrupted", "running"))
        session.commit()
    budget.reserve(
        engine, key="possible-send", job_id="interrupted", amount_micro=200, ceiling_micro=1000
    )
    if state == "sent":
        budget.mark_sent(engine, "possible-send")
    jobs.recover_interrupted(engine)
    with Session(engine) as session:
        job = session.get(models.Job, "interrupted")
        assert job is not None
        assert (job.status, job.error_code, job.generation) == ("failed", "interrupted", 2)
        assert job.result_revision is None
        invocation = session.get(models.ModelInvocation, "inv-interrupted-a1")
        assert invocation is not None and invocation.mode == "live"
        assert invocation.prompt_tokens is None
    assert budget.totals(engine, ceiling_micro=1000) == {
        "ceiling": 1000,
        "spent": 0,
        "held": 200,
        "available": 800,
        "uncertain": 1,
    }


def test_unexpected_adapter_exception_is_terminal_and_keeps_hold(engine: Engine) -> None:
    class BrokenAdapter:
        is_live = True

        def extract(self, pages: object) -> meta_adapter.AdapterResult:
            with engine.connect() as connection:
                state = connection.execute(select(models.ModelSpendReservation.state)).scalar_one()
                assert state == "sent", "dispatch intent must be durable before adapter code"
            raise RuntimeError("test marker must not be exposed to a client")

    with Session(engine) as session:
        session.add(_job("broken", "queued"))
        session.commit()
    result = jobs.run_claimed_attempt(engine, "broken", adapter=BrokenAdapter())
    assert result is not None and result.status == "failed"
    assert "test marker" not in json.dumps(result.request_json)
    assert budget.totals(engine, ceiling_micro=20_000_000)["uncertain"] == 1


@pytest.mark.parametrize("stale_generation", [False, True])
def test_paid_receipt_survives_generation_or_review_change(
    engine: Engine, stale_generation: bool
) -> None:
    class FakeLive:
        is_live = True

        def extract(self, pages: object) -> meta_adapter.AdapterResult:
            result = meta_adapter.StubExtractor().extract([])
            return replace(
                result,
                mode="live",
                model="muse-spark-1.3",
                prompt_tokens=100,
                completion_tokens=50,
                provider_request_id="mock-paid-no-network",
                estimated_cost_usd="0.000338",
            )

    with Session(engine) as session:
        session.add(_job("late", "queued", expected=0))
        session.commit()
        claim = jobs.claim_attempt(session, "late", "first-worker")
        assert claim is not None
        session.commit()
    outcome = jobs.execute_attempt(engine, claim, adapter=FakeLive())
    with Session(engine) as session:
        if stale_generation:
            session.execute(
                update(models.Job)
                .where(models.Job.id == "late")
                .values(generation=claim.generation + 1, worker_id="new-worker")
            )
        else:
            session.add(
                models.InterpretationRevision(
                    tender_id="t1",
                    revision=1,
                    mode="manual",
                    proposal_json={},
                    reviewed_json={},
                    document_hashes_json={},
                    actor="human",
                    reason="review while Meta was running",
                    created_at=dt.datetime.now(dt.UTC).isoformat(),
                )
            )
        session.commit()
    with Session(engine) as session:
        result = jobs.publish_outcome(session, claim, outcome)
        if stale_generation:
            assert result is None
        else:
            assert result is not None
            assert (result.status, result.error_code) == ("failed", "revision_conflict")
    with Session(engine) as session:
        receipt = session.get(models.ModelInvocation, "inv-late-a2")
        assert receipt is not None
        assert receipt.provider_request_id == "mock-paid-no-network"
        assert receipt.prompt_tokens == 100
        assert receipt.estimated_cost_usd == "0.000338"
        assert session.get(models.InterpretationRevision, ("t1", 2)) is None
    assert budget.totals(engine, ceiling_micro=20_000_000)["spent"] == 338


def test_page_selection_prioritizes_clauses_and_keeps_documents() -> None:
    pages = [meta_adapter.PageInput("a", number, "Generic page") for number in range(1, 31)]
    pages.extend(
        [
            meta_adapter.PageInput("a", 31, "Fórmula y puntuación del precio ofertado"),
            meta_adapter.PageInput("a", 32, "Ofertas anormalmente bajas"),
            meta_adapter.PageInput("b", 1, "Solvencia técnica"),
        ]
    )
    selected = page_selection.select_first_packet(pages, limit=6)
    assert len(selected) == 6
    keys = {(page.document_id, page.page_number) for page in selected}
    assert {("a", 31), ("a", 32), ("b", 1)} <= keys
    assert selected == page_selection.select_first_packet(list(reversed(pages)), limit=6)


def test_page_selection_prefers_pages_with_money_figures() -> None:
    boilerplate = meta_adapter.PageInput(
        "a", 1, "Apertura y criterios de adjudicacion; ofertas anormalmente bajas"
    )
    budget = meta_adapter.PageInput("a", 2, "Presupuesto base de licitacion 41.322,31 euros")
    selected = page_selection.select_first_packet([boilerplate, budget], limit=1)
    assert [(page.document_id, page.page_number) for page in selected] == [("a", 2)]
    penalty = meta_adapter.PageInput("a", 3, "Penalidad de 1.000 euros por dia")
    selected = page_selection.select_first_packet([boilerplate, penalty], limit=1)
    assert [(page.document_id, page.page_number) for page in selected] == [("a", 1)]
    lookalikes = meta_adapter.PageInput("a", 4, "Clausula 14.1 del ano 2026, codigo 26 1532 63100")
    selected = page_selection.select_first_packet([lookalikes, penalty], limit=1)
    assert [(page.document_id, page.page_number) for page in selected] == [("a", 3)]


def test_input_identity_changes_with_image_or_source_version() -> None:
    page = meta_adapter.PageInput(
        "d1", 1, "same text", document_sha256="a" * 64, image_bytes=b"png-a"
    )
    original = meta_adapter.pages_input_hash([page])
    assert original != meta_adapter.pages_input_hash([replace(page, image_bytes=b"png-b")])
    assert original != meta_adapter.pages_input_hash([replace(page, document_sha256="b" * 64)])


@pytest.mark.parametrize("corruption", [None, "pdf", "png", "dimensions"])
def test_worker_uses_only_exact_versioned_render(tmp_path: Path, corruption: str | None) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    stream = BytesIO()
    writer.write(stream)
    raw = stream.getvalue()
    sha = hashlib.sha256(raw).hexdigest()
    target = render.store_render(
        tmp_path,
        "t1",
        "d1",
        render.render_document(raw, dpi=72),
        pdf_sha256=sha,
        dpi=72,
    )
    manifest_file = target / "manifest.json"
    manifest = json.loads(manifest_file.read_text())
    if corruption == "pdf":
        manifest["pdf_sha256"] = "f" * 64
    elif corruption == "png":
        (target / "p001.png").write_bytes(b"changed image")
    elif corruption == "dimensions":
        manifest["pages"][0]["width"] += 1
    manifest_file.write_text(json.dumps(manifest))
    images = jobs._page_images(tmp_path, "t1", "d1", expected_pdf_sha256=sha)
    assert set(images) == ({1} if corruption is None else set())


@pytest.mark.parametrize("invalid", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_budget_never_admits_spend(invalid: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", invalid)
    get_settings.cache_clear()
    try:
        assert budget.budget_cap_micro_usd() == 0
        with pytest.raises(ValueError):
            budget.usd_str_to_micro(invalid)
    finally:
        get_settings.cache_clear()


@pytest.mark.parametrize("model", ["muse-spark-1.3", "muse-spark-1.3-contributor"])
def test_configured_key_admits_priced_models(
    model: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("BIDLAB_MODE", "live")
    monkeypatch.setenv("META_MODEL", model)
    monkeypatch.setenv("MODEL_API_KEY", "test-key-not-a-real-secret")
    monkeypatch.setenv("META_API_URL", "https://meta.test/chat")
    get_settings.cache_clear()
    try:
        assert get_settings().live_ready is True
        adapter = meta_adapter.select_adapter("live")
        assert isinstance(adapter, meta_adapter.LiveExtractor)
        assert adapter._model == model
    finally:
        get_settings.cache_clear()


@pytest.mark.parametrize(
    ("mode", "model"),
    [
        ("demo", "muse-spark-1.3"),
        ("manual", "muse-spark-1.3"),
        ("live", "unpriced-model"),
    ],
)
def test_configured_key_never_bypasses_mode_or_billing_profile(
    mode: str, model: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("BIDLAB_MODE", mode)
    monkeypatch.setenv("META_MODEL", model)
    monkeypatch.setenv("MODEL_API_KEY", "test-key-not-a-real-secret")
    monkeypatch.setenv("META_API_URL", "https://meta.test/chat")
    get_settings.cache_clear()
    try:
        assert get_settings().live_ready is False
        with pytest.raises(ApiError) as error:
            meta_adapter.select_adapter("live")
        assert error.value.code == "provider_not_configured"
    finally:
        get_settings.cache_clear()
