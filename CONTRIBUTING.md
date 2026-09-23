# Contributing

## Setup

```bash
git clone https://github.com/jpboliv/eridian.git
cd eridian
npm install
```

## Development

```bash
npm test             # unit tests (node:test, zero deps)
npm run lint         # eslint
npm run format:check # prettier check (npm run format to auto-fix)
```

## Dialect rules

All Rocky-dialect rules (levels, invariants, examples) live in one place:
`skills/speak/SKILL.md`. If you're changing how eridian talks, change it
there — don't re-derive or duplicate rules in commands or scripts.

## Shared workflows and diagnostics

Commit and review behavior lives in `workflows/commit.md` and `workflows/review.md`.
Edit those policies, then run `npm run build:workflows` to regenerate the Claude
commands and Codex skills. The generated wrappers contain the complete policy;
installed hosts do not need to resolve a separate policy file. CI runs
`npm run check:workflows` to detect drift. Host-specific invocation metadata
belongs in `scripts/build-workflows.js`.

Diagnostic snapshot selection and aggregation live in
`scripts/lib/diagnostics-core.js`. Keep transcript parsing, session identity,
reader error counts, and cache storage in the host adapters. The Claude cache
fingerprint includes the shared reducer so policy changes invalidate saved results.

## Pull requests

- Tests, lint, and format checks must pass:
  `npm test && npm run lint && npm run format:check`.
- Keep changes focused — no unrelated refactors bundled into a PR.
- If your change could plausibly shift measured token savings (dialect
  wording, level rules), recalibrate and update the numbers:

  ```bash
  bash eval/run.sh
  node eval/compute-factors.js <run-directory>
  ```

  then retain the immutable run and paired quality review, and update the README
  with distributions and limitations. Runtime factors require compatible model,
  rule provenance and prose-only applicability; do not overwrite historical
  calibration using unreviewed all-output comparisons. See `docs/evaluation.md`.
