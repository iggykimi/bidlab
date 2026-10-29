"""Benchmark reproducible del intake PDF (BL-V2-10, solo medicion).

Mide las etapas reales del alta (hash, extraccion de texto, escritura,
render) sobre PDFs sinteticos propios de 2/40/100 paginas. Nivel servicio,
no HTTP: responde si el render domina y si hay que tocar algo (§12.1).
No guarda PDFs ni tokens; el JSON solo lleva tiempos, tamanos y hashes.

Ejemplo:
    .venv/Scripts/python scripts/bench_pdf_intake.py --iters 5 --out /tmp/bench.json
"""

import argparse
import hashlib
import json
import os
import platform
import statistics
import sys
import tempfile
import time
import tracemalloc
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

import pymupdf  # noqa: E402
from bidlab.services import pdf as pdf_service  # noqa: E402
from bidlab.services import render as render_service  # noqa: E402

LINE = "Presupuesto base de licitacion sin impuestos 118336.00 euros; plazo 24 meses; puntos 49."


def make_pdf(pages: int) -> bytes:
    doc = pymupdf.Document()  # type: ignore[no-untyped-call]
    for n in range(1, pages + 1):
        page = doc.new_page(width=595, height=842)
        text = "\n".join(f"Pagina {n} linea {i}: {LINE}" for i in range(40))
        page.insert_text((36, 36), text, fontsize=9)
    out = doc.tobytes()  # type: ignore[no-untyped-call]
    doc.close()  # type: ignore[no-untyped-call]
    return bytes(out)


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * pct
    low, high = int(k), min(int(k) + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (k - low)


def bench_one(pdf: bytes, dpi: int, tmp: Path) -> dict[str, float]:
    tracemalloc.start()
    t0 = time.perf_counter()
    sha = hashlib.sha256(pdf).hexdigest()
    if pdf[:4] != b"%PDF":
        raise ValueError("bad-magic")
    hash_ms = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    extracted = pdf_service.extract_pages(pdf)
    extract_ms = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    blob = tmp / f"{sha[:16]}.pdf"
    blob.write_bytes(pdf)
    write_ms = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    render_service.render_page(pdf, 1, dpi=dpi)
    first_ms = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    pages = render_service.render_document(pdf, dpi=dpi)
    render_service.store_render(tmp, "bench", sha[:16], pages, pdf_sha256=sha, dpi=dpi)
    all_ms = (time.perf_counter() - t0) * 1000

    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return {
        "hash_ms": hash_ms,
        "extract_text_ms": extract_ms,
        "staging_write_ms": write_ms,
        "first_page_render_ms": first_ms,
        "all_pages_render_ms": all_ms,
        "peak_python_kb": peak / 1024,
        "pages_seen": float(len(extracted)),
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Bench del intake PDF (sintetico).")
    parser.add_argument("--pages", default="2 40 100")
    parser.add_argument("--iters", type=int, default=5)
    parser.add_argument("--dpi", type=int, default=150)
    parser.add_argument("--out", default=None)
    args = parser.parse_args(argv)

    docs = {n: make_pdf(n) for n in (int(x) for x in args.pages.split())}
    print(
        f"pymupdf {pymupdf.__version__}; sintesis OK: "
        + ", ".join(f"{n}p={len(b) / 1024:.0f}KB" for n, b in docs.items())
    )

    docs_out: dict[str, Any] = {}
    results: dict[str, object] = {
        "env": {
            "os": platform.platform(),
            "cpu_count": os.cpu_count(),
            "python": platform.python_version(),
            "renderer": f"pymupdf-{pymupdf.__version__}",
            "render_version": render_service.RENDER_VERSION,
            "dpi": args.dpi,
            "iters": args.iters,
        },
        "docs": docs_out,
    }
    with tempfile.TemporaryDirectory(prefix="bidlab-bench-") as tmpdir:
        tmp = Path(tmpdir)
        for n, pdf in docs.items():
            runs = [bench_one(pdf, args.dpi, tmp) for _ in range(args.iters)]
            summary: dict[str, Any] = {
                "bytes": len(pdf),
                "sha256": hashlib.sha256(pdf).hexdigest(),
                "stages": {
                    k: {
                        "median_ms": round(statistics.median(v), 2),
                        "p95_ms": round(percentile(v, 0.95), 2),
                    }
                    for k, v in ((k, [r[k] for r in runs]) for k in runs[0] if k != "pages_seen")
                },
            }
            if any(r["pages_seen"] != n for r in runs):
                raise ValueError("page-drift")
            docs_out[str(n)] = summary
            stages: dict[str, Any] = summary["stages"]
            print(
                f"{n} paginas: "
                + ", ".join(
                    f"{k}={v['median_ms']}ms" for k, v in stages.items() if k != "peak_python_kb"
                )
            )

    if args.out:
        Path(args.out).write_text(json.dumps(results, indent=1, sort_keys=True), encoding="utf-8")
        print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
