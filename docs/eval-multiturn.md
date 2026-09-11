# Multi-turn controlled context replay

`eval/multiturn.js` compares explicit injection policies using actual CLI replies,
three repetitions, and two fixed 22-turn scenarios. The drift scenario crosses
the twentieth-prompt refresh. The lifecycle scenario changes full → ultra → off
→ full, resumes, and compacts. Every prompt requires preserving the production-data
prohibition and rollback requirement. These are synthetic scenarios, not evidence
that real Claude Code hooks, resume, or compaction work.

```sh
node eval/multiturn.js --allow-paid --policy start-only
node eval/multiturn.js --allow-paid --policy interval20
node eval/multiturn.js --allow-paid --policy brief --brief-file /path/to/reminders.json
```

Runs can incur provider usage. Nothing runs on import; the API also requires
`allowPaid: true`. Tests invoke a local fake executable and never contact a model.
Default model is `claude-haiku-4-5-20251001`; `--model`, `--out`, and
`--repetitions` (minimum three) override defaults. `--concurrency` runs independent
scenario repetitions in parallel (default three, maximum six); turns within each
conversation remain sequential. Full rules come from the current
persona injection blocks. The brief policy requires a JSON object with `lite`,
`full`, and `ultra` string payloads; no proposed reminder is silently invented.
Run all policies with the same rule/scenario/model hashes for a valid comparison.

Each call sends a JSON-encoded conversation replay as one user prompt to `-p`.
Historical user/assistant roles and injected payloads are explicit data fields;
they are not native provider roles. Current mode is stored only in result metadata;
ordinary replay turns contain no repeated mode label or implicit mode reminder. Complete replies are replayed on later turns.
Simulated resume retains context and inserts the full current-mode rules.
Simulated compaction replaces replay context with a fixed summary, retaining the
full transcript separately; it does not exercise real host summarization.

All policies send full rules at start and active mode changes/resume/compaction.
`start-only` has no periodic refresh. `interval20` sends full rules on absolute
prompts 20, 40, etc.; `brief` sends the supplied current-mode reminder on every
active prompt that does not already receive a full lifecycle injection. Off emits one explicit disable instruction, then suppresses injections.
This fixed absolute schedule is an experimental policy, not a claim about the
runtime's current counters. Compare drift separately from lifecycle responses.

Isolation matches the single-turn harness: safe mode, ERIDIAN_OFF, empty tools
and MCP, disabled skills, fresh temporary working directory, no persisted session,
and an explicit system prompt. Manifest records invocation, CLI/model versions,
rule/scenario/scorer/brief hashes and exact payloads. Unique run directories use
exclusive writes; prior evidence is never overwritten. Each turn retains its
exact request, raw CLI stdout/stderr/exit status, provider usage including cache
fields, returned model metadata, timestamps, reply, and style diagnostics.

A failed, truncated, or missing-usage result aborts that scenario repetition;
remaining turns are counted as skipped, never fabricated or treated as zero.
Other repetitions still run and retain evidence. `quality-review.json` requires
semantic review at every turn, covering correctness, completeness, actionability,
readability and critical fact loss. Diagnostics and token counts alone cannot
pass that gate. Review early, pre/post refresh, mode/off, resume, and compaction
turns explicitly. Output usage may include thinking; replay input repeatedly
includes context. These results cannot calibrate live-session savings or prove
quality equivalence without the separate review and runtime integration tests.
