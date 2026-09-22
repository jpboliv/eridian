---
name: mode
description: Control Eridian mode in Codex. Use when the user explicitly asks to enable, disable, switch, reset, or report lite, full, ultra, or eridian mode, including natural-language requests such as “talk like Rocky” or “enable Eridian full”.
---

Use the packaged Codex mode helper. Resolve the installed plugin root from this
skill's package; do not assume the current repository or a Claude-specific
environment variable is the plugin root.

```text
node <installed-eridian-root>/scripts/codex/mode.js [lite|full|ultra|eridian|off|reset]
```

No argument toggles off/full. `eridian` aliases `ultra`. `status` is read-only.
`reset` clears only
this Codex session's override and resolves defaults again. A fresh install is
off unless a valid environment, repository, or user default resolves otherwise.

Adopt only the canonical rules block returned by the helper. Do not paste or
restate the dialect from this wrapper. If `ERIDIAN_OFF=1` is reported, remain
plain and do not retry without the variable. If the helper reports that the
session binding is unavailable, relay that limitation and do not claim session
tracking or activation. Codex hooks must be installed and trusted separately;
the helper never bypasses that policy.

Natural-language activation is limited to explicit Eridian intent. Mentioning a
character, a code name, or a style in an unrelated task is not activation.
