# Reinforcement cadence comparison — 2026-09-11

**Decision: retain the current full refresh every 20 active prompts.** This is a
conservative unchanged default, not a demonstrated optimum. The provider's
individual spend limit stopped the experiment before any interval-20 conversation
reached its first periodic refresh. Completed comparisons and human acceptance
remain pending; this snapshot cannot justify switching to per-prompt reminders.

Three policies each planned two fixed 22-turn scenarios × three repetitions,
with six concurrent sessions per policy. All runs use the same ticket-008 full
payloads, `claude-haiku-4-5-20251001`, CLI `2.1.268`, rule/scenario/scorer hashes,
and corrected replay without per-turn mode labels. Earlier confounded baseline
runs were not reused. See manifests for exact payloads and invocation.

| Policy | Complete | Failed | Skipped | Planned |
| --- | ---: | ---: | ---: | ---: |
| start-only + lifecycle | 97 | 6 | 29 | 132 |
| interval20 + lifecycle | 86 | 6 | 40 | 132 |
| brief every active prompt + lifecycle | 79 | 6 | 47 | 132 |

The 18 failed records retain raw provider 429 responses reporting an individual
spend limit, with a stated reset at 19:20 Europe/Lisbon. They are failures, not
zero-token successes. Subsequent turns are skipped; no continuation was invented.
All 280 attempted requests/raw responses and 262 complete replies are archived.

## Comparable observed subset

The intersection contains 73 completed scenario/repetition/turn cells per policy.
None includes a periodic interval20 injection: start-only and interval20 have
identical injected-character totals in this subset. Their output differences
therefore cannot estimate the effect of interval20 reinforcement.

| Policy | Input tokens | Cache creation input | Cache read input | Output tokens including thinking | Injected characters | Replayed request characters | Rocky marker matches |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| start-only | 167846 | 18740 | 0 | 72504 | 17863 | 573572 | 2 |
| interval20 | 156047 | 31496 | 0 | 78399 | 17863 | 580935 | 2 |
| brief | 170710 | 33300 | 0 | 86490 | 27837 | 655709 | 5 |

Brief reminders added injected text and replay context without establishing a
quality benefit. In this subset they also have the largest output total, but
three repetitions, incomplete coverage and evolving reply histories do not
establish a causal or reliable general effect. Style phrase matches were zero
for all three policies. These safety-focused scenarios permit plain phrasing
under the clarity rules, so low Rocky-marker counts do not prove drift.

`comparison.json` retains distributions, per-scenario totals, early/pre/post-refresh
windows, failure IDs and a literal-constraint screen. Input, cache creation and
cache read are separate provider fields; their costs are not interchangeable.
Character counts are not tokens. Replayed context is repeatedly sent as one user
message; this does not measure real host hooks, native multi-turn roles, tool
rounds, cache behavior in a real session or billed session input. No monetary or
runtime prose-saving estimate is derived.

## Runtime decision and follow-up

Keep full activation on SessionStart and explicit mode changes. Runtime refreshes
on the twentieth active prompt after the last startup/resume/compaction or mode
reset; counters and modes are per session. The replay interval is absolute turn
20, so lifecycle resetting is verified separately in runtime tests. Reminder
emission is serialized with state commit, preventing a concurrent off command
from committing before an already-selected reminder is emitted. Off and
`ERIDIAN_OFF=1` suppress style injections.

Experimental reminders are defined once in the skill's marked regions and are
not selected for runtime use: lite/full/ultra measure 34/34/30 tokens using
`tiktoken` 0.12.0 with `o200k_base`, an approximation of host-tokenizer cost.
No full payload was changed during the runs.

Required before changing cadence: complete comparable post-refresh coverage,
review semantic failures, broaden drift scenarios beyond precision-sensitive
warnings, and obtain human acceptance. The [advisory review](quality-review.md)
records concrete defects across all policies; literal anchor preservation cannot
clear the quality gate.

Raw archive and summary hashes are in `archive-hashes.json`. Reproduce the report
without provider calls using `node eval/compare-multiturn.js <start-only-run>
<interval20-run> <brief-run>` after extraction.
