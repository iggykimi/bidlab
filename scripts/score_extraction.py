"""Score an extractor against the human gold (PKG-T10 harness CLI).

Run with: uv run python scripts/score_extraction.py --predictions <file>

The predictions file is a JSON list of {"claim_id", "value", "status"}
records; see scripts/README.md. Exit code 0 always prints a metric;
exit code 2 means the gold, the split, or the predictions are invalid.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from bidlab.services import extraction_eval as ev

ROOT = Path(__file__).resolve().parents[1]


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Score an extractor vs gold.")
    parser.add_argument("--gold", default=str(ROOT / "examples" / "gold_claims.json"))
    parser.add_argument("--split", default=str(ROOT / "evidence" / "evaluation_split.json"))
    parser.add_argument("--predictions", required=True)
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args(argv)
    try:
        gold = ev.load_gold(Path(args.gold))
        split = ev.load_split(Path(args.split))
        violations = ev.check_split(gold, split)
        if violations:
            for violation in violations:
                print(f"split violation: {violation}", file=sys.stderr)
            return 2
        claims = ev.eval_claims(gold, split)
        records = _load_json(Path(args.predictions))
        if not isinstance(records, list):
            print("predictions file must hold a JSON list", file=sys.stderr)
            return 2
        result = ev.score(ev.predictions_from_records(records), claims, gold)
    except (ValueError, TypeError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if args.format == "json":
        print(json.dumps(result.to_dict(), indent=2))
        return 0
    print(
        f"eval claims: {result.n_eval} "
        f"(hit={result.n_hit} miss={result.n_miss} "
        f"unsupported={result.n_unsupported})"
    )
    print(f"accuracy: {result.accuracy} (unsupported stays in the denominator)")
    for item in result.scores:
        print(
            f"  {item.verdict:11} {item.claim_id} "
            f"expected={item.expected_value!r} "
            f"predicted={item.predicted_value!r}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
