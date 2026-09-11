# Team defaults and session overrides (ticket 012)

This draft depends on ticket 015's session state and ticket 010's final cadence.
It does not choose or change the reinforcement cadence. The temporary PR base is
009; it must incorporate 010 and final 002 measurements before release.

## Resolution and lifecycle

A dedicated resolver applies: `ERIDIAN_OFF=1` first, explicit session override
(including off), valid `ERIDIAN_DEFAULT_MODE`, repository `.eridian.json`, user
`~/.config/eridian/config.json`, persisted future-session preference, then off.
Config values allow only `lite`, `full`, `ultra`, and `off`. Aliases remain a
command convenience, not a configuration value.

The first session event snapshots its resolved mode, source and repository root.
An existing session retains that snapshot on resume/compaction and when defaults
change. A mode command sets that session's explicit override and also updates the
future-session preference, preserving existing persistence. Other live sessions
retain their own mode and history. No-argument activation from off remains full.
Explicit off wins over all defaults; environment opt-out wins even over an active
override without mutating saved state.

`/eridian:mode reset` clears only the current session override and resolves defaults
again using its current working directory. It does not clear the saved global
preference. Reset records an activation boundary and resets the reinforcement
counter. Without a session identity, reset reports that identity is required;
ordinary mode changes still save a future-session preference as before.

Version-2 sessions predating this feature retain their saved current mode as a
legacy snapshot; no retroactive attribution or forced default change occurs.
Their next explicit mode change creates an override; reset adopts config defaults.
Hooks, statusline and accounting share the same persisted session current mode.
Cadence and full-injection semantics stay owned by ticket 010.

## Discovery and defensive reads

Discover the nearest ancestor containing a `.git` entry, stopping at that root;
look for `.eridian.json` only there. A git worktree's `.git` file is a valid marker.
For an unversioned directory, inspect only that directory. Never read a config
above the detected repository root. User config is independent of the Claude
statusline settings adapter and may use `XDG_CONFIG_HOME/eridian/config.json`.

Only regular config files of at most 4096 bytes are accepted. Refuse symlinks in
any component and check file size before a bounded read. Reject malformed JSON,
arrays, unexpected keys and unknown mode values. Never emit raw config content.
Invalid environment/config sources fall through to the next source and emit at
most one short fixed diagnostic per resolver invocation on stderr; errors must
not block host work. Missing files are normal and silent. Checks are defensive
reads, not a sandbox against a hostile process replacing ancestor directories.

## Validation

Test every precedence source, explicit off, opt-out, invalid and oversize config,
symlink aliases, root boundaries, two concurrent repositories, unchanged active
snapshots when defaults change, resume/compaction, reset and persistent preference.
Verify all runtime consumers observe the same mode and activation history retains
rule identity. No quality acceptance or human review is implied by these tests.
