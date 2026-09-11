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

## Evaluation and release gates

The repeated evaluation captures 19 cases × five arms × three repetitions,
including held-out cases. Targets are full output tokens at or below terse, and
ultra at or below baseline. Provider totals include thinking and cannot be
substituted into the prose-only runtime factor calibration. Captured run hashes,
variation, unmet targets, and actual example excerpts will be recorded here after
completion. No required fact may be removed to reach a token target.

Human paired review and the separate full/Rocky recognition check remain release
gates. Test assertions and low marker counts cannot establish either one.
