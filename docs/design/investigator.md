# Investigator-first decision — ticket 004

**No-go for shipping a crew preset.** Core behavioral quality has not passed its
release gate, and comparative delegation measurements are unavailable. The provider
returned an individual spend-limit error during the roadmap evaluation on 2026-09-11;
no further calls or alternative accounts were used. No context-saving percentage,
latency benefit, or quality equivalence is claimed. This PR provides the design and
review fixtures; the comparative benchmark remains blocked and the PR stays draft.

## Proposed boundary and discovery

The candidate name is `eridian-investigator`: read-only code location and evidence.
The experimental definition lives under `eval/crew/`, outside plugin discovery.
There is no automatic spawning rule and no installed agent or command. Delegate
only when a bounded search can run independently and its returned evidence helps
the parent continue. A known one-line answer, small direct read, or task needing
unbounded architecture discussion stays inline. Builder/reviewer presets require a
subsequent design backed by observed need; they are not part of this candidate.

Return status, exact paths/lines/symbols, source evidence, confidence, searched scope
and limitations. `no-match` must state the searched scope; incomplete runtime facts
must remain uncertain. Evidence may expand to preserve clarity. Machine-consumed
results use plain prose/JSON with no decorative Rocky dialect.

The design considered [Caveman's crew contract](https://github.com/JuliusBrussee/caveman/blob/8909f6af8806897cbb8330c11028eee168ad7cc7/skills/cavecrew/SKILL.md)
at revision `8909f6af8806897cbb8330c11028eee168ad7cc7`. It is upstream design input,
not Eridian measurement. This candidate uses explicit evidence and uncertainty
fields rather than inheriting an upstream savings claim.

## Required comparison before reconsidering

Use the same frozen repository fixture, task, model, tools and rule identity in
three arms: work inline, delegate to an ordinary investigator, and delegate to the
candidate. Run at least three repetitions per task/arm in randomized order. The
fixtures cover definition/caller tracing, a missing symbol, and ambiguous dynamic
dispatch. Add a real repository search before a product decision; tiny fixtures
alone are not representative of broad investigation.

Retain full parent/subagent transcripts, raw provider usage (including cache fields),
model/CLI versions, source hashes, tool calls, completion/error status and wall time.
Measure the actual final subagent tool-result payload entering parent context,
separately from total parent+subagent usage and latency. A final parent answer's byte
length is not parent-context consumption. If the host does not expose the boundary,
report that metric unavailable; do not substitute a misleading proxy.

Use the supplied fixture contract checker for literal path/line/evidence validation,
then independently review whether findings explain the requested behavior, preserve
uncertainty, and enable the next step. Format checks alone cannot establish usefulness.
Any missing critical evidence blocks acceptance. Report failures, parent-context
size, total usage and latency separately, with distributions and sample counts.

Reconsider the no-go only when the candidate preserves task quality and demonstrates
useful parent-context reduction without unacceptable total work or latency. Human
review remains required. Until then, no preset is installed and no unmeasured
percentage appears in the product README.
