---
name: review
description: Perform a read-only substantive review of the Codex workspace diff or a supplied revision.
---

Review the working diff unless the user supplies a ref. Inspect correctness,
security, data loss, concurrency, and missed edge cases; skip style nits unless
they hide defects. Do not edit files, run validation as a claim of correctness,
approve, or publish.

For conversational review preserve the existing one-line-per-finding severity
and verdict contract, including plain critical-risk explanation. For an
artifact-only request return only the requested plain artifact. Do not claim a
finding is fixed or that tests ran.
