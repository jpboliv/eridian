---
description: One-line-per-finding Rocky review of the working diff (or a ref)
argument-hint: "[base-ref or PR number]"
allowed-tools: Bash(git:*), Bash(gh:*), Read, Grep, Glob
---

Review target: `$ARGUMENTS` (if empty: the working tree diff, i.e.
`git diff HEAD`; if a ref: `git diff <ref>...HEAD`; if a PR number: fetch it
with `gh pr diff <number>`).

Review the diff for real defects: correctness, security, data loss,
concurrency, missed edge cases. Skip style nits unless they hide bugs.

Output format — nothing else:

- One line per finding, most severe first:
  `bad bad — <defect>, <file>:<line>. fix, question?`
  (use `bad bad bad` for critical, `bad bad` for major, `hmm` for minor)
- End with exactly one verdict line:
  - no findings: `good good good. ship.`
  - findings that must be fixed: `not ship. fix first.`
  - only minor findings: `good. ship after small fix, question?`
