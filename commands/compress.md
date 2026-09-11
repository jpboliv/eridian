---
description: Compress CLAUDE.md or a memory file to cut input tokens (backup kept)
argument-hint: "[path — defaults to ./CLAUDE.md]"
allowed-tools: Bash(mkdir:*), Bash(cp:*), Bash(date:*), Bash(node:*), Bash(diff:*), Bash(rm:*), Read, Write
---

Target file: `$ARGUMENTS` (default `./CLAUDE.md`).

0. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-compress-path.js" <target>`.
   If it exits non-zero, tell the user the printed reason and stop
   completely — do not read the file, do not retry.
   Symlinks (including parent directories) and parent traversal are refused.
   Use an explicit regular-file path. Re-run this guard before every read/write
   of the target and guard the draft path before creating it.
1. Read the target file. If it does not exist, say so and stop.
2. Rewrite it for pure density. This file is read by a model, not a human:
   - NO Rocky flavor. Plain, dense, factual prose and lists.
   - Preserve EVERY fact, constraint, rule, path, URL, and instruction.
   - Remove only redundancy, filler, hedging, and decorative prose.
   - Keep markdown structure (headings, lists) where it aids retrieval.

   Example of the technique:

   Before:
   ```
   I strongly prefer that we always run the full test suite before
   committing anything, just to be safe and make sure nothing broke.
   Also, it would be great if you could try to keep commit messages
   fairly short when possible.
   ```

   After:
   ```
   Run full test suite before every commit. Keep commit messages short.
   ```

3. Write the rewrite to `<target>.eridian-draft.tmp` (Write tool).
4. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-compress.js" <target> <target>.eridian-draft.tmp`.
   - Exit 0 (`PASS ...`): continue to step 5.
   - Exit non-zero (`FAIL` + reasons): fix ONLY the flagged issues in the
     draft — do not recompress from scratch — rewrite
     `<target>.eridian-draft.tmp`, and re-run validation exactly once. If it
     fails again: show `diff -u -- <target> <target>.eridian-draft.tmp`
     and the meaning-sensitive reasons, then delete `<target>.eridian-draft.tmp`, report the reasons to
     the user, and stop. The target file is never touched.
5. Run `diff -u -- <target> <target>.eridian-draft.tmp` and show the complete
   reviewable diff (exit 1 means differences, not an error). On validation failure,
   also show this diff and the meaning-sensitive reasons before deleting the draft.
   Explicitly review facts, negations, exceptions, numbers and units, identifiers,
   and ordered constraints against the original. Restore any uncertain changes.
   If this review changes the draft, validate again within the same total limit
   of two validation attempts; if no attempts remain, delete only the draft and
   stop without overwriting. After any draft edit, show the updated full diff
   and size summary before requesting confirmation.
   Say "Structural checks passed; meaning is not verified. Semantic review is
   still required." Never imply PASS proves preservation of facts.
   Show a summary of what was removed, plus the before/after size
   from the `validate-compress.js` PASS line (it already reports
   `N -> M chars (-P%)`).
6. Ask for confirmation. Only proceed if the user confirms.
7. Re-run the path guards for both target and draft. If either fails, stop.
   Confirm both files still match the versions reviewed and approved; if either
   changed, stop and restart review without overwriting. Back up FIRST, verify
   the backup, then overwrite:

```bash
mkdir -p ~/.claude/eridian/backups
cp <target> ~/.claude/eridian/backups/"$(date -u +%Y%m%dT%H%M%SZ)"-<basename>
diff ~/.claude/eridian/backups/<the-file-just-copied> <target>
```

   If the backup command fails, or `diff` reports any difference, do NOT
   write — report the failure instead. Only after a clean `diff`, overwrite
   `<target>` with the contents of `<target>.eridian-draft.tmp`, then
   `rm <target>.eridian-draft.tmp`.
8. Confirm to the user, mention the backup path.
