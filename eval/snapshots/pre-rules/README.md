# Pre-rules baseline — 2026-09-11

270 successful cells: 18 prompts × five arms × three repetitions. Model:
`claude-haiku-4-5-20251001`; Claude Code `2.1.268`. Four prompt cases were held out
from tuning. Raw replies, metadata, usage, diagnostics and anonymous review pairs
are preserved in `raw-run.tar.gz`; extraction recreates the immutable run directory.

Archive SHA256: `8e01ed811ea66d3e3ac7c605d85bf157dd0c8d32c054591e6dcd94006022f8b4`.

| Comparison | Pairs | Mean relative output reduction | Aggregate output reduction |
| --- | --- | --- | --- |
| lite vs baseline | 54 | -9.2% | -6.5% |
| full vs baseline | 54 | -173.7% | -142.9% |
| ultra vs baseline | 54 | -212.7% | -202.3% |
| lite vs terse | 54 | -14.0% | -9.1% |
| full vs terse | 54 | -182.7% | -148.9% |
| ultra vs terse | 54 | -227.7% | -209.8% |

Negative reductions mean more output tokens. Provider output includes thinking;
these measurements do not establish prose-only or financial savings. The candidate
calibration is all-output scope and is deliberately inapplicable to runtime prose
accounting. No historic factor file is overwritten.

The full ≤ terse and ultra ≤ baseline targets are unmet in this baseline. The
per-prompt distributions in `summary.json` show substantial variation. This is new
evidence on its named model, not a reconstruction of missing July 22 raw data.

Paired model-assisted review and synthetic multi-turn baseline are captured separately.
Human correctness/completeness/readability sign-off remains pending and blocks
release acceptance; token counts alone do not pass quality gates.
