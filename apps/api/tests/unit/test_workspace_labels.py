"""Whole-scope labels never leak the __whole__ slug (V6 F5)."""

from bidlab.db import models
from bidlab.services import workspace as workspace_service


def _scope(lot_key: str, period: object) -> models.Scope:
    return models.Scope(
        id="s1",
        tender_id="t1",
        lot_key=lot_key,
        basis_json={"period_months": period},
        budget_net_cents=None,
    )


def test_whole_scope_without_period_has_plain_label() -> None:
    assert (
        workspace_service.scope_to_dict(_scope("__whole__", None))["label"]
        == "Contrato completo"
    )


def test_whole_scope_with_period_keeps_dated_label() -> None:
    assert (
        workspace_service.scope_to_dict(_scope("__whole__", 24))["label"]
        == "Contrato inicial completo (24 meses)"
    )


def test_named_lot_keeps_user_label() -> None:
    assert (
        workspace_service.scope_to_dict(_scope("Lote 1", None))["label"] == "Lote 1"
    )
