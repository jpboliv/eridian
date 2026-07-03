---
description: Show estimated token savings from eridian mode; offers statusline setup
allowed-tools: Bash(node:*)
---

Stats output:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/stats.js"`

Statusline check:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-statusline.js" check "${CLAUDE_PLUGIN_ROOT}"`

1. Present the stats output above to the user as-is (it is already terse).
2. If the statusline check above printed `not-configured`: tell the user the
   eridian buddy statusline is not set up and ask if they want it.
   - If yes, run via Bash:
     `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-statusline.js" apply "${CLAUDE_PLUGIN_ROOT}"`
     and relay the result: `added: ...` means it's set up now; `error: ...`
     means report the failure plainly and stop.
   - If no, do nothing.
3. If the statusline check above printed `already-configured: ...`: show the
   user the existing entry and don't touch it.
