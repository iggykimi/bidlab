# scripts

Multiplatform Python helpers. Run from the repo root with `uv run python scripts/<name>.py`.

## score_extraction.py (PKG-T10)

Scores one extractor run against the human gold. Both text and hybrid
extractors feed it the same way: map each extractor answer to the gold
claim id it addresses and write normalized prediction records.

```powershell
uv run python scripts/score_extraction.py --predictions predictions.json
uv run python scripts/score_extraction.py --predictions predictions.json --format json
```

Inputs:

- `--gold` (default `examples/gold_claims.json`): human annotation, never model output.
- `--split` (default `evidence/evaluation_split.json`): dev/eval partition by expediente.
- `--predictions`: JSON list of `{"claim_id", "value", "status"}` records.
  `value` is a string or null; `status` is `supported` (default) or
  `unsupported`.

Rules applied:

- Dev claims (Tias seed pages) never score, even if predicted.
- Every eval claim counts in the denominator, including `unsupported`
  answers and claims with no prediction at all.
- Money-like values compare as Decimal (`"295840"` equals `"295840.00"`);
  anything else compares as an exact string.

Exit code 0 prints the metric; exit code 2 reports an invalid
gold/split/predictions file.

## compare_extraction.py (PKG-T11)

Compares the text mode (deterministic offline fixture, one call per
eval page, no network) against the hybrid mode (text + live Meta)
over the SAME eval claims with the SAME v1-proposal mapping and the
SAME scorer, and writes `evidence/extraction_comparison.json`.

```powershell
uv run python scripts/compare_extraction.py --out evidence/extraction_comparison.json
uv run python scripts/compare_extraction.py --out /tmp/comparison.json --format json
```

Inputs:

- `--gold` / `--split`: same defaults as the scorer.
- `--out` (default `evidence/extraction_comparison.json`): artifact path.
- `--allow-live`: permit hybrid live calls. The hybrid runs only when
  a verified credential exists (MODEL_API_KEY + META_API_URL, gate G3)
  AND this flag is set AND `--page-texts` supplies every eval page;
  otherwise it is recorded as blocked with honest nulls, zero calls.
- `--page-texts`: JSON `{"document_file::page": text}` for a future
  live re-run (strict shape; anything else is exit 2).

Rules applied:

- Text fixture: 0 spend (0 micro-USD + reason), null tokens/model,
  really-measured per-call latency, every eval claim in the denominator.
- Hybrid blocked: every metric null (never zero), with the G3 reason.
- A failed live attempt is exit 2 with no artifact: a partial live
  table would be worse than no table.
