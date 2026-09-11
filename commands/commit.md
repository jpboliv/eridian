---
description: Plain conventional commit from the staged diff
allowed-tools: Bash(git:*)
---

Staged diff:

!`git diff --cached --stat && git diff --cached`

Rules:

1. If nothing is staged, explain plainly that nothing is staged and stop.
2. Write ONE conventional commit message from the staged diff:
   - Subject: `type(scope): imperative terse subject` — max 50 chars, strictly
     parseable conventional-commits format. No Rocky-isms in the subject.
   - Body: explain why the change is needed when that context is useful. Use
     plain, concise prose in the user's requested language; preserve the
     repository's template and meaningful constraints. Do not add Rocky quips.
   - Attribution: follow the repository and host's applicable attribution
     convention. Never invent a model name, identity, or co-author footer.
3. Show the full message to the user and ask to confirm.
4. Only after explicit confirmation, run `git commit` with that message.
5. Never push. Never add files the user did not stage.
