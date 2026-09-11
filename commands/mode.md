---
description: Toggle eridian mode or set level (lite | full | ultra | off | reset)
argument-hint: "[lite|full|ultra|eridian|off|reset]"
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

`reset` clears this session's explicit override and re-reads defaults; it leaves
other sessions and the future-session preference unchanged. Explicit mode changes
(including off) update this session and the future-session preference. A session
identity is required for reset; relay an identity-required message plainly.
