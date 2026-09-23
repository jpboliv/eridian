# OpenCode compatibility

Eridian includes a local OpenCode plugin adapter. It uses the canonical rules in
`skills/speak/SKILL.md` and the shared mode/defaults implementation.

## Install

Keep this checkout at a stable path, then run from its root:

```sh
# Install for one project (replace the target path).
node scripts/opencode/install.js /path/to/project/.opencode

# Or install globally.
node scripts/opencode/install.js "${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
```

Restart OpenCode after installation. The installer adds only `plugins/eridian.js`,
which imports the adapter from this checkout. It does not modify OpenCode config,
install dependencies, or overwrite a different existing loader. Repeating the same
installation is safe. Do not install both globally and in the same project.
Remove that loader to uninstall; saved Eridian state is retained. If the checkout
moves, remove the old loader and run the installer again.

## Commands

| Command                                         | Behavior                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `/eridian-mode`                                 | Toggle off/full                                                                   |
| `/eridian-mode lite\|full\|ultra\|eridian\|off` | Set mode; `eridian` aliases `ultra`                                               |
| `/eridian-mode reset`                           | Re-read defaults for this session                                                 |
| `/eridian-mode status`                          | Report current mode, source, and saved preference                                 |
| `/eridian-help`                                 | Show commands and limitations                                                     |
| `/eridian-review [revision]`                    | Request a read-only substantive review                                            |
| `/eridian-commit [request]`                     | Preview a conventional commit from staged changes; confirmation precedes creation |

Existing commands with these names take precedence. Mode changes are handled by
the plugin using OpenCode's session ID, without shell interpolation or asking the
model to edit state. Commands still create a model turn to report the result.
Review and commit are model instructions, subject to the host's permissions.
Natural-language style requests do not persist a preference; use the mode command.

## State and injection

State lives at `$XDG_STATE_HOME/eridian/opencode/state.json`, falling back to
`~/.local/state/eridian/opencode/state.json`. `ERIDIAN_STATE_DIR` selects a base
directory with an `opencode` child. Claude and Codex state is not imported.

New sessions resolve `ERIDIAN_DEFAULT_MODE`, repository `.eridian.json`, user
Eridian config, saved preference, then off. Each session retains its snapshot
across plugin reloads and compaction. Explicit levels also update the future-session
preference; reset does not. Session state is initialized on the first model call or
mode command, not when an empty session is created. State has no automatic pruning.

Launch with `ERIDIAN_OFF=1 opencode` to suppress persona injection and mode writes
without reading saved state. This cannot erase instructions already in a transcript
or override explicit user instructions.

The adapter appends shared and level rules through
`experimental.chat.system.transform` for each identified model request. It preserves
existing system text. This uses OpenCode's rebuilt system prompt rather than the
Claude/Codex 20-prompt reminder cadence. Calls without a session ID receive no persona.
The hook does not identify the agent, so host auxiliary calls with a session ID may
also receive the style rules. Full payload injection adds input overhead; no savings
claim is made.

## Validation and limits

Contract checked against the official [plugin documentation](https://opencode.ai/docs/plugins/),
[command documentation](https://opencode.ai/docs/commands/), and
[hook types](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts)
on 2026-09-23. The system transform hook is experimental and may change.

Node tests exercise plugin loading, command registration, mode transitions, default
precedence, reload persistence, session isolation, opt-out, and installer conflicts.
A live OpenCode session has not been validated. Before release, verify command
discovery, activation, off/reset, resume, and compaction in the target OpenCode version.

This adapter does not implement token accounting, savings estimates, buddy/TUI or
pet rendering, diagnostics, or guarded memory compression. Claude and Codex retain
their existing integrations.
