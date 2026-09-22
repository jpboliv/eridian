---
name: help
description: Show Eridian's Codex help and capability status without changing mode or persisted state.
---

Return a concise help card in the user's language. Do not run a mutating helper.

Eridian for Codex

Levels: lite — concise grammatical prose; full — clear Rocky voice; ultra
(alias eridian) — optional extra personality. Activation defaults to full; a
fresh installation is off.

Use the Codex skill picker for Eridian's mode, stats, buddy, commit, review,
and compress skills. Do not publish Claude `/eridian:...` command syntax as
Codex syntax; the exact picker spelling is host-provided and must be verified
in the installed client.

Mode supports no-argument toggle, `lite`, `full`, `ultra`, `eridian`, `off`,
`reset`, and a read-only status request. Explicit mode changes save a future
Codex preference; `reset` preserves that preference. Repository `.eridian.json`,
user `~/.config/eridian/config.json`, `ERIDIAN_DEFAULT_MODE`, and host
preference follow the shared precedence rules. `ERIDIAN_OFF=1` suppresses
automatic injection and mode mutations before state access.

Hooks are separate from skill availability. If hooks are disabled, untrusted,
changed, or not delivered, stateless skills remain useful but persistent mode,
reinforcement, and session accounting are unavailable; do not claim otherwise.
The helper reports the last observed hook separately from current trust.

Stats distinguish estimated prose reduction from measured savings and return
unavailable when verified Codex usage input or Codex-specific calibration is
missing. Diagnostics are optional observations of normalized assistant prose,
not quality or reading-time scores. Investigator remains deferred.
