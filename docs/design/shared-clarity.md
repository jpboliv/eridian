# Shared clarity rules (tickets 007 and 009)

One `eridian:inject:shared` region is prepended to each active level by
`loadInjectionBlock`. The existing extraction helper remains a raw-region extractor;
a separate composition helper requires both shared and level regions. Missing,
empty or duplicate regions fail closed rather than silently omitting protections.
SessionStart, mode commands, full prompt reinjection and eval consume the same
composed payload. Existing skill-source SHA256 provenance remains unchanged as an
API and naturally changes when these rules change.

The shared rules take precedence over level-specific flavor. Sentence length,
active voice and structure are preferences. Needed uncertainty, user language,
requested detail, host communication and complete meaning remain protected. Lite's
blanket instruction to cut hedging is narrowed to redundant hedging so it cannot
contradict the shared uncertainty requirement.

Persisted and third-party prose is plain and concise, respects the requested
language, audience and template, and excludes chat dialect. This includes files,
comments, commits, PRs, issues and memory. Compression keeps its specialized density
rules without authorizing dialect or meaning loss. Ticket 009 supplies the matching
command cleanup and behavioral evaluation; these tickets release together.

The revised shared block is 249 tokens using `tiktoken` 0.12.0, `o200k_base`. This is a
named-tokenizer measurement, an approximation of the host's tokenizer cost. The
149-token increase over the approximately 100-token target retains explicit
uncertainty/negation protections, host-required communication and the artifact
boundary. Removing those protections to meet the target would defeat this change.

Release gate: this implementation is a draft until the combined 007+009 rerun of
006, including held-out cases and full-versus-terse results, is attached and a
human reviews correctness, completeness and avoidable filler. Model review is
advisory and cannot satisfy human signoff. Structural counts are diagnostic; no
requirement says every count must fall. Root orchestration owns the combined run,
so this ticket does not launch a duplicate paid evaluation.

## Review correction — 2026-09-11

The original shared candidate did not reliably distinguish artifact drafting from
conversational flavor or restrict claims to available evidence. The tuning commit
case also invented implementation details. The revision makes those priorities
explicit: complete the task before shortening its wording, preserve material
conditions, use grammatical artifact prose in the exact requested format, and
distinguish a proposed draft from actions actually performed. A final private
check covers the deliverable and evidence without requesting extra output.

This is a general instruction correction informed by tuning observations, not a
patch containing expected answers from held-out prompts. The original evaluation
remains evidence for the original hash only. Revised rules require fresh repeated
paired evaluation and human acceptance; prompt-string or composition tests cannot
establish that this correction changes model behavior. The increased input cost
is measured and justified by the missing safeguards, not advertised as savings.

Run the frozen case suite after the final 007/009/008 candidate is composed; do not
modify its held-out cases or select favorable repetitions. Preserve raw usage and
report failures before considering release. The provider spend limit currently
prevents that rerun (reported reset: 19:20 Europe/Lisbon, September 11).
