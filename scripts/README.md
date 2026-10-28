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
