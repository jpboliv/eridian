# Eridian ♫

> why use many token when few token do trick — but make it Eridian.
>
> — riffing on [caveman](https://github.com/juliusbrussee/caveman)'s tagline

Talk terse like Rocky from _Project Hail Mary_. A Claude Code plugin that
compresses responses into Rocky's dialect, tracks session output and applicable prose reduction estimates,
and adds a tiny animated Rocky to your statusline.

Heavily inspired by [caveman](https://github.com/juliusbrussee/caveman) —
see [Credits](#credits).

## Install

```
/plugin marketplace add jpboliv/eridian
/plugin install eridian@eridian
```

## Use

| Command                           | What it does                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `/eridian:mode`                   | toggle eridian mode (full) on/off                             |
| `/eridian:mode lite\|full\|ultra` | set intensity (`eridian` = `ultra`)                           |
| `/eridian:stats`                  | session output reduction estimates + statusline setup         |
| `/eridian:buddy <seconds>`        | slow the buddy: min seconds between steps (0 = every refresh) |
| `/eridian:commit`                 | terse conventional commit from staged diff                    |
| `/eridian:review`                 | one-line-per-finding review. `not ship. fix first.`           |
| `/eridian:compress`               | compress CLAUDE.md to cut input tokens (backup kept)          |

Compression shows a full diff and requires semantic review and confirmation.
Structural PASS does not verify meaning; see [compression safeguards](docs/compression-safeguards.md)
for path restrictions, supported Markdown, and validation limits.

Or just say "talk like Rocky". Mode preferences persist for new sessions until
`/eridian:mode off`.

### Interactive and unattended runs

An unconfigured installation is off. In interactive sessions, `/eridian:mode`
activates full by default. For scripts, scheduled tasks, or any session that should
ignore the saved mode, set the opt-out before launching Claude Code:

```sh
ERIDIAN_OFF=1 claude -p "Summarize the build results"
ERIDIAN_OFF=1 claude
```

Only the exact value `1` enables the override. SessionStart and prompt reminders
emit no persona, and automatic hooks leave Eridian state untouched. All
`/eridian:mode` arguments (including `off` and the no-argument toggle) report the
override without changing saved settings. Launch a new session without the
variable to use the saved mode again. Setting it after launch cannot remove
instructions already in the conversation, including a resumed transcript.

This suppresses Eridian's automatic injections; it does not disable other plugins,
project instructions, explicit style requests, or explicitly invoked style skills
and commands. `eval/run.sh` sets it for every arm, including baseline, while still
adding each dialect arm's explicit prefix. The evaluation harness also uses safe
mode, a fresh working directory, no tools, an empty MCP configuration and no session
persistence. Each invocation creates a unique directory under `eval/runs/`, retaining
run metadata, exact prefixes, raw responses and usage without overwriting earlier
runs. No manual global mode change is needed. See [evaluation guidance](docs/evaluation.md)
for the comparison protocol and its limits.

Host support checked against the [Claude Code hook reference](https://code.claude.com/docs/en/hooks)
on 2026-09-11: SessionStart's documented `source` describes lifecycle events
(`startup`, `resume`, `clear`, `compact`, `fork`), not interactive versus unattended
execution. The documented hook inputs provide no general unattended flag.
Eridian therefore requires the explicit opt-out; prompt text such as
`<scheduled-task` is not a trusted execution-mode signal.

## Levels

- **lite** — max savings, light flavor. `Inline object prop = new ref each render. Wrap in useMemo.`
- **full** — balanced. `New object every render. useMemo fix, statement. Understand, question?`
- **ultra** — full Eridian. `♫ Bad bad bad. Object born again every render. useMemo — Rocky fix, statement. Good good good.`

## Shared clarity and artifact boundary

Every active level answers first when the answer is known and removes redundant
preambles, restatements, recaps, closing offers and routine tool narration. Useful
progress updates, necessary clarification, host-required communication, requested
detail/format and the user's language remain intact. Active voice, consistent terms,
one idea per sentence and approximately 20 words are preferences; headers, bullets
and tables remain useful for navigation and comparison.

Clarity and complete meaning outrank compression. Preserve uncertainty, negation,
exceptions, numbers, units and decisive error text; use plain phrasing when dialect
adds confusion. Shared protections override level-specific flavor.

Files, comments, commits, PRs, issues, memory and messages to other people use plain,
concise prose in the requested language, respecting the audience and template.
`/eridian:compress` keeps its specialized density rules without dialect or meaning
loss. These boundaries apply at every level.

The shared payload including that boundary measures **235 tokens** with `tiktoken`
0.12.0 / `o200k_base` (an approximation for the host tokenizer). The 135-token overage
preserves explicit completeness, evidence and artifact safeguards. Artifact drafts use
ordinary grammar and supplied facts; proposed text is not proof that work was performed. See the
[design and human release gate](docs/design/shared-clarity.md); combined 007+009
behavioral evaluation and human acceptance remain pending.

## The buddy

Rocky lives in your statusline — eyeless and five-legged, as Eridians are.
He shuffles his legs while you work, reacts to what you prompt
(`bad bad. I fix.`), celebrates estimated output reduction milestones, and sleeps when you
idle. Run `/eridian:stats` once to set the statusline up:

```
▘ ◼◼◼ ▘  I fix.
 ◼◼◼◼◼  ∙ full  ∙ ~12.3k output reduction
▘ ▘ ▘▘
```

The output reduction figure belongs to the identified current session. It appears
only when a model-matched, prose-only calibration is applicable. Bundled historical
factors do not establish that scope, so the estimate is unavailable by default.
Tool, thinking, mixed code/prose, and unidentified output do not count as estimated
prose reduction. Milestones require a positive applicable estimate.

`/eridian:stats` uses the caller's session ID, never the newest cache. Without a
reliable ID it reports current-session data unavailable. Lifetime means all retained
schema-2 accounting caches; it does not scan or infer historical session activations.

Rocky steps one animation frame per statusline refresh: every time Claude
Code re-runs the statusline (a handful of seconds apart while the
conversation is active), the pose visibly changes. When you idle, the last
frame stays put until the next refresh — that cadence is the host's, not
Rocky's.

Too jumpy? `/eridian:buddy 2` slows him to at most one step every 2
seconds; `/eridian:buddy 0` restores per-refresh stepping. He can never
step _faster_ than the host refreshes — physics.

Using your own statusline script instead of the generated one? Forward the
JSON that Claude Code pipes on stdin, or the savings segment is omitted:

```sh
rocky=$(printf '%s' "$input" | node "<plugin-root>/scripts/statusline.js" 2>/dev/null)
```

## Savings

Measured on 10 real coding prompts via `claude -p`, one run per prompt/mode
(`eval/run.sh`), 2026-07-02; `full`/`ultra` re-measured 2026-07-22 after the
canon vocab expansion. Two honest counterfactuals:

**vs default Claude** — historical evaluation output reduction:

| level   | avg output-token reduction |
| ------- | -------------------------- |
| `lite`  | ~52%                       |
| `full`  | ~30%                       |
| `ultra` | ~14%                       |

**vs a plain `Answer concisely.` instruction** — how the dialect compares to
just asking for brevity:

| level   | avg reduction vs terse |
| ------- | ---------------------- |
| `lite`  | ~10%                   |
| `full`  | ~-25%                  |
| `ultra` | ~-56%                  |

These are historical single-run observations with incomplete raw evidence. The
new [evaluation harness](docs/evaluation.md) retains replies, usage and quality
reviews across at least three repetitions; it does not overwrite old factors.
Run `bash eval/run.sh` for all five arms (costs provider tokens), then
`node eval/compute-factors.js <run-directory>` for distributions and paired output
comparisons. Human quality review remains required before accepting new rules.

## Accounting limitations and storage

State schema 2 separates saved mode/buddy-speed preferences from session mode,
activation history, buddy animation and reinjection counters. Existing sessions keep
their selected mode when another session changes the preference. Startup, resume and
compaction use the hook's `session_id`; mode/stats commands pass the host session ID
and also accept `--session-id ID` or `CLAUDE_SESSION_ID` when invoked directly.
Missing identity can save a mode preference but cannot establish session attribution.

Migration preserves old mode and buddy speed. Legacy global events remain labeled
unknown attribution; global animation/counters are discarded. Histories and caches
are retained without automatic pruning under `~/.claude/eridian/`. Delete this
folder to reset preferences and accounting. Full transcript rescans can cost time
on large sessions. Streaming records with the same message ID use the largest
cumulative output count; records without IDs cannot safely be deduplicated and are
excluded from reduction estimates. Text-only classification is conservative and
cannot prove that unmarked text contains no code.

Calibration snapshots include identity, model, rule provenance and scope and stay
attached to each first-seen record. Zero and negative reductions are displayed as
such; estimates describe output reduction, never measured savings or money saved.
Corrupt/deleted caches lose their snapshots and must be rebuilt. File locks serialize
updates on one host; a forcibly killed process can leave a `.lock` directory.
After verifying its `owner` PID is no longer running, remove that lock to recover.
Do not share the state directory across hosts. Details and the runtime fixture are in
[the accounting design](docs/design/session-accounting.md) and
[test/fixtures/session-accounting.json](test/fixtures/session-accounting.json).

## Development

```
npm test          # unit tests (node:test, zero deps)
bash eval/run.sh  # calibrate savings factors (manual, costs tokens)
```

For deterministic English phrase counts and language-aware structural observations,
see [style diagnostics](docs/style-diagnostics.md). Run
`node scripts/readcost.js reply.md` or pipe text on stdin. These diagnostics do not
measure clarity, completeness, or reading time.

Rules of the dialect live in one place: `skills/speak/SKILL.md`.

## Credits

- **[caveman](https://github.com/juliusbrussee/caveman)** by Julius Brussee —
  the whole idea. Persona-driven token compression, intensity levels, savings
  stats, terse commits/reviews, memory-file compression: eridian's feature set
  is caveman's, re-themed. The implementation here is written from scratch as
  a native Claude Code plugin, but conceptually this project is caveman
  wearing an Eridian carapace. Go star it.
- **[hpbyte/rocky](https://github.com/hpbyte/rocky)** — an independent
  Rocky-voice skill that predates this plugin (and had the name first).
  This project renamed to eridian partly to stay out of its way.
- **Andy Weir's _Project Hail Mary_** — Rocky, the best engineer in the
  galaxy. Read the book. Amaze.
- **Claude Buddy** — Anthropic's short-lived April 2026 terminal pet, whose
  removal inspired the statusline buddy.

Good good good.

## License

[MIT](LICENSE)
