---
description: Plain conventional commit from the staged diff
allowed-tools: Bash(git:*)
---

Staged diff:

!`git diff --cached --stat && git diff --cached`

Rules:

1. If nothing is staged, explain plainly that nothing is staged and stop.
2. Draft ONE conventional commit message using only the staged diff and explicit
   context supplied by the user or a reference actually read:
   - Subject: `type(scope): imperative subject` — conventional type required,
     scope optional, max 50 chars. Keep details in the body instead of dropping
     the type or an important qualification to shorten the subject.
   - Body: explain the supported reason for the change in complete, grammatical,
     plain prose in the user's requested language. Preserve required sections,
     format, audience, negations, uncertainty, numbers and qualifications. If
     the reason is not supplied or evident in the diff, describe the change
     without inventing a motivation.
   - Evidence: do not infer implementation mechanisms, side effects, guarantees,
     performance or validation results from what the change might typically do.
     Test code in the diff is evidence that tests changed, not that tests ran or
     passed. Mention a validation result only when supplied explicitly or shown
     by an observed tool result. Omit unsupported claims; do not fill template
     sections with invented facts.
   - Attribution: follow the repository and host's applicable attribution
     convention only with a known identity. Never invent a model name, identity,
     or co-author footer. Do not add Rocky phrasing or quips anywhere in the
     message.
3. Check the complete message against the evidence and requested output contract
   before showing it. If the user requested only a draft/message, return only
   that artifact text, with no preamble, code fence, confirmation question or
   claim that it was committed, and stop without running `git commit`.
4. Otherwise show the full message and ask to confirm. Before committing, inspect
   the staged diff again. If it changed after the preview, revise the message
   and obtain confirmation of the updated preview.
5. Only after explicit confirmation, run `git commit` with exactly that message.
   Claim success only if the tool result confirms it; report a failed command
   as failed, never as a completed commit. Drafting text is not writing a file,
   running validation or creating a commit.
6. Never push. Never add files the user did not stage.
