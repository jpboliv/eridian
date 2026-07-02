# eridian ♫

> why use many token when few token do trick — but make it Eridian.
>
> — riffing on [caveman](https://github.com/juliusbrussee/caveman)'s tagline

Talk terse like Rocky from *Project Hail Mary*. A Claude Code plugin that
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

| Command | What it does |
|---|---|
| `/eridian:mode` | toggle eridian mode (full) on/off |
| `/eridian:mode lite\|full\|ultra` | set intensity (`eridian` = `ultra`) |
| `/eridian:stats` | estimated token savings + statusline setup |
| `/eridian:commit` | terse conventional commit from staged diff |
| `/eridian:review` | one-line-per-finding review. `not ship. fix first.` |
| `/eridian:compress` | compress CLAUDE.md to cut input tokens (backup kept) |
| `/eridian:buddy mini\|tall` | statusline buddy size (one-liner vs full Rocky) |

Or just say "talk like Rocky". Mode persists across sessions until
`/eridian:mode off`.

## Levels

- **lite** — max savings, light flavor. `Inline object prop = new ref each render. Wrap in useMemo.`
- **full** — balanced. `New object every render. useMemo fix. Understand, question?`
- **ultra** — full Eridian. `♫ Bad bad bad. Object born again every render. useMemo — I fix. Good good good.`

## The buddy

Rocky lives in your statusline — eyeless and five-legged, as Eridians are.
He shuffles his legs while you work, reacts to what you prompt
(`bad bad. I fix.`), celebrates savings milestones, and sleeps when you
idle. Run `/eridian:stats` once to set the statusline up, and pick a size
with `/eridian:buddy`:

`mini` (default):

```
♫ ▟█▙  I fix.  · full  · ~12.3k saved
```

`tall`:

```
 ▄█████▄    I fix.
▐███████▌   · full  · ~12.3k saved
 ▘ ▘▘ ▝ ▘
```

## Savings

Measured on 10 real coding prompts via `claude -p`, one run per prompt/mode
(`eval/run.sh`), 2026-07-02. Two honest counterfactuals:

**vs default Claude** — what the statusline counts (nobody types "answer
concisely" on every message):

| level | avg output-token reduction |
|---|---|
| `lite` | ~52% |
| `full` | ~26% |
| `ultra` | ~9% |

**vs a plain `Answer concisely.` instruction** — how the dialect compares to
just asking for brevity:

| level | avg reduction vs terse |
|---|---|
| `lite` | ~10% |
| `full` | ~-50% |
| `ultra` | ~-77% |

`lite` is the saver — about on par with plain terseness. `full` and `ultra`
cost *more* tokens than a plain `Answer concisely.`: the triples and ♫
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
- **Andy Weir's *Project Hail Mary*** — Rocky, the best engineer in the
  galaxy. Read the book. Amaze.
- **Claude Buddy** — Anthropic's short-lived April 2026 terminal pet, whose
  removal inspired the statusline buddy.

Good good good.

## License

[MIT](LICENSE)
