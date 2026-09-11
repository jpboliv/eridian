# Ticket 008 offline assistant quality audit

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

The draft remains gated: full/terse and ultra/baseline cost targets were missed; required-fact omissions and factual imprecision remain in the inspected tuning sample; complete paired correctness/readability review and independent human recognition review are pending. No payload was tuned after evaluation.
