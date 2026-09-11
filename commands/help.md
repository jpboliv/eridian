---
description: Show levels, commands, defaults and how to turn Eridian off
---

Return the following help card in the user's language, at most 30 lines. Preserve command names and paths. Show only this card; do not run tools, change mode, or persist anything.

Eridian help

Levels: lite — concise grammatical prose; full — clear Rocky voice, the default when activating; ultra — optional extra personality, at most one decorative marker per ordinary reply.

| Command | Use |
| --- | --- |
| `/eridian:mode` | Toggle this session; activation selects full. |
| `/eridian:mode lite\|full\|ultra\|off` | Set this session and the saved preference for future sessions. |
| `/eridian:mode reset` | Clear this session's override and resolve current defaults again. |
| `/eridian:stats` | Show this session's available output-reduction estimates and retained lifetime scope. |
| `/eridian:buddy <seconds>` | Set the minimum animation step interval. |
| `/eridian:commit` | Preview a plain conventional commit from staged changes. |
| `/eridian:review` | Review changes with the command's finding format. |
| `/eridian:compress` | Preview a denser file draft with backup and semantic review. |
| `/eridian:help` | Show this card without changing state. |

Session off wins over defaults; mode changes also save a future-session preference. Other active sessions keep their mode. Reset does not erase that preference.
Start Claude with `ERIDIAN_OFF=1` to suppress automatic persona hooks and mode changes for the entire run; saved settings stay unchanged.
Team defaults: repo `.eridian.json` or user `~/.config/eridian/config.json`, with `{ "defaultMode": "lite" }`. `ERIDIAN_DEFAULT_MODE` can also set a default.
See the README's team-defaults section for precedence, discovery boundaries and invalid-config behavior.
Persisted artifacts use plain prose in the requested language. Estimates are output reductions, not measured money savings.
