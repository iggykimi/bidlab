"""Compare text vs hybrid extraction over the eval set (PKG-T11 CLI).

Run with: uv run python scripts/compare_extraction.py --out evidence/extraction_comparison.json

The text mode always runs: the deterministic offline fixture, one call
per eval page, no network. The hybrid mode needs BOTH a verified live
credential (MODEL_API_KEY + META_API_URL, gate G3) AND --allow-live;
otherwise it is recorded as blocked with honest nulls and zero calls.
Exit code 0 writes the comparison artifact; exit code 2 means the
gold, the split, the output path, or a live attempt failed.
"""

import argparse
import json
import sys
from pathlib import Path

from bidlab.services import extraction_compare as ec
from bidlab.services import extraction_eval as ev
from bidlab.services.meta_adapter import AdapterError

ROOT = Path(__file__).resolve().parents[1]


def load_page_texts(path: Path) -> dict[tuple[str, int], str]:
    """Load page texts for a future live re-run (never used offline).

    The file is a JSON object mapping "document_file::page" to the
    normalized page text, e.g. {"evidence/originals/x_pcap.pdf::9": "..."}.
    Strict shape: anything else is a ValueError (CLI exit 2).
    """
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        msg = f"page texts file {path} must hold a JSON object"
        raise TypeError(msg)
    texts: dict[tuple[str, int], str] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or "::" not in key:
            msg = f"page texts key {key!r} must look like 'document_file::page'"
            raise ValueError(msg)
        document_file, _, page_raw = key.rpartition("::")
        if not document_file or not page_raw.isdigit() or int(page_raw) < 1:
            msg = f"page texts key {key!r} must look like 'document_file::page'"
            raise ValueError(msg)
        if not isinstance(value, str) or not value.strip():
            msg = f"page texts entry {key!r} must hold non-empty text"
            raise ValueError(msg)
        texts[(document_file, int(page_raw))] = value
    return texts


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Compare text vs hybrid extraction.")
    parser.add_argument("--gold", default=str(ROOT / "examples" / "gold_claims.json"))
    parser.add_argument("--split", default=str(ROOT / "evidence" / "evaluation_split.json"))
    parser.add_argument("--out", default=str(ROOT / "evidence" / "extraction_comparison.json"))
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument(
        "--allow-live",
        action="store_true",
        help="permitir llamadas live al híbrido (exige credencial G3 y textos de página)",
    )
    parser.add_argument(
        "--page-texts",
        default=None,
        help="JSON {'document_file::page': texto} para una re-ejecución live futura",
    )
    args = parser.parse_args(argv)
    try:
        gold = ev.load_gold(Path(args.gold))
        split = ev.load_split(Path(args.split))
        texts = load_page_texts(Path(args.page_texts)) if args.page_texts else None
        result = ec.compare(gold, split, allow_live=args.allow_live, page_texts=texts)
        payload = result.to_dict()
        Path(args.out).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except (ValueError, TypeError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except AdapterError as exc:
        print(f"live error: {exc.code}: {exc.message}", file=sys.stderr)
        return 2
    if args.format == "json":
        print(json.dumps(payload, indent=2))
        return 0
    text = result.text
    hybrid = result.hybrid
    print(f"eval claims: {result.n_eval} (dev {result.n_dev}, gold {result.gold_total})")
    print(
        f"text: status={text.status} hit={text.n_hit} miss={text.n_miss} "
        f"unsupported={text.n_unsupported} accuracy={text.accuracy} "
        f"critical={list(text.critical_errors or ())} "
        f"latency_p50={text.latency_p50_ms}ms max={text.latency_max_ms}ms "
        f"cost_micro_usd={text.cost_micro_usd}"
    )
    print(f"hybrid: status={hybrid.status} reason={hybrid.block_reason}")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
