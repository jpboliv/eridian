---
name: buddy
description: Control or explicitly render Eridian's Codex buddy state, including speed, mode indication, prompt reactions, tool/error reactions, idle behavior, and eligible-estimate milestones.
---

Use the packaged Codex buddy helper:

```text
node <installed-eridian-root>/scripts/codex/buddy.js [<seconds>|--render]
```

Zero means every host refresh; positive values set the minimum step interval.
The preference is Codex-local. Each `--render` advances a hook-bound session's
animation when the interval permits; without a binding it is a static preview.
`--render` is an explicit plain terminal
presentation and does not add chat messages, background model calls, or modify
unrelated UI settings. Hook-driven prompt/tool/error/idle state is advisory and
host-limited. Do not claim a live Codex app statusline until that surface is
verified in the target client. Milestones appear only when eligible estimates
exist; unavailable accounting cannot trigger them.
