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
