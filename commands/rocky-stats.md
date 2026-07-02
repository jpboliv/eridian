---
description: Show estimated token savings from rocky mode; offers statusline setup
allowed-tools: Bash(node:*), Bash(echo:*), Read, Edit
---

Stats output:

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/stats.js"`

Plugin root (for statusline setup):

!`echo "${CLAUDE_PLUGIN_ROOT}"`

1. Present the stats output above to the user as-is (it is already terse).
2. Read `~/.claude/settings.json`. If it has no `statusLine` key, tell the
   user the rocky buddy statusline is not set up and ask if they want it.
   If they say yes, add this to `~/.claude/settings.json` (using the plugin
   root path echoed above):

```json
"statusLine": {
  "type": "command",
  "command": "node \"<plugin-root>/scripts/statusline.js\""
}
```

   Do not overwrite an existing `statusLine` — if one exists, show what ours
   would be and let the user decide.
