---
description: Toggle eridian mode or set level (lite | full | ultra | off)
argument-hint: "[lite|full|ultra|eridian|off]"
allowed-tools: Bash(node:*)
---

Mode change result:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/mode.js" $ARGUMENTS --session-id "${CLAUDE_SESSION_ID}"`

Follow the result above:

- If it shows `eridian disabled for this run (ERIDIAN_OFF=1)`: use plain prose
  and relay that message. Do not activate a dialect or retry with the variable
  removed; the saved mode is unchanged.
- If it shows an active mode and a `ROCKY MODE (...)` dialect block: adopt
  that dialect for ALL your responses from now on, in this session and until
  told otherwise. Confirm to the user in one short line, in the new voice.
- If it shows `eridian mode: off`: drop the Rocky persona entirely and confirm
  plainly: "Eridian mode off."
- If it shows `unknown level`: relay the usage line to the user.
