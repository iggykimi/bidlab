"""Aggregate manually verified observations against author-authored PDF gold.

Never calls Meta. Never invents outputs, confidence, prices or latencies.
Requires a human-annotated results file; missing cases are marked BLOCKED.

Target repo path: scripts/meta_eval_scorecard.py
Usage:
  uv run python scripts/meta_eval_scorecard.py \
    --gold examples/meta_eval_synthetic/gold_cases.json \
    --write-template examples/meta_eval_synthetic/annotations_TEMPLATE.json
  # Fill the template with *real observations reviewed manually*; never mark
  # status='evaluated' unless the model actually ran and was inspected.
  uv run python scripts/meta_eval_scorecard.py \
    --gold examples/meta_eval_synthetic/gold_cases.json \
    --annotations evidence/private/annotations.json --out evidence/private/scorecard.json

Template is for structure only, not evidence of live model performance.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, NoReturn


class ScorecardError(ValueError):
    pass


def _fail(message: str) -> NoReturn:
    """Raise ScorecardError with a dynamic diagnostic (keeps TRY003 quiet)."""
    raise ScorecardError(message)


def _canon(field: Any, value: Any, page: Any) -> tuple[str, str, int]:
    if not isinstance(field, str) or not field:
        _fail("field must be a nonempty string")
    if not isinstance(value, str):
        _fail("value must be a string, never null for a claimed fact")
    if not isinstance(page, int) or isinstance(page, bool) or page < 1:
        _fail("physical_page must be positive integer")
    clean = " ".join(value.split()).strip()
    try:
        amount = Decimal(clean)
        clean = format(amount.normalize(), "f") if amount.is_finite() else clean.casefold()
    except InvalidOperation:
        clean = clean.casefold()
    return (field, clean, page)


def template(gold: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": "1",
        "note": "EMPTY TEMPLATE: no live measurements are implied",
        "cases": [
            {
                "id": case["id"],
                "status": "blocked",
                "block_reason": "not run",
                "observations": [],
                "manual_critical_errors": [],
                "latency_ms": None,
                "estimated_cost_usd": None,
            }
            for case in gold["cases"]
        ],
    }


def evaluate(gold: dict[str, Any], annotations: dict[str, Any]) -> dict[str, Any]:
    if gold.get("schema_version") != "1" or annotations.get("schema_version") != "1":
        _fail("unsupported gold or annotation version")
    gold_cases = gold.get("cases")
    records = annotations.get("cases")
    if not isinstance(gold_cases, list) or not isinstance(records, list):
        _fail("both gold and annotations need cases arrays")
    gold_map = {case["id"]: case for case in gold_cases}
    if len(gold_map) != len(gold_cases):
        _fail("duplicate case id in gold")
    observed_ids = [r.get("id") for r in records if isinstance(r, dict)]
    if len(observed_ids) != len(set(observed_ids)):
        _fail("duplicate annotation case id")
    if any(i not in gold_map for i in observed_ids):
        _fail("annotation refers to unknown case")
    results: list[dict[str, Any]] = []
    tp_total = fp_total = fn_total = verified_cites = claimed_cites = 0
    evaluated = 0
    for case_id, case in gold_map.items():
        rec = next((r for r in records if r.get("id") == case_id), None)
        if rec is None or rec.get("status") != "evaluated":
            if rec is not None and rec.get("status") != "blocked":
                _fail(f"{case_id}: status must be evaluated or blocked")
            results.append(
                {
                    "id": case_id,
                    "status": "blocked",
                    "reason": (rec.get("block_reason") if rec else "missing annotation"),
                }
            )
            continue
        if rec.get("latency_ms") is not None and (
            not isinstance(rec["latency_ms"], int) or rec["latency_ms"] < 0
        ):
            _fail(f"{case_id}: invalid latency_ms")
        outputs = rec.get("observations")
        if not isinstance(outputs, list):
            _fail(f"{case_id}: evaluated cases require observations array")
        expectations = Counter(
            _canon(x["field"], x["value"], x["physical_page"])
            for x in case["expected_field_page_values"]
        )
        predictions = Counter(_canon(x["field"], x["value"], x["physical_page"]) for x in outputs)
        tp = sum((expectations & predictions).values())
        fp = sum((predictions - expectations).values())
        fn = sum((expectations - predictions).values())
        # Human verifies exact text/image evidence, not just a plausible page number.
        for output in outputs:
            if output.get("citation_verified_by_human") not in (True, False):
                _fail(f"{case_id}: missing per-output human citation check")
            claimed_cites += 1
            verified_cites += int(output["citation_verified_by_human"] is True)
        if not isinstance(rec.get("manual_critical_errors"), list):
            _fail(f"{case_id}: critical errors need an explicit list")
        evaluated += 1
        tp_total += tp
        fp_total += fp
        fn_total += fn
        results.append(
            {
                "id": case_id,
                "status": "evaluated",
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "citation_verified": sum(
                    int(x["citation_verified_by_human"] is True) for x in outputs
                ),
                "citations_claimed": len(outputs),
                "critical_error_count": len(rec["manual_critical_errors"]),
                "latency_ms": rec.get("latency_ms"),
                "estimated_cost_usd": rec.get("estimated_cost_usd"),
            }
        )
    return {
        "schema_version": "1",
        "source": "human-reviewed annotations",
        "case_count": len(gold_map),
        "evaluated_cases": evaluated,
        "blocked_cases": len(gold_map) - evaluated,
        "tp": tp_total,
        "fp": fp_total,
        "fn": fn_total,
        "field_precision": (tp_total / (tp_total + fp_total) if tp_total + fp_total else None),
        "field_recall": (tp_total / (tp_total + fn_total) if tp_total + fn_total else None),
        "citations_claimed": claimed_cites,
        "citations_human_verified": verified_cites,
        "citation_valid_rate": (verified_cites / claimed_cites if claimed_cites else None),
        "manual_critical_error_count": sum(x.get("critical_error_count", 0) for x in results),
        "cases": results,
        "limitations": [
            "Document QA by humans is required",
            "One run per case is not p95 reliability",
            "Matches require field+value+physical page; qualifiers must also be manually reviewed",
            "This report does not guarantee legal correctness",
        ],
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--gold", type=Path, required=True)
    p.add_argument("--annotations", type=Path)
    p.add_argument("--write-template", type=Path)
    p.add_argument("--out", type=Path)
    args = p.parse_args()
    if not args.write_template and not args.annotations:
        p.error("use --write-template or --annotations")
    gold = json.loads(args.gold.read_text(encoding="utf-8"))
    if args.write_template:
        args.write_template.parent.mkdir(parents=True, exist_ok=True)
        args.write_template.write_text(
            json.dumps(template(gold), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Wrote empty template: {args.write_template} (not live evidence)")
    if args.annotations:
        if args.out is None:
            p.error("--annotations requires --out")
        annotations = json.loads(args.annotations.read_text(encoding="utf-8"))
        result = evaluate(gold, annotations)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(
            f"Wrote {result['evaluated_cases']} evaluated,"
            f" {result['blocked_cases']} blocked; no result inferred"
        )


if __name__ == "__main__":
    main()
