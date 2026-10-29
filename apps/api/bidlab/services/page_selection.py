"""Deterministic first packet, never a claim of complete document reading.

The API currently admits one bounded provider request. Rank physical pages
by visible clause signals and retain at least one per document when the
packet permits it. Missing pages remain explicit in delivery coverage;
this selector does not interpret a formula or approve a requirement.
"""

from __future__ import annotations

import unicodedata
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Sequence

    from bidlab.services.meta_adapter import PageInput

_SIGNALS = (
    (12, ("formula", "puntuacion", "precio ofertado", "criterios de adjudicacion")),
    (10, ("anormal", "temerari", "desproporcionad")),
    (8, ("presupuesto base", "valor estimado", "plazo de ejecucion", "duracion")),
    (6, ("solvencia", "habilitacion", "adscripcion", "experiencia")),
)


def _rank(page: PageInput) -> tuple[int, str, int]:
    folded = unicodedata.normalize("NFKD", page.normalized_text.casefold())
    text = "".join(char for char in folded if not unicodedata.combining(char))
    score = sum(weight for weight, words in _SIGNALS if any(word in text for word in words))
    # Textless pages may be scanned. Keep them eligible for their render;
    # absence of a render is still an explicit preflight failure, not OCR.
    if not text.strip():
        score += 2
    return -score, page.document_id, page.page_number


def select_first_packet(pages: Sequence[PageInput], *, limit: int) -> tuple[PageInput, ...]:
    """Select at most ``limit`` physical pages with stable tie-breaking."""
    if type(limit) is not int or limit < 1:
        msg = "packet page limit must be a positive integer"
        raise ValueError(msg)
    ranked = sorted(pages, key=_rank)
    if len(ranked) <= limit:
        return tuple(sorted(ranked, key=lambda page: (page.document_id, page.page_number)))
    selected: dict[tuple[str, int], PageInput] = {}
    represented: set[str] = set()
    for page in ranked:
        if page.document_id not in represented:
            selected[(page.document_id, page.page_number)] = page
            represented.add(page.document_id)
            if len(selected) == limit:
                break
    for page in ranked:
        if len(selected) == limit:
            break
        selected[(page.document_id, page.page_number)] = page
    return tuple(sorted(selected.values(), key=lambda page: (page.document_id, page.page_number)))
