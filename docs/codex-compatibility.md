# Codex compatibility

Eridian includes a Codex compatibility adapter alongside the existing Claude
Code plugin. The canonical Rocky rules remain in `skills/speak/SKILL.md`; Codex
skills and hooks are thin host adapters and do not copy those rule blocks.

## Installation

Build the allowlisted Codex distribution first. It excludes local planning,
worktree, credential, and raw evaluation directories:

```sh
node scripts/build-codex-package.js
codex plugin marketplace add /path/to/eridian/dist/codex-marketplace
codex plugin add eridian@eridian
```

Use a disposable `CODEX_HOME` profile when testing. Installing the repository
root directly is useful for development, but it is not the clean distribution
path because a local checkout may contain Git-excluded files.

The package uses the supported compatibility manifest at
`.codex-plugin/plugin.json`, which selects `adapters/codex/skills/` and
`hooks/codex.json`. Claude's `hooks/hooks.json` is preserved and is not selected
by the Codex manifest. Codex hook trust remains host-managed: installation does
not trust non-managed hooks, and this package does not use a trust-bypass flag.

In the Codex app, install the plugin from the local/repository marketplace in
the Plugins Directory. The exact skill-picker spelling is client-provided; do
not use Claude's `/eridian:...` command syntax in Codex. Select Eridian's mode,
help, stats, buddy, commit, review, or compress skill from the Codex picker.

`ERIDIAN_OFF=1` must reach the Codex runtime process. It suppresses state reads,
state writes, and automatic injection; it does not remove instructions already
present in a conversation.

## Supported implementation contract

The Codex adapter currently implements:

| Capability                                               | Implementation                                                                                                                                                                                                                                  | Native acceptance                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `lite`, `full`, `ultra`, `eridian`, `off`, toggle        | `scripts/codex/mode.js` with shared persona blocks                                                                                                                                                                                              | Offline fixture passed; live picker/command gate remains |
| `reset`, defaults, preference persistence                | Separate `${CODEX_HOME:-~/.codex}/eridian/` store; `${ERIDIAN_STATE_DIR}/codex/` test override                                                                                                                                                  | Offline fixture passed; app/CLI identity gate remains    |
| Natural-language activation                              | Explicit Eridian intent in the mode skill                                                                                                                                                                                                       | Requires client skill-selection smoke check              |
| Startup/resume/clear/compact and prompt-20 reinforcement | `SessionStart` and `UserPromptSubmit` hooks                                                                                                                                                                                                     | Hook delivery/trust/lifecycle smoke check remains        |
| Help/status                                              | Read-only Codex help skill and `mode.js status`                                                                                                                                                                                                 | Picker and trust-status presentation check remains       |
| Commit/review/compress                                   | Codex skill wrappers preserving staged-diff, read-only review, and compression safeguards; compression defaults to `./AGENTS.md` and backs up through `scripts/codex/backup.js` (exclusive creation, byte verification, Codex store `backups/`) | Disposable host execution remains                        |
| Stats/accounting                                         | Versioned normalized Codex input adapter over the shared `accounting-core` used by Claude; reports unsupported, malformed and oversized records; unavailable without Codex-specific usage events and calibration                                | Native usage-event contract is unverified                |
| Optional diagnostics                                     | Normalized Codex prose adapter using the shared scorer; unknown/native transcript formats are unavailable                                                                                                                                       | Native event/cache contract is unverified                |
| Buddy controls/reactions                                 | Codex-local speed state, prompt/tool/error/idle transitions, eligible milestones, and explicit terminal renderer                                                                                                                                | Live app statusline equivalent is unverified             |
| Investigator                                             | Deferred, as in Claude                                                                                                                                                                                                                          | Not in scope                                             |

Mode changes with a verified hook-created session update that session and the
Codex future preference. A command with no verified session binding may save
only the future preference and says that session tracking is unavailable. Reset
requires a verified session. Conflicting explicit and `CODEX_THREAD_ID` IDs are
an error. No path is used to infer session identity.

Stats never reuse Claude calibration factors. Normalized input is version 1 and
must identify session, model, assistant message, timestamp, cumulative output
usage, and content; `usage.output_tokens_details.thinking_tokens` marks reasoning
output as protected, as in Claude. Both hosts share one accounting core, so
attribution, streamed deduplication, prose eligibility and calibration checks
cannot drift; a shared parity fixture feeds the same observations through the
Claude transcript scanner and the Codex adapter. Records that are malformed,
unsupported or over 1 MiB are counted and reported, never silently dropped.
Without a verified native usage adapter or Codex-specific prose calibration,
values remain unavailable. The Codex adapter never treats a transcript as a
stable interface. Codex stats currently keep no per-session cache, so milestone
memory and retained calibration snapshots remain Claude-only until a native
event source exists.

Buddy state is host-local and never changes unrelated UI configuration. The
explicit terminal renderer is a useful fallback, not a claim of a live Codex
app statusline. Hooks are advisory and never block host work on operational
errors.

## Task 0 evidence

Checked 2026-09-22 on macOS Darwin 25.6.0 arm64 with Node `v22.14.0` and
`codex-cli 0.155.1`. No provider model turn, paid evaluation, plugin trust
bypass, normal user profile mutation, or app installation was performed.

The disposable fixture proved that the installed CLI accepts a local marketplace
catalog, lists the plugin, installs a compatibility-manifest package into an
isolated `CODEX_HOME`, and records the installed version/cache path. The
repository's existing `.claude-plugin/marketplace.json` was also recognized by
`codex plugin marketplace add` in an isolated profile. The installed manifest
retained the explicit Codex skill and hook paths; inspection showed Claude hook
references remained separate.

Official contracts used by this implementation:

- [Plugin packaging](https://developers.openai.com/plugins/build/plugins): compatibility manifests, portable manifests, local marketplaces, explicit hook paths, `PLUGIN_ROOT`, `PLUGIN_DATA`, and in-package path rules.
- [Codex hooks](https://learn.chatgpt.com/docs/hooks): `session_id`, `cwd`, `source`, `prompt`, `turn_id`, hook JSON output, trust review, asynchronous hooks, and the warning that transcript format is not stable.
- [Codex skills](https://learn.chatgpt.com/docs/build-skills): explicit `$` selection, packaged skills, and optional implicit-invocation policy.
- [Codex environment variables](https://learn.chatgpt.com/docs/config-file/environment-variables): `CODEX_HOME` as the Codex state root.

The Codex state root is `${CODEX_HOME:-~/.codex}/eridian/` rather than the
`PLUGIN_DATA` directory documented for hooks, because explicit skills run in the
model's shell where that variable is not guaranteed; hooks and skills must
resolve the same writable store. No sanitized hook inputs are retained yet; the
fixtures under `test/` model the documented input shape, not captured events.

The fixture did not establish that hooks are trusted or delivered in the app,
that `CODEX_THREAD_ID` equals hook `session_id`, that fork/subagent delivery is
safe, that Codex exposes stable usage/reply events, or that either client has a
live statusline surface. Those remain acceptance gates, not assumptions.

## Parity matrix and remaining gates

Offline shared fixtures cover canonical payload identity, mode aliases and
transitions, isolated state, malformed input, opt-out, missing identity,
reinforcement at prompts 19/20/21, streamed cumulative usage deduplication,
protected-content exclusions, unsupported languages, and unavailable values.
The Claude baseline remains covered by the original test suite.

The following human/native checks remain before claiming full compatibility:

1. In both the Codex CLI and app, review and trust the installed hook definition;
   verify changed/untrusted/disabled behavior without bypassing trust.
2. Capture real sanitized startup, resume, clear, compact, fork, prompt, and
   subagent inputs. Compare hook IDs with command binding and verify no parent
   session is reused by a subagent.
3. Verify skills appear under the actual client picker, record how the client
   namespaces the unprefixed skill names (`mode`, `help`, `commit`, `review`,
   `compress`, `stats`, `buddy`) against other plugins, and confirm that ordinary
   prompts do not activate mode implicitly.
4. Verify normal-permission state paths, package paths containing spaces, Node
   prerequisite failures, uninstall/reinstall retention, and `ERIDIAN_OFF` in
   the actual runtime process.
5. Establish a supported Codex usage/reply event source and Codex-specific
   calibration before enabling numeric accounting claims. Run diagnostics on
   streamed snapshots and cache invalidation using that source.
6. Verify buddy controls and reactions in CLI and app presentation surfaces.
   If no live equivalent exists, decide whether the explicit terminal renderer
   is an accepted alternative; this is not silently treated as parity.
7. Exercise commit, review, and compression in disposable repositories through
   the real skill host, including changed-draft, backup, symlink, hard-link,
   cancellation, and validation-failure paths.
8. Run Codex behavioral evaluations only after a separately agreed provider
   budget, then obtain paired correctness/completeness and human Rocky-recognition
   review. No paid evaluation result is claimed here.

Until the native stats and buddy surfaces are verified or explicitly accepted,
this branch is an implementation milestone, not a full compatibility or release
acceptance claim.
