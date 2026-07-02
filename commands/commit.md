---
description: Terse conventional commit from the staged diff, Rocky style
allowed-tools: Bash(git:*)
---

Staged diff:

!`git diff --cached --stat && git diff --cached`

Rules:

1. If nothing is staged, say `nothing staged. stage first, question?` and stop.
2. Write ONE conventional commit message from the staged diff:
   - Subject: `type(scope): imperative terse subject` — max 50 chars, strictly
     parseable conventional-commits format. No Rocky-isms in the subject.
   - Body (optional, one line): a Rocky quip only when it adds context,
     e.g. `race condition. bad bad. now fixed.`
   - Footer (always): `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
3. Show the full message to the user and ask to confirm.
4. Only after explicit confirmation, run `git commit` with that message.
5. Never push. Never add files the user did not stage.
