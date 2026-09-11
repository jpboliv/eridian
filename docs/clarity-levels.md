# Clarity-first level candidate (ticket 008)

The current revision (008-r2) is an **unvalidated draft**. The earlier candidate
failed the preliminary quality screen and both output-cost targets. Its retained
results below do not validate the changed rules. Human correctness/completeness/readability review and
an independent check that full remains recognizably Rocky are pending. Existing
persisted level names and the default activated level (`full`) remain compatible.
The buddy carries persistent expression; reply decoration is optional.

## Level behavior and input cost

Lite uses concise grammatical prose with normal articles, verbs and negation. It
has no mandatory dialect marker. Full uses immediately understandable Rocky
engineer phrasing, with grammar restored whenever a fragment obscures meaning.
Ultra offers additional personality within a single-marker budget. Shared clarity
and persisted-output rules override all three levels.

Revision 2 addresses general failures seen in the tuning Git/API replies: a short
answer must keep conditions attached to the actions they limit, and clear Rocky
voice should come from concrete observation, causal explanation and cooperative
problem-solving. Full and ultra now guide that reasoning explicitly, using normal
grammar whenever fragments obscure meaning. Checks are appropriate when uncertainty
affects the next action; these rules impose no fixed sections or routine extra tests.
The integrated shared rules preserve necessary facts and evidence-backed claims.
No held-out content informed this revision. This is a prompt-design hypothesis,
not evidence that the quality failures are fixed.

Current counts use tiktoken 0.12.0; these are named-tokenizer approximations for
Claude, not provider billing counts. Shared rules add 253 `cl100k_base` tokens
or 249 `o200k_base` tokens.

| Level | Prior failed block, cl100k | Current block, cl100k | Current combined, cl100k | Current combined, o200k |
| ----- | -------------------------: | --------------------: | -----------------------: | ----------------------: |
| lite  |                         93 |                   105 |                      358 |                     351 |
| full  |                        156 |                   204 |                      457 |                     451 |
| ultra |                        245 |                   281 |                      534 |                     528 |

The extra guidance deliberately increases input cost relative to the failed
candidate. Level blocks remain below the original pre-ticket sizes of 181/242/288
`cl100k_base` tokens; the expanded shared rules make total input larger.
[Current hashes and both encodings](design/008-revision-2.json) identify this
integrated revision. [Initial payload counts](design/008-payload-tokens.json) and
[007-stage combined counts](design/shared-clarity-tokens.json) are historical;
neither describes current combined level input.

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

## Historical first-candidate evaluation and release gates

The following results apply only to the frozen first candidate, not revision 2.
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

An [offline assistant audit of six tuning replies](008-quality-review.md)
found remaining required-fact omissions and factual imprecision: the ultra Git
reply omits the pushed-history caveat; the full pagination reply omits a bounded
limit/unique tie-breaker and overstates seek complexity. Four inspected ordinary
full replies largely read as plain technical prose. This small self-audit does
not replace paired human review or establish comparative arm effects. The
candidate remains a draft; no payload changes followed these observations.

A broader [19-case anonymous paired screen](008-quality-review.md#broader-anonymous-paired-screen)
also failed, including unprovided artifact details in a held-out Portuguese PR
and an unsupported memory-write claim. Human approval remains pending. The
[raw archive and checksums](../eval/snapshots/clarity-levels/README.md) deliver all
285 replies with the PR, alongside the partial assessment's explicit coverage.

## Revision 2 rerun plan

No provider calls were made for this revision. Freeze the integrated source before
rerunning, verify `ruleIdentity()` equals the hash in `008-revision-2.json`, and
retain the new raw run separately from the failed first candidate. After provider
quota and authorization permit paid calls:

```sh
node eval/run.js --concurrency 10
node eval/compute-factors.js eval/runs/<new-run-id>
node eval/sample-review.js eval/runs/<new-run-id>
node eval/review.js --run eval/runs/<new-run-id>/review-sample-<id> --execute --concurrency 4
```

Capture all cells and usage, review required facts and clarity on anonymized pairs,
and report held-out findings without tuning to them. Model-assisted review does
not supply human approval or the independent full/Rocky recognition check. New
output measurements and those quality gates are required before release or runtime
factor replacement. Executable composition/marker tests and input counts cannot
establish behavior quality.
