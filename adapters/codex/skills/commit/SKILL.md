---
name: commit
description: Preview and, only after confirmation, create a plain conventional commit from staged Codex workspace changes.
---

Read only the staged diff. If nothing is staged, say so and stop. Draft one
conventional commit message with a type, an imperative subject no longer than
50 characters, and a complete plain body when useful. Preserve evidence,
negations, qualifications, requested language, and known attribution only.
Never invent mechanism, motivation, identity, model, co-author, or validation.

Show the exact full message and ask for confirmation. Before committing, reread
the staged diff; if it changed, revise and request confirmation again. Commit
exactly the confirmed message, never stage unsolicited files, and never push.
If the command fails, report failure rather than success. Artifact output stays
plain; do not use Rocky phrasing in the commit.
