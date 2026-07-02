---
description: Choose statusline buddy art — mini (one line) or tall (full Rocky)
argument-hint: "[mini|tall]"
allowed-tools: Bash(node:*)
---

Style change result:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/buddy-style.js" $ARGUMENTS`

Relay the result above to the user in one short line. The statusline picks
the new style up on its next repaint — no restart needed. If it shows
`unknown style`, relay the usage line.
