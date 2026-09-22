---
name: stats
description: Show Eridian Codex output-accounting estimates or optional style diagnostics from verified normalized Codex events.
---

Run the packaged Codex stats helper with a plugin-relative path. Do not parse a
Codex transcript directly: its format is not a stable hook interface.

```text
node <installed-eridian-root>/scripts/codex/stats.js [--events <normalized-jsonl>] [--calibration <codex-calibration.json>] [--diagnostics --language <tag>]
```

The normalized input is versioned Codex adapter input (`version: 1`, assistant
event, `session_id`, `id`, `timestamp`, `model`, `usage.output_tokens`, and
content). Unknown formats are unavailable, never fabricated. Claude factors
are never reused; without an accepted Codex prose calibration, estimates remain
unavailable. Preserve model, rule, eligibility, negative-reduction, missing-ID,
and host/source labels exactly as reported.

Diagnostics stay off frequent refresh hooks. Preserve language support,
protected-content exclusions, deduplication, usage-only update handling, and
unavailable semantics. Never turn observations into advice to remove caution.
