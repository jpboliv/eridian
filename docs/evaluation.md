# Reproducible style evaluation

Run `bash eval/run.sh` to make paid provider requests. The default is three
repetitions of each of 18 cases across baseline, plain terse, lite, full, and ultra.
The pinned default model is `claude-haiku-4-5-20251001`; override with `--model`.
Use `--repetitions`, `--concurrency` (1–16), `--prompts`, or positional arm names
for development runs. Fewer than three repetitions or incomplete arms are not
release comparisons. No evaluation runs as a side effect of docs changes or tests.

Each invocation creates a unique directory under `eval/runs/`. It retains the
prompt suite, exact rule payloads and hashes, CLI/model/invocation metadata,
per-cell raw stdout/stderr and exit status, parsed replies, provider usage,
completion/error status, deterministic style diagnostics, summary, and anonymized
review pairs with a separate answer key. Files are created exclusively; later
runs cannot overwrite them. Interrupted invocations retain completed cell files;
a missing completion file means the run is incomplete, not zero-token output.

## Isolation and applicability

Style comparisons run from a fresh temporary directory with `ERIDIAN_OFF=1`,
Claude Code safe mode, tools and skills disabled, an empty strict MCP config,
no session persistence, and the same explicit system prompt for every arm.
The dialect arms receive the captured persona prefix explicitly. This removes
user/project customizations for isolated comparisons. Managed host policy may
still apply; record it separately if your deployment adds policy instructions.
Runtime hooks, attribution, mode changes, concurrency, resume, and compaction
are a separate integration scope and must not be inferred from these results.

Provider `usage` and `modelUsage` are preserved separately because they can
represent different scopes. `usage.output_tokens` includes thinking when the
provider reports it; it is not a count of user-visible prose. Code and tools also
have different applicability from prose. These runs therefore support all-output
style comparisons only. Do not label their factors `prose-only` or apply them to
historical runtime output without compatible provenance and output categorization.

## Aggregation and quality gates

`node eval/compute-factors.js <run-directory>` reports every repetition, paired
by prompt and repetition. It rejects mixed run/rule identities and signals
incomplete coverage. The report distinguishes mean relative reduction across
pairs from aggregate token reduction (ratio of token totals), and includes sample
counts, min/quartiles/median/max and per-prompt distributions. Negative reductions
are retained. Reports never silently rewrite `eval/factors.json` or reprice history.

Ten original coding cases remain, with required-fact rubrics. Additional cases
cover Portuguese, ambiguity, uncertainty, ordered constraints, requested tables,
PR bodies, comments, memory artifacts, and requested detail. Four cases are
held out from rule tuning. Review anonymized pairs against correctness,
completeness, actionability, readability, and lost critical constraints before
unmasking arms. Preserve reviewer identity, method, rationale, and failures.
Any lost critical fact blocks quality acceptance regardless of token reduction.
A model-assisted assessment does not replace a human review; human sign-off
remains explicitly pending until supplied.

Style phrase matches are English diagnostics, not quality or reading-time scores.
Unsupported languages retain structural observations and a support indicator.
Headers, tables, uncertainty, and requested structure need not decrease.

## Historical evidence

The committed July 2 CSV is an older single-run observation. The README's July 22
full/ultra percentages have no corresponding raw snapshot. A new snapshot measures
its named model and rules; it does not reconstruct or validate the missing history.
Archive completed runs under `eval/snapshots/` together with a readable summary
and quality review. Preserve raw response bytes in the archive and identify its hash.
