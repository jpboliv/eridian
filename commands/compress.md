---
description: Compress CLAUDE.md or a memory file to cut input tokens (backup kept)
argument-hint: "[path — defaults to ./CLAUDE.md]"
allowed-tools: Bash(mkdir:*), Bash(cp:*), Bash(date:*), Bash(wc:*), Read, Write
---

Target file: `$ARGUMENTS` (default `./CLAUDE.md`).

1. Read the target file. If it does not exist, say so and stop.
2. Rewrite it for pure density. This file is read by a model, not a human:
   - NO Rocky flavor. Plain, dense, factual prose and lists.
   - Preserve EVERY fact, constraint, rule, path, URL, and instruction.
   - Remove only redundancy, filler, hedging, and decorative prose.
   - Keep markdown structure (headings, lists) where it aids retrieval.
3. Show the user: a summary of what was removed, plus before/after size
   using the chars/4 token heuristic:
   `before ~N tokens → after ~M tokens (−P%)` (run `wc -c` on the original;
   count the rewrite's characters yourself).
4. Ask for confirmation. Only proceed if the user confirms.
5. Back up FIRST, then write:

```bash
mkdir -p ~/.claude/eridian/backups
cp <target> ~/.claude/eridian/backups/"$(date -u +%Y%m%dT%H%M%SZ)"-<basename>
```

   Then overwrite the target with the compressed version. If the backup
   command fails, do NOT write — report the failure instead.
6. Confirm to the user, mention the backup path.
