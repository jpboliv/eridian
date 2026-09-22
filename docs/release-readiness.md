# Next release readiness

The feature stack is being integrated at the maintainer's request on 2026-09-22.
Integration does not establish behavioral acceptance or authorize publishing the
release. Historical draft and failed-evaluation records remain evidence of their
named revisions; they are not relabeled as successful evaluations.

## Integration review

Reviewed PRs, in dependency order: #30 (shared clarity), #31 (artifact boundary),
#32 (levels), #36 (reinforcement), #25 (input overhead), #33 (team defaults),
#34 (help), #37 (session diagnostics), and #35 (investigator design only).
There were no unresolved GitHub review threads at review time.

The review found and corrected two runtime defects:

- Startup and explicit mode activation could emit stale persona instructions
  after a following off transaction. Activation output now completes under the
  state lock, matching periodic reminders. Regression tests exercise both paths.
- Textless streaming updates could raise the usage attached to old prose and
  suppress a later complete prose snapshot. Diagnostics now retain the usage of
  the selected prose snapshot and rebuild older diagnostic caches. Regression
  coverage includes textless updates before and after the first prose record.

The 20-prompt cadence remains unchanged. Experimental brief reminders and the
investigator definition are not installed runtime features. Historical calibration
factors remain unchanged and do not validate the revised rules.

## Publication gates

Keep release PR #38 open until the following work is complete:

- Implement and review Codex compatibility as a separate feature in this release.
  The implementation milestone is on `feat/017-codex-compatibility`; native app/
  CLI lifecycle, trust, usage-event, buddy-surface, and human quality gates
  remain open. See [Codex compatibility](codex-compatibility.md).
- Run the fresh repeated evaluation of the frozen revised rules described in
  [the level evaluation plan](clarity-levels.md#revision-2-rerun-plan), retain raw
  evidence, and resolve correctness/completeness failures. Earlier archives
  evaluate different rule hashes.
- Obtain human quality acceptance and an independent check that full remains
  recognizably Rocky. Code checks and assistant review are not human signoff.
- Complete the [cadence comparison](design/reinforcement-cadence.md), including
  post-refresh coverage and human acceptance, before claiming the cadence gate
  passed. Retaining the existing cadence does not prove it optimal.
- Recheck CI and the generated release notes after all release features land.

Paid provider evaluations were deferred during this integration review. No new
output savings, financial savings, or successful behavioral gate is claimed.
