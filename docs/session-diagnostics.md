# Optional session style diagnostics (ticket 013)

Decision: GO for an explicitly requested `/eridian:stats --diagnostics` report of
transparent observations. NO-GO for statusline or buddy feedback: user evidence
that those signals are understood is absent, and the core quality release gate
remains open. No numeric quality score, reading-time claim, or automatic advice
to remove uncertainty is introduced.

The caller must provide a session ID through the existing command mechanism.
`--language en` opts into the English lexical dictionary; absent language defaults
to `und` (unsupported lexical scoring), not English and not a zero. Structural
counts still apply. `--transcript PATH` can select that caller's transcript;
otherwise use only the path in its own schema-2 accounting cache. Never select
the newest transcript or another session's cache.

Reply boundaries are assistant message IDs (and model), with outer UUID fallback.
Cumulative streamed snapshots with the same identity count once: retain the largest
reported cumulative output usage, breaking ties by visible text length. Without
usage retain the longest text snapshot. Raw deltas are not complete replies and
are ignored. Records without identity are excluded rather than guessed. Explicit
transcript session-ID mismatches are excluded. Tool/thinking/artifact content blocks
are excluded; text blocks use the shared scorer's code/quote exclusions. Unmarked
artifact text and language mixing cannot be identified reliably; this is observed
assistant prose, not all output and not a completeness assessment.

Aggregate raw phrase counts and prose words, then divide once for phrase matches
per 100 prose words. Never average per-reply rates. Lexical unsupported results
remain null. Report included replies, excluded identities and denominators.

A separate locked cache under `diagnostics/` stores per-reply observations, scorer
version/hash and language. Incremental reads retain incomplete JSONL bytes until
a newline completes them. Replacement/truncation, changed language/scorer and
invalid caches rebuild; unchanged transcripts require only bounded fingerprint
reads. File identity plus size/time and head/previous-tail fingerprints detect
replacement and common rewrite cases. Concurrent arbitrary in-place edits in the
middle of an otherwise appended file are outside the append-log contract.

The scanner is invoked only by optional stats, never by statusline refresh. Raw
assistant text is not copied into its cache. Clear the separate diagnostics cache
to rebuild observations without altering accounting history. Large per-message
records above 1 MiB are excluded with a count; diagnostics must not block host work.
