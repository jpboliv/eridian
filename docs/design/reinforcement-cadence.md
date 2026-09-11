# Reinforcement cadence experiment (ticket 010)

Freeze ticket 008's candidate payloads before collecting any policy results.
Compare start-only (plus lifecycle injections), full interval-20, and brief
per-active-prompt reminders on the same two 22-turn synthetic scenarios, with
three repetitions per policy. Each policy runs six independent sessions in
parallel; turns within a session remain sequential. Pin the model and capture
all exact requests, raw responses, usage, replies, diagnostics and hashes.
The earlier baseline with a mode cue on every turn is not a comparator.

Short reminders are defined once in marked `eridian:inject:reminder-LEVEL`
regions of the skill, at most 40 tokens each under the named measurement.
All policies see the same full payloads and skill hash. Brief reminders reinforce
the shared clarity/artifact boundary without trying to replace the full rules.
They remain experimental unless results justify selecting them.

Compare correctness and complete task results first, then visible style markers,
context size and provider usage. Review replies for both required constraints;
structural detection is a screening aid, not semantic or human signoff. Report
no-benefit cases and failures. Provider output may include thinking; provider
input/cache counters and hook-emitted text measure different things. Replayed
context is not actual host sessions, native roles, compaction or billing.

The current runtime cadence is a full refresh after 20 active prompts since the
last startup/resume/compaction or explicit mode change. Off and ERIDIAN_OFF=1
suppress injection. Counters are session-specific and serialized. The controlled
replay's interval policy uses absolute turn 20, so lifecycle comparisons cannot
validate the runtime's reset-based counter directly; separate runtime tests do.
Retain the existing default if evidence is insufficient to justify another one.

Release gate: retain raw experiments and a readable comparison, then require
human acceptance. Model/code review must not be labeled human approval.

## Revised rule candidate and rerun

The review corrections in tickets 007/009/008 change the injected payload. The
archived incomplete comparison belongs to its original rule hash and does not
measure the revised candidate. Keep those raw runs intact. A new comparison must
start fresh conversations for all three policies after the final rule source is
frozen; appending turns to the old conversations would mix treatments.

After provider access resumes, run each command from this ticket's worktree and
retain the distinct output directories printed by the harness:

```sh
node eval/multiturn.js --allow-paid --policy start-only --repetitions 3
node eval/multiturn.js --allow-paid --policy interval20 --repetitions 3
node eval/multiturn.js --allow-paid --policy brief --repetitions 3
```

Use `eval/compare-multiturn.js` with the three resulting run directories in that
order. Verify completion of all 396 turns and comparable post-refresh coverage,
then inspect semantic correctness and complete task results before interpreting
usage or style. Failed or skipped calls remain failures; neither old results nor
runtime counter tests clear this candidate's behavioral gate. The existing
20-prompt runtime cadence is retained while that comparison is unavailable.
