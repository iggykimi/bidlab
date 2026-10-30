"""Deterministic first packet, never a claim of complete document reading.

The API currently admits one bounded provider request. Rank physical pages
by visible clause signals and retain at least one per document when the
packet permits it. Missing pages remain explicit in delivery coverage;
this selector does not interpret a formula or approve a requirement.
"""

from __future__ import annotations

import re
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

# Pages that carry the money outrank figureless boilerplate: a budget page
# (8) plus this beats any criteria/anomaly wording without figures (22 max),
# while a money-only page (15) still loses to it, so penalty tables do not
# push scoring pages out. Spanish thousand-group figures (34.724,63) or an
# explicit currency word; clause numbers (14.1), years and spaced codes
# never match.
_MONEY_WEIGHT = 15
_MONEY_WORDS = ("euros", "€")
_MONEY_FIGURE_RE = re.compile(r"\d{1,3}(?:\.\d{3})+(?:,\d{2})?")


def _rank(page: PageInput) -> tuple[int, str, int]:
    folded = unicodedata.normalize("NFKD", page.normalized_text.casefold())
    text = "".join(char for char in folded if not unicodedata.combining(char))
    score = sum(weight for weight, words in _SIGNALS if any(word in text for word in words))
    if _MONEY_FIGURE_RE.search(text) or any(word in text for word in _MONEY_WORDS):
        score += _MONEY_WEIGHT
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
