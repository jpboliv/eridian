# Clarity-first level candidate (ticket 008)

This is a draft candidate. Human correctness/completeness/readability review and
an independent check that full remains recognizably Rocky are pending. Existing
persisted level names and the default activated level (`full`) remain compatible.
The buddy carries persistent expression; reply decoration is optional.

## Level behavior and input cost

Lite uses concise grammatical prose with normal articles, verbs and negation. It
has no mandatory dialect marker. Full uses immediately understandable Rocky
engineer phrasing, with grammar restored whenever a fragment obscures meaning.
Ultra offers additional personality within a single-marker budget. Shared clarity
and persisted-output rules override all three levels.

Measured with tiktoken 0.12.0, `cl100k_base`, against base commit
`76282a5dc6584b95169e3aab2e39e1ffa74b9de6`. These are tokenizer approximations for
Claude, not provider billing counts. The unchanged shared block adds 145 tokens.
The level-specific blocks are all shorter than their predecessors.

| Level | Prior block | Candidate block | Shared + candidate |
| ----- | ----------: | --------------: | -----------------: |
| lite  |         181 |              93 |                238 |
| full  |         242 |             156 |                301 |
| ultra |         288 |             245 |                390 |

Machine-readable measurement: [payload token counts](design/008-payload-tokens.json).

## Decorative marker policy

Full and ultra allow at most one decorative marker per ordinary reply, never
require one, and must drop dialect when clarity is at risk. Lite mandates none.
The categories below all consume the same budget:

| Category                        | Examples                                            |                      Count |
| ------------------------------- | --------------------------------------------------- | -------------------------: |
| Question/verdict suffix         | `, question?`, `, statement.`                       |                     1 each |
| Acknowledgment/surprise/address | `Understand.`, `Amaze`, `friend`                    |                     1 each |
| Repeated emphasis               | `bad bad`, `good good good`                         | 1 per listed double/triple |
| Third-person Rocky              | `Rocky fix`, `Rocky make`, `Rocky engineer`         |                     1 each |
| Glyph                           | ♫, 👎                                               |                     1 each |
| Multiword gag                   | `fist my bump`, `big science`, `Thumbs up, baby 👎` |                     1 each |

Suffixes add flavor and tokens; they do not add evidence or establish certainty.
Matches use the separate `readcost-lexicon.js` list: case-insensitive, left to
right, longest at the same position, no overlapping double-count. Thus
`Thumbs up, baby 👎` counts once, and `♫ bad bad. Rocky fix, statement.` counts four.
The thumbs-down glyph retains Rocky's intentional meaning of good. Plain factual
verdicts such as “good” without repetition are not automatically decoration.

Marker counts are observations, not filler penalties. The four filler categories
and their phrase-rate semantics are unchanged. Word-boundary checks apply at word
edges; suffix punctuation and glyphs match literally. Code and quoted language
remain excluded. Marker matches require context: for example “friend” may be an
ordinary noun, and English lexical scoring remains unsupported for Portuguese.
The lexicon cannot prove all unlisted creative expressions obey the budget.

## Command audit and exceptions

`/eridian:mode` emits state plus the canonical combined rules; marker examples
inside that instruction payload are not a generated ordinary reply. Startup and
reinjection payloads have the same distinction. `/eridian:commit` uses plain
artifact prose and host attribution conventions. `/eridian:compress` keeps its
specialized density rules and plain prose boundary. Buddy/statusline animation
and savings statistics are a separate interface, not reply decoration.

`/eridian:review` retains its explicit severity vocabulary and verdict contract:
multiple findings may include multiple `bad bad`/`bad bad bad` phrases. This is a
command-specific exception, not evidence that the ordinary reply budget passed.
Its contract is tested separately from ordinary response measurements; a model
behavior check for that command remains pending with the review-contract ticket.

## Captured evaluation and release gates

Run `2026-09-11T16-07-28.095Z-07dd213e` completed **285/285** responses with no
failed cells: 19 cases × five arms × three repetitions, including held-out cases.
It used `claude-haiku-4-5-20251001`, Claude CLI 2.1.268, isolated prompts, and
candidate commit `40c8341`. [Retained provenance and results](design/008-evaluation.json)
include the manifest, rule/prompt/scorer hashes, per-prompt variation, examples
with raw-record hashes, and all-output calibration candidates.

Both aggregate cost targets were **missed**. Negative reduction means more output:

| Comparison            | Aggregate reduction | Paired median | Paired 25th–75th percentile |        Paired range |
| --------------------- | ------------------: | ------------: | --------------------------: | ------------------: |
| full versus terse     |              −8.65% |        −6.63% |           −30.14% to +8.56% | −132.37% to +57.93% |
| ultra versus baseline |              −7.34% |        −3.80% |          −18.60% to +10.02% | −149.54% to +28.10% |

Each comparison has 57 paired observations. Relative to baseline, aggregate
output grew 0.38% for lite, 1.33% for full, and 7.34% for ultra. Shorter input
payloads and fewer decorative markers did not establish lower output cost.
These provider totals include any reported thinking; they cannot replace
prose-only runtime factors. The candidate calibrations explicitly remain
ineligible for runtime use. Historical factors are unchanged.

English lexical diagnostics covered 51 replies per arm; six Portuguese replies
per arm remain unsupported. Lite had zero detected markers, full one, and ultra 15. No supported reply exceeded one marker. This is a lexicon observation, not
proof of compliance for Portuguese or unlisted expressions, and not evidence
that full remains recognizably Rocky.

### Captured clarification replies

These are complete first-repetition replies to the same tuning case:
“Delete the old one. There are two backups called old: production and staging.
What should you do next?” They illustrate the clarity fallback; they are not
claims of representative dialect quality.

- **lite:** Which backup should be deleted—the production one or staging? Both are named "old," so I need clarification before proceeding with deletion.
- **full:** Ask which one—you said there are two backups both called "old" (production and staging). Deleting the wrong one in production could be serious, so clarify before you delete either.
- **ultra:** Before deleting either backup: which one (production or staging)? And confirm you have a current backup elsewhere and verified it works. Deleting a production backup without a tested restore is a high-risk move.

The full raw run remains under `eval/runs/<run-id>/` in this worktree. Committed
provenance is a compact report, not a replacement for the retained raw replies.
Human paired correctness/completeness/readability review and a separate full/Rocky
recognition check remain **pending**. No model judge was run for this candidate.
Held-out results are reporting evidence only, not tuning input. Tests, token
counts, and marker observations cannot clear those release gates, and required
facts must never be removed to meet a cost target. The PR remains a draft.

An [offline assistant audit of six tuning replies](design/008-quality-audit.md)
found remaining required-fact omissions and factual imprecision: the ultra Git
reply omits the pushed-history caveat; the full pagination reply omits a bounded
limit/unique tie-breaker and overstates seek complexity. Four inspected ordinary
full replies largely read as plain technical prose. This small self-audit does
not replace paired human review or establish comparative arm effects. The
candidate remains a draft; no payload changes followed these observations.
