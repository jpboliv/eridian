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

## Pull requests

- Tests, lint, and format checks must pass:
  `npm test && npm run lint && npm run format:check`.
- Keep changes focused — no unrelated refactors bundled into a PR.
- If your change could plausibly shift measured token savings (dialect
  wording, level rules), recalibrate and update the numbers:

  ```bash
  bash eval/run.sh
  node eval/compute-factors.js
  ```

  then update the README savings table and `eval/factors.json` if they moved.
