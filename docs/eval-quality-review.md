# Optional paired model review

After an evaluation run finishes, explicitly opt into paid model review:

```sh
node eval/review.js --run eval/runs/<run-id> --execute --concurrency 4
```

The default judge is pinned to `claude-haiku-4-5-20251001`. `--model` changes it
explicitly. The CLI consumes only `paired-review.json`; it never reads
`paired-key.json` or arm metadata. The judge sees the original prompt, requested
language, required facts, and anonymous answers A/B. Condition ordering follows
the evaluation pairing. Visible dialect can still reveal the condition.

Every answer gets correctness, completeness, actionability, and readability
scores from 1 (fails) to 5 (fully satisfies), each with evidence. Every required
fact must receive a preserved/missing/incorrect/uncertain assessment and reason,
in input order. Missing or incorrect required facts require a true
`criticalConstraintLoss` flag. A comparison preference (A/B/tie/uncertain) and
rationale are also required. These assessments are model opinions, not verified
facts. Necessary uncertainty and requested formatting must be assessed against
the original task, not treated as automatic defects.

The judge runs in a fresh temporary directory with `ERIDIAN_OFF=1`, safe mode,
no tools, no MCP servers, disabled slash commands, no session persistence, and an
explicit review system prompt. Concurrency defaults to four and is limited to
1–16. Each call has a three-minute timeout. Testing uses an injected fake CLI;
`npm test` never makes paid review calls. The JavaScript API exports
`review({ run, execute: true, cli, model, concurrency, timeoutMs })` for controlled
invocation and tests.

Each invocation creates a unique directory under the run's `quality-reviews/`.
Files are created exclusively; reruns do not modify prior artifacts:

- `manifest.json`: model and its hash, CLI version and its hash, input and system
  prompt hashes, reviewer source hash, invocation, isolation, and limits.
- `<pair-id>.input.json`: exact anonymous payload; its hash is in the record.
- `<pair-id>.raw.json`: exact CLI stdout/stderr, exit status, and timeout/error.
- `<pair-id>.json`: validated judgment or failure, hashes, duration, provider
  usage/model usage, and actual model identifiers when available.
- `records.json` and `completion.json`: retained records and completion counts.

Bare JSON or one enclosing Markdown JSON fence is accepted; additional commentary
is rejected. Malformed JSON, incomplete dimensions, missing fact assessments, contradictory
loss flags, failed/truncated completions, nonzero exits, and timeouts fail closed.
They produce failed records and a nonzero CLI exit; they never become successful
reviews or approval. Provider-reported usage is retained even for invalid
judgments when present in a parseable response envelope. Raw records preserve
remaining evidence when an envelope cannot be parsed. Immutability means this
program does not overwrite prior artifacts; filesystem owners can still edit them.

Human paired review remains **pending**, including after every model review
succeeds. Same-family judges can share model biases; anonymity does not remove
style cues or prompt-injection risk from judged text. This optional assistance
cannot clear the human quality gate, approve release, or establish that token
reductions preserve correctness. Keep human findings and approval separately
attributed; do not relabel model output as human review.

## Offline revalidation

If a parser correction is needed, retain the original collection and revalidate
its raw responses without making another provider call:

```sh
node eval/review.js --revalidate eval/runs/<run-id>/quality-reviews/<review-id>
```

This requires the original collection to be complete. It checks each anonymous
input against its recorded prompt hash and creates a new sibling directory with
the source manifest/raw/input hashes, new reviewer hash, copied raw evidence, and
new validated records. Original records are untouched; malformed or contradictory
judgments still fail. Provider usage is carried forward as original-call evidence,
not additional consumption. Human review remains pending.
