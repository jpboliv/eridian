# Session accounting (ticket 015)

Global preferences select the mode for new sessions and buddy speed. Effective mode,
activation history, reinjection countdown and animation state belong to a session.
Hooks use stdin `session_id`; commands accept `--session-id ID` or
`CLAUDE_SESSION_ID`. Command templates pass the host session substitution explicitly.
Invalid or absent identity never resolves to the newest session: mode commands update
preferences and output the persona but cannot claim session attribution; hooks do not
mutate session state. Resume and compaction preserve the session's chosen mode and
reset its countdown; startup records an activation only when identity is available.

State schema 2 retains legacy events under `legacy` with attribution explicitly
unknown. Migration preserves mode and buddy speed, discards ephemeral global buddy
state, and invents no session events. Histories and accounting records are retained
until users delete the state directory; no automatic pruning silently reduces lifetime
totals. Runtime objects are per session. This is a local, single-host store.

Read-modify-write transactions hold a filesystem lock across reading and atomic
replacement. Lock ownership records the process ID. Dead owners are reclaimed;
live owners are never stolen, and contention times out rather than losing updates.
Uninitialized locks can be reclaimed only after a grace period. Temporary files use
random names and are cleaned on failure. State and accounting use separate locks;
accounting never writes global state while holding its lock.

Accounting cache schema 2 stores messages by provider message ID (UUID fallback),
merges repeated streaming usage using the largest cumulative output count, and stores
the calibration snapshot at first observation. Content without an identity is
excluded. Only text-only output without code markup can qualify as prose; tool,
thinking, mixed and unknown output remain observed output, never measured prose
savings. Calibration must explicitly identify model, rule provenance, identity and
`prose-only` scope; existing unscoped factors are not applicable. Estimates are output
reduction, may be zero or negative, and are never money saved. Historical records
retain their original calibration even after factors change. A full rescan handles
transcript replacement and streaming correction; retention is intentionally unbounded
and transcript scanning cost is a documented limitation pending incremental indexing.

Stats selects the caller's exact cache and labels absence as unavailable. Lifetime
means all retained schema-2 session accounting caches, not every transcript on disk.
Legacy global windows are shown as unknown attribution and never repriced. Runtime
fixtures cover activation inside an existing session, off, and independent sessions.
