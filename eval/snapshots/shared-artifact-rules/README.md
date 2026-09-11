# Shared clarity and artifact evaluation — tickets 007 and 009

285/285 successful response cells:19prompts×5arms×3repetitions, including four held-out cases.
The extra conventional-commit case was added in009; comparisons with the older18-case baseline must use the common cases.

Model:`claude-haiku-4-5-20251001`; rule hash:`4a6b724f66d9e9da0991cf69e0108fb2edc9f99943d9eaecc452c92c61868069`.
Archive SHA256:`eba21d2b35e028924fb72a59532a30f5fab012f39329c4817e04fd7a39763471`.

| Comparison | Pairs | Mean relative output reduction | Aggregate output reduction |
| --- | --- | --- | --- |
| lite vs baseline | 57 | -9.7% | -5.6% |
| full vs baseline | 57 | -152.1% | -146.7% |
| ultra vs baseline | 57 | -36.8% | -28.3% |
| lite vs terse | 57 | -20.1% | -14.5% |
| full vs terse | 57 | -168.8% | -167.6% |
| ultra vs terse | 57 | -48.3% | -39.2% |

Targets remain unmet. Counts include provider thinking; no runtimeprosecalibration is published.

## Quality gate: not passed

A declared representative sample selected57baseline pairs:one perprompt/dialect arm,
with repetitions rotated deterministically. This is not complete paired review.
The judge initially rejected all57; offline envelope revalidation recovered25valid
structured completions.32true CLIerrors remain failed, including schema exhaustion
and provider-limit errors.16valid pairs had at least one model critical-loss flag;
these are advisory flags, not audited unique defects. Raworiginalandderivedjudgments
and selection policy are preserved in the archive. Humanacceptance is pending.

Assistant inspection of eight first-repetition artifact replies (full/ultra across
four cases) confirmed that memoryentries preserved port5433, productioncredential
prohibition, backup order and exception. It also found failures:full emitted a code
comment containing “timeout no prove rejection” (dialect leaked into persisted prose),
and the full conventional-commit case omitted the conventional type prefix and
invented implementation details. Portuguese PR bodies added unprovided validation
specifics. These examples do not establish a complete artifact-quality pass.

Held-out content was inspected for reporting only; it was not used to tune rules.
The later008candidate is evaluated separately.007/009must not be released merely
because code tests pass; review the complete rule-change stack and humanqualitygate.
