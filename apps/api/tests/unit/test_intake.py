"""Intake unit tests: text/money validation, tax non-inference, upload guards."""

from pathlib import Path

import pytest
from bidlab.api.errors import ApiError
from bidlab.services import intake as intake_service


def test_require_text_strips_and_enforces_cap() -> None:
    assert intake_service.require_text("  Tias  ", field="title", max_length=10) == "Tias"
    with pytest.raises(ApiError) as exc:
        intake_service.require_text("", field="title", max_length=10)
    assert exc.value.code == "validation_error"
    assert exc.value.status_code == 422
    with pytest.raises(ApiError) as exc:
        intake_service.require_text("   ", field="title", max_length=10)
    assert exc.value.code == "validation_error"
    with pytest.raises(ApiError) as exc:
        intake_service.require_text("x" * 11, field="title", max_length=10)
    assert exc.value.code == "validation_error"
    with pytest.raises(ApiError):
        intake_service.require_text(None, field="title", max_length=10)


def test_optional_text_blank_means_absent() -> None:
    assert intake_service.optional_text(None, field="source_url", max_length=8) is None
    assert intake_service.optional_text("   ", field="source_url", max_length=8) is None
    assert intake_service.optional_text("  a  ", field="source_url", max_length=8) == "a"
    with pytest.raises(ApiError) as exc:
        intake_service.optional_text("x" * 9, field="source_url", max_length=8)
    assert exc.value.code == "validation_error"


def test_parse_money_input_canonicalizes() -> None:
    parse = intake_service.parse_money_input
    assert parse(None, field="basis.pbl_net") is None
    assert parse("118336.00", field="basis.pbl_net") == "118336.00"
    assert parse("118336", field="basis.pbl_net") == "118336.00"
    assert parse("  90.5 ", field="basis.pbl_net") == "90.50"
    assert parse("0.00", field="basis.pbl_net") == "0.00"
    assert parse("2.675", field="basis.pbl_net") == "2.68"


def test_parse_money_input_rejects_unparseable() -> None:
    parse = intake_service.parse_money_input
    for bad in ["", "   ", "abc", "1.000,00", "1,000.00", "12e3", "NaN", "Infinity", "-5.00"]:
        with pytest.raises(ApiError) as exc:
            parse(bad, field="basis.pbl_net")
        assert exc.value.code == "money_unparseable", bad
        assert exc.value.status_code == 422
    # 13 integer digits cannot fit the Money shape.
    with pytest.raises(ApiError) as exc:
        parse("9999999999999.99", field="basis.pbl_net")
    assert exc.value.code == "money_unparseable"


def test_parse_money_input_never_float() -> None:
    parse = intake_service.parse_money_input
    for bad in [118336.00, 0.05, 118336, True]:
        with pytest.raises(ApiError) as exc:
            parse(bad, field="basis.pbl_net")
        assert exc.value.code == "money_unparseable"


def test_money_cents() -> None:
    assert intake_service.money_cents(None) is None
    assert intake_service.money_cents("118336.00") == 11833600
    assert intake_service.money_cents("0.01") == 1


def test_build_basis_json_no_tax_inference() -> None:
    net_only = intake_service.build_basis_json(
        scope_id="s1",
        pbl_net="118336.00",
        pbl_gross=None,
        tax_kind="IGIC",
        period_months=24,
        currency="EUR",
    )
    assert net_only["budget_net"] == "118336.00"
    assert net_only["reference_kind"] == "pbl"
    assert net_only["ceiling_net"] is None
    assert net_only["scoring_reference_net"] is None
    assert net_only["tax_kind"] == "IGIC"
    assert net_only["period_months"] == 24

    gross_only = intake_service.build_basis_json(
        scope_id="s1",
        pbl_net=None,
        pbl_gross="126619.52",
        tax_kind="IGIC",
        period_months=None,
        currency=None,
    )
    assert gross_only["budget_net"] is None
    assert gross_only["reference_kind"] == "unknown"
    assert gross_only["currency"] == "EUR"
    assert gross_only["period_months"] is None

    assert set(net_only) == set(gross_only)


def test_build_basis_json_unknown_tax_by_default() -> None:
    basis = intake_service.build_basis_json(
        scope_id="s1",
        pbl_net=None,
        pbl_gross=None,
        tax_kind=None,
        period_months=None,
        currency=None,
    )
    assert basis["tax_kind"] == "unknown"
    assert basis["review_status"] == "pending"
    assert basis["evidence_ids"] == []
    assert basis["metadata_evidence"] == []


def test_require_pdf_magic_checks_bytes_not_extension() -> None:
    intake_service.require_pdf_magic(b"%PDF-1.4\nrest")
    for bad in [b"", b"plain text", b"%PDf-1.4", b" %PDF-1.4", b"\x00%PDF-"]:
        with pytest.raises(ApiError) as exc:
            intake_service.require_pdf_magic(bad)
        assert exc.value.code == "upload_not_pdf"
        assert exc.value.status_code == 415


def test_safe_display_name_confines_and_defaults() -> None:
    assert intake_service.safe_display_name("pliego.pdf") == "pliego.pdf"
    assert intake_service.safe_display_name("../../etc/passwd") == "passwd"
    assert intake_service.safe_display_name("") == "upload.pdf"
    assert intake_service.safe_display_name(None) == "upload.pdf"
    assert intake_service.safe_display_name("  ") == "upload.pdf"
    long_name = "a" * 300 + ".pdf"
    assert intake_service.safe_display_name(long_name) == "a" * 200


def test_blob_path_stays_inside_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from bidlab.db.session import get_engine, get_session_factory
    from bidlab.settings import get_settings

    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    try:
        rel, abs_path = intake_service.blob_path_for("t-1", "d-1")
        assert rel == "uploads/t-1/d-1.pdf"
        assert abs_path.is_relative_to(tmp_path.resolve())
        assert abs_path.name == "d-1.pdf"
        with pytest.raises(ApiError) as exc:
            intake_service.blob_path_for("../../escape", "d-1")
        assert exc.value.code == "bad_request"
    finally:
        get_settings.cache_clear()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
