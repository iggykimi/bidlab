"""In-process analysis worker: FIFO queue + one daemon thread, short sessions.

Single-process design (no broker): the route enqueues admitted job ids and
returns 202 immediately; this thread claims each job (compare-and-swap),
extracts with no job transaction open, and publishes through the
generation fence. Every phase uses its own short session, so a slow
provider never blocks health, pricing, or polling. On boot the worker
re-queues jobs left queued (or lease-expired) by a previous process.
"""

from __future__ import annotations

import datetime as dt
import logging
import queue
import threading

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.services import jobs as jobs_service

log = logging.getLogger(__name__)

_QUEUE: queue.Queue[str] = queue.Queue()
_LOCK = threading.Lock()
_THREAD: threading.Thread | None = None
_STOP = threading.Event()
WORKER_ID = "worker-1"


def submit(job_id: str) -> None:
    """Enqueue an admitted job id for background execution."""
    _ensure_started()
    _QUEUE.put(job_id)


def _ensure_started() -> None:
    global _THREAD
    if _THREAD is not None and _THREAD.is_alive():
        return
    with _LOCK:
        if _THREAD is not None and _THREAD.is_alive():
            return
        _STOP.clear()
        _THREAD = threading.Thread(target=_loop, name="bidlab-worker", daemon=True)
        _THREAD.start()


def start() -> None:
    """Start the worker and re-queue jobs orphaned by a previous process."""
    _ensure_started()
    engine = get_engine()
    with Session(engine) as session:
        now = dt.datetime.now(dt.UTC).isoformat()
        rows = session.scalars(
            select(models.Job.id).where(
                or_(
                    models.Job.status == "queued",
                    models.Job.status == "failed",
                    (models.Job.status == "running") & (models.Job.lease_until < now),
                )
            )
        ).all()
    for job_id in rows:
        _QUEUE.put(job_id)
    if rows:
        log.info("worker re-queued %d orphaned jobs", len(rows))


def stop(timeout_s: float = 10.0) -> None:
    """Signal the worker loop to exit and wait for the thread."""
    global _THREAD
    _STOP.set()
    thread, _THREAD = _THREAD, None
    if thread is not None and thread is not threading.current_thread():
        thread.join(timeout=timeout_s)


def _loop() -> None:
    while not _STOP.is_set():
        try:
            job_id = _QUEUE.get(timeout=0.2)
        except queue.Empty:
            continue
        try:
            _run_one(job_id)
        except Exception:
            log.exception("worker failed job %s", job_id)
        finally:
            _QUEUE.task_done()


def _run_one(job_id: str) -> None:
    # Engine resolved per job: tests rebind storage between cases, and the
    # engine cache follows the current environment.
    jobs_service.run_claimed_attempt(get_engine(), job_id, WORKER_ID)
