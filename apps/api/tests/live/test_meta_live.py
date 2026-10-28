"""Opt-in live Meta check (T16). Skipped unless explicitly enabled.

Enable with BIDLAB_RUN_LIVE=1 plus MODEL_API_KEY and META_API_URL in the
environment. Performs exactly one minimal call (one synthetic page) and
validates the shape; never asserts live behavior from a fixture.
"""

import hashlib
import os

import pytest
from bidlab.schemas import generated as g
from bidlab.services import meta_adapter

pytestmark = pytest.mark.live

RUN_LIVE = os.environ.get("BIDLAB_RUN_LIVE") == "1"


def test_live_extraction_opt_in() -> None:
    if not RUN_LIVE:
        pytest.skip("live runs are opt-in (BIDLAB_RUN_LIVE=1)")
    adapter = meta_adapter.select_adapter("live")
    assert adapter.is_live is True
    assert isinstance(adapter, meta_adapter.LiveExtractor)
    text = "Synthetic smoke page for opt-in live runs."
    result = adapter.extract(
        [
            meta_adapter.PageInput(
                "live-smoke",
                1,
                text,
                document_sha256=hashlib.sha256(text.encode("utf-8")).hexdigest(),
            )
        ]
    )
    assert result.mode == "live"
    g.ExtractionProposal.model_validate(result.proposal)
