# Style diagnostics

`node scripts/readcost.js reply.md` prints JSON. Pipe a reply to the same command
without a filename (or use `-`) for stdin. Use `--language pt` for Portuguese;
`--language en` is the default. The library exports CommonJS
`SCHEMA_VERSION` (`1`) and `score(text, { language = 'en' } = {})` from `scripts/lib/readcost.js`.

This is a deterministic English phrase diagnostic, not a comprehension score or
reading-time estimate. Matches require interpretation. Zero matches cannot
establish clarity, completeness, or appropriate uncertainty. Short fragments can
have zero matches while omitting essential information. Requested headers, tables,
bullets, and persona markers are observations and never contribute to the rate.

## Schema (version 1)

| Field                             | Meaning                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `schemaVersion`                   | `1`                                                                                              |
| `label`                           | `style diagnostics`                                                                              |
| `language`                        | Supplied language tag, trimmed and lowercased                                                    |
| `lexicalSupported`                | True only for `en` or an `en-` language tag; no automatic language detection                     |
| `proseWords`                      | Unicode letter/number runs, with internal straight or curly apostrophes retained                 |
| `sentences`                       | Nonempty word-bearing fragments split at line breaks or `.`, `!`, `?` followed by whitespace/end |
| `longSentences`                   | Those fragments containing more than 30 words                                                    |
| `counts`                          | Raw counts described below                                                                       |
| `phraseMatches`                   | Sum of filler, preambles, recaps, salesLanguage; null when unsupported                           |
| `phraseMatchRatePer100ProseWords` | `100 * phraseMatches / proseWords`; null for zero prose words or unsupported language            |

`counts` contains `filler`, `preambles`, `recaps`, `salesLanguage`, and
`rockyMarkers` from the separate lexicon module. These are null for unsupported
languages. Structural `headers`, `boldLabelBullets`, `emojiBullets`, and `tables`
remain available in any language. Tables count Markdown delimiter rows, headers
count ATX and setext forms, bold-label bullets count a list marker followed by
bold text, and emoji bullets count lines beginning with a pictographic emoji
(optionally after a list marker). Counts approximate Markdown structure; they are
not a complete Markdown parser. Table cells, labels, and headings remain in the
word denominator. Sentences are simple fragments, not linguistic segmentation;
abbreviations and decimals can affect results.

## Matching and exclusions

Matching is case-insensitive, uses Unicode letter/number/underscore boundaries,
treats whitespace runs equally, and accepts either apostrophe form. Candidates
are selected left to right, longest first at the same position, and overlapping
matches are skipped. Ties use category/phrase order in the lexicon. There are no
single-word penalties for terms such as “just”, “may”, or “perhaps”.

Backtick and tilde fences (at least three characters, indented at most three
spaces) are excluded until a matching same-character fence of equal or greater
length; unclosed fences exclude the remainder. Paired inline backtick runs and lines indented by four spaces or a tab are
excluded. Indented prose is conservatively treated as code. Markdown blockquote lines and paired straight/curly double quotes,
guillemets, and standalone single-quoted spans are excluded from both counts and
the word denominator. Contractions are retained. Straight single quotes are paired within
a line; double quotes, curly quotes, and guillemets may span lines. Unmatched quotes/ticks remain
prose. This conservative heuristic does not parse every Markdown quotation form
(for example lazy blockquote continuations), or nested quotation.

Code-only or quote-only replies have a null prose phrase rate, never a perfect
quality rating. A supplied unsupported language (including Portuguese) has null
lexical counts and rate, even when its visible text resembles an English phrase.
