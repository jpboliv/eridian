# rocky ♫

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
/plugin marketplace add jpboliv/rocky
/plugin install rocky@rocky
```

## Use

| Command | What it does |
|---|---|
| `/rocky:mode` | toggle rocky mode (full) on/off |
| `/rocky:mode lite\|full\|ultra` | set intensity (`eridian` = `ultra`) |
| `/rocky:stats` | estimated token savings + statusline setup |
| `/rocky:commit` | terse conventional commit from staged diff |
| `/rocky:review` | one-line-per-finding review. `not ship. fix first.` |
| `/rocky:compress` | compress CLAUDE.md to cut input tokens (backup kept) |
| `/rocky:buddy mini\|tall` | statusline buddy size (one-liner vs full Rocky) |

Or just say "talk like Rocky". Mode persists across sessions until
`/rocky:mode off`.

## Levels

- **lite** — max savings, light flavor. `Inline object prop = new ref each render. Wrap in useMemo.`
- **full** — balanced. `New object every render. useMemo fix. Understand, question?`
- **ultra** — full Eridian. `♫ Bad bad bad. Object born again every render. useMemo — I fix. Good good good.`

## The buddy

Rocky lives in your statusline — eyeless and five-legged, as Eridians are.
He shuffles his legs while you work, reacts to what you prompt
(`bad bad. I fix.`), celebrates savings milestones, and sleeps when you
idle. Run `/rocky:stats` once to set the statusline up, and pick a size
with `/rocky:buddy`:

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

Savings table pending calibration — run `bash eval/run.sh && node
eval/compute-factors.js` (costs API tokens). All displayed numbers are
estimates.

## Development

```
npm test          # unit tests (node:test, zero deps)
bash eval/run.sh  # calibrate savings factors (manual, costs tokens)
```

Rules of the dialect live in one place: `skills/speak/SKILL.md`.

## Credits

- **[caveman](https://github.com/juliusbrussee/caveman)** by Julius Brussee —
  the whole idea. Persona-driven token compression, intensity levels, savings
  stats, terse commits/reviews, memory-file compression: rocky's feature set
  is caveman's, re-themed. The implementation here is written from scratch as
  a native Claude Code plugin, but conceptually this project is caveman
  wearing an Eridian carapace. Go star it.
- **Andy Weir's *Project Hail Mary*** — Rocky, the best engineer in the
  galaxy. Read the book. Amaze.
- **Claude Buddy** — Anthropic's short-lived April 2026 terminal pet, whose
  removal inspired the statusline buddy.

Good good good.
