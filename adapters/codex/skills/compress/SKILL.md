---
name: compress
description: Safely preview and, only after confirmation, compress one Codex AGENTS.md instruction file while preserving meaning and backups.
---

Default target is `./AGENTS.md`. Handle only the selected regular file. Resolve
the packaged helper root before running `check-compress-path.js` and
`validate-compress.js`; never assume a Claude plugin variable or write under
`.claude/`.

Refuse missing/unsafe paths, parent traversal, symlinks in any component,
hard-linked files, sensitive names, and non-regular files. Read the original,
draft plain dense prose, preserve every fact, constraint, rule, path, URL,
identifier, negation, exception, number, unit, ordered constraint, and fenced
code block. Run structural validation and a complete diff review. On validation
failure, fix only flagged draft issues and allow at most the existing two
validation attempts; delete the draft on failure and never touch the target.

Request confirmation for the exact reviewed bytes. Re-run guards and compare
target/draft before applying. Then run
`node <installed-eridian-root>/scripts/codex/backup.js <target>`: it re-runs the
path guard, copies the target into the resolved Codex Eridian store's `backups/`
directory with exclusive creation, verifies the bytes and prints `backup: <path>`.
If it exits non-zero or prints no backup path, do not overwrite; report its
reason. Only then replace the target with the confirmed draft and mention the
backup path. Report that structural checks do not prove semantic preservation.
