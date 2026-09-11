# Compression safeguards (ticket 016)

Compression is a draft/review/confirm workflow. Deterministic validation detects
some losses; it cannot establish semantic equivalence. Even a structurally valid
draft must receive model and human semantic review before overwrite.

## Path policy

The guard checks the supplied and absolute normalized names, inspects every
existing path component, and checks the resolved name. It refuses `.env` and
`.env.*` variants, existing credential patterns, and sensitive directory names
(case insensitive). Symlinks are refused, including safe Markdown aliases and
symlinked parent directories. Files with multiple hard links are also refused,
preventing sensitive files from acquiring an innocent alias. Parent traversal (`..`) is refused: supply the
explicit path instead. Missing targets pass the name check but fail the command's
subsequent read. Permission and resolution errors fail closed. Normal Markdown
files such as `CLAUDE.md` and `docs/notes.md` are allowed.

Run guards before reading the target, creating the draft, and committing the
approved rewrite. These checks are not a sandbox or protection against a hostile
process swapping files between inspection and access. Filename checks cannot
recognize secrets embedded in an otherwise ordinary document.

## Deterministic validation

- ATX headings are counted outside supported fenced blocks.
- Top-level backtick and tilde fences with at most three leading spaces are
  supported. Closers must use the same character with at least the opener's
  length; longer fences can contain shorter fences. Unclosed fences fail.
  Entire blocks (including delimiters and language labels), their multiplicity,
  and their order must remain byte-identical.
- Original HTTP(S) URLs must survive; added URLs require semantic review.
- Ordered sequences of English negation/exception/modal/order markers, numbers
  with their adjacent word or unit, inline-code and identifier-like tokens, and
  numbered list lines are compared outside fenced code. Any change fails with a
  named meaning-sensitive category. This deliberately rejects some safe rewrites:
  restore the original constraint or handle that rewrite manually outside the
  automatic compression workflow. Numbered steps must remain verbatim and ordered.

This is a small conservative heuristic, not a language parser. It does not cover
all languages, spelled-out quantities, all unit notations, every identifier,
Setext headings, indented code, or fences nested in lists/blockquotes. Preserve
unsupported code syntax verbatim and review it manually. An unchanged marker
sequence can still change scope: “Do not delete. Delete logs.” versus “Delete.
Do not delete logs.” passes these checks despite a changed instruction. Other
facts can disappear without changing any tracked signal. A PASS explicitly says
“structural checks passed; meaning NOT verified”.

## Review and failure behavior

Show the full unified diff, size change, and any flagged meaning-sensitive
categories. Review facts, negations, exceptions, values and units, identifiers,
and ordered constraints before requesting confirmation. The validator only reads
files. At most two validation attempts are allowed, including edits made during
semantic review. Failure leaves the target unchanged and removes only the draft.

Before overwrite, recheck paths and verify that target and draft still match the
reviewed versions. Create a backup and compare it with the target; failed backup
or comparison aborts overwrite. Retain the backup after successful compression.
These sequencing requirements live in `commands/compress.md`, executed by the
assistant; there is no separate automatic writer that bypasses confirmation.
