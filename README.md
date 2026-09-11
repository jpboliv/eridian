# Eridian ♫

> why use many token when few token do trick — but make it Eridian.
>
> — riffing on [caveman](https://github.com/juliusbrussee/caveman)'s tagline

Talk terse like Rocky from _Project Hail Mary_. A Claude Code plugin that
compresses responses into Rocky's dialect, tracks the output tokens you save,
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
| `/eridian:stats`                  | estimated token savings + statusline setup                    |
| `/eridian:buddy <seconds>`        | slow the buddy: min seconds between steps (0 = every refresh) |
| `/eridian:commit`                 | terse conventional commit from staged diff                    |
| `/eridian:review`                 | one-line-per-finding review. `not ship. fix first.`           |
| `/eridian:compress`               | compress CLAUDE.md to cut input tokens (backup kept)          |

Or just say "talk like Rocky". Mode persists across sessions until
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
adding each dialect arm's explicit prefix. It records the start time, arms, and
override in `eval/results-isolation.jsonl` alongside `eval/results.csv`; both reset
on a full run and append on a partial run. No manual global mode change is needed.
This is Eridian isolation, not a fully isolated evaluation environment.

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

## The buddy

Rocky lives in your statusline — eyeless and five-legged, as Eridians are.
He shuffles his legs while you work, reacts to what you prompt
(`bad bad. I fix.`), celebrates savings milestones, and sleeps when you
idle. Run `/eridian:stats` once to set the statusline up:

```
▘ ◼◼◼ ▘  I fix.
 ◼◼◼◼◼  ∙ full  ∙ ~12.3k saved
▘ ▘ ▘▘
```

The savings figure is the **current session's** estimate, computed live
from the session transcript on every statusline refresh. Rocky dances when
the session crosses a savings milestone (5k/10k/25k/50k/100k). Lifetime
totals live in `/eridian:stats`.

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

**These figures are counterfactual output-token estimates, not measured savings
or money saved.** Persona blocks, command/skill metadata, activation wrappers and
reminders add input overhead that has not yet been measured. Reused conversation
context and tool requests may process that text again; cache behavior also matters.
The available July 2 raw CSV does not reproduce the later full/ultra percentages;
the July 22 raw snapshot is missing. The historical figures below are published
observations with incomplete supporting evidence, not a reproducible current baseline.

Whether shorter output reduces a bill depends on input/output rates, cache rates,
workload and the billing model. Under fixed per-request billing, shorter replies do
not inherently reduce charges. No universal reply-length break-even follows from
these estimates. Final payload counts and paired session usage will be reported
after the reinforcement-cadence evaluation; input overhead is currently unmeasured.

Measured on 10 real coding prompts via `claude -p`, one run per prompt/mode
(`eval/run.sh`), 2026-07-02; `full`/`ultra` re-measured 2026-07-22 after the
canon vocab expansion. Two honest counterfactuals:

**vs default Claude** — what the statusline counts (nobody types "answer
concisely" on every message):

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

`lite` is the saver — about on par with plain terseness. `full` and `ultra`
cost _more_ tokens than a plain `Answer concisely.`: the triples and ♫
outweigh what terseness buys back. You run `ultra` because it is amaze, not
because it is cheap. Against default Claude all three still net a reduction
(the table above). Single runs per cell, so expect variance; recalibrate
with `bash eval/run.sh && node eval/compute-factors.js` (a partial re-run
like `bash eval/run.sh terse` appends to the existing cells). All displayed
savings are estimates.

## Development

```
npm test          # unit tests (node:test, zero deps)
bash eval/run.sh  # calibrate savings factors (manual, costs tokens)
```

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
