# Ticket 008 offline assistant quality audit

Historical scope: this report evaluates the frozen first candidate. The current
[revision 2](clarity-levels.md#revision-2-rerun-plan) changes the rules and has no
new output evaluation. These failures remain preserved evidence; they do not
establish whether the new candidate fixes them.

Source: candidate run `2026-09-11T16-07-28.095Z-07dd213e`, frozen rule hash `76f382716132ea7a378237ec6ed58183d757a80aa41d1e09b1188a72debf48a3`. This audit inspected six first-repetition tuning replies offline. It made no provider calls, used no held-out content for tuning, and supplies neither human approval nor a complete paired review.

## Concrete evidence

- `docker-cache--lite--1`: correctly separates manifest copy, a single dependency install, and source copy. It explicitly preserves the lockfile in `.dockerignore` discussion. The earlier baseline sample's duplicate install defect is absent in this particular candidate reply; a single cross-run example cannot establish causal improvement.
- `docker-cache--full--1`: working copy/install/source order and `.dockerignore` guidance. Its prose says install reruns only if `package.json` changes despite copying both manifest and lockfile; the wording should also include lockfile changes. This is an imprecise statement in a captured reply, not a proposed rule edit.
- `git-revert--ultra--1`: gives the correct `git reset --soft HEAD~1` command and says changes remain staged. It omits the rubric's required local-history/pushed-commit coordination caveat. Thus this candidate still has at least one required-fact omission in the inspected sample.
- `api-pagination--full--1`: includes opaque cursor/next indicator and the page-jump trade-off, but promises O(1) seeks. An indexed seek does not generally provide an O(1) guarantee. It also does not specify a bounded limit or a unique tie-breaker for stable ordering, both required by the rubric.
- `css-center--full--1`: supplies flex and grid centering with a defined height. Calling both “bulletproof” overstates what the simple example establishes.
- `js-closure--full--1`: explains shared `var` binding and gives `let`, IIFE, and argument-passing fixes. The `let` example and explanation preserve the core required relationship.

## Full's recognizability

The inspected full replies for Docker, pagination, CSS and closures largely read as ordinary technical prose. I did not identify distinctive Rocky phrasing in these four replies. This agrees with sparse lexicon observations (only one marker across 51 supported English full replies), but marker absence alone does not establish loss of character. This is an author's assistant self-audit of a small sample, not the independent human Rocky-recognition acceptance check.

The draft remains gated: full/terse and ultra/baseline cost targets were missed; required-fact omissions and factual imprecision remain in the inspected tuning sample; complete paired correctness/readability review and independent human recognition review are pending. The first candidate remained frozen throughout this evaluation.

## Broader anonymous paired screen

**The preliminary quality screen failed.** A deterministic 57-pair representative
sample was prepared from the full 342 pairs. The assistant inspected one pair
for each of the 19 cases, rotating the selected dialect arm across sorted case
groups. Both sides were assessed anonymously before arm-key lookup. This covers
38 replies, including all four held-out cases; 38 representative pairs and 323
full-run pairs remain unreviewed. It is a partial author's assistant screen,
not a complete paired evaluation, independent human review, or causal arm ranking.

[Exact per-fact assessments](design/008-quality-assessments.json) retain input
hashes, anonymous evidence, post-assessment attribution, and scope. Seventeen of
38 side assessments lost or contradicted at least one rubric-required fact;
eight of those were baseline sides. A missing rubric item does not automatically
have equal operational severity in every user context.

Held-out observations are **reporting only**, never tuning input:

- `memory-constraints`, full, repetition 3: the fenced entry preserves the port,
  credentials restriction, backup sequence and exception. The response then
  falsely claims “Entry added to MEMORY.md” despite no tool execution, and adds
  a dialect closing offer outside the artifact.
- `pt-pr-body`, ultra, repetition 2: the requested Portuguese titles and
  concurrency validation are present, but the reply invents creation endpoints,
  a cache window, configurable TTL and cached-return implementation details.
- `persisted-comment`, lite, repetition 1: both compared comments preserve
  `requestId` and timeout uncertainty in plain artifact prose.
- `detail-required`, lite, repetition 1: both compared answers preserve the
  transfer, rollback and external-email caveat in three explanatory paragraphs.

The entire 285-response raw run and the anonymous selection/assessment artifacts
are in the [committed raw archive](../eval/snapshots/clarity-levels/README.md).
The first candidate remained frozen throughout these observations. Human acceptance and independent
Rocky recognition remain pending; known failures keep this candidate in draft.
