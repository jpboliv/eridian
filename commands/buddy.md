---
description: Set buddy animation speed (seconds between pose steps; 0 = every refresh)
argument-hint: "[seconds]"
allowed-tools: Bash(node:*)
---

Buddy speed result:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/buddy-speed.js" $ARGUMENTS`

Relay the result above to the user in one short line. If it shows
`bad value`, relay the usage line.
