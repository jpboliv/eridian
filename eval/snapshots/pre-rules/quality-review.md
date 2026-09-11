# Baseline model-assisted quality audit

Baseline response collection retained all 270 replies in run `2026-09-11T15-47-21.837Z-7766f0c6`. The optional judge collection was explicitly stopped early: invalid judge schema and observed critical losses. Its full planned coverage was 324 paired judgments; 58 raw responses were retained and 266 pairs skipped (including interrupted in-flight calls without complete raw responses).

Original review directory: `quality-reviews/2026-09-11T15-54-52.967Z-badbcd49-1a9f-4726-be16-62aa1b1a2779`.
Offline derived review directory: `quality-reviews/2026-09-11T16-01-43.426Z-ad3fa512-887e-4ec4-8261-d7c6203b4d54`.

The original parser rejected fenced JSON. Narrow offline revalidation accepts a single JSON fence without fabricating missing fields: 32 judgments validate, 26 remain failed (21 missing required critical-loss rationale, 3 invalid fact assessments, 2 invalid scores). Future calls use CLI `--json-schema` and support structured-only results. Raw artifacts and original judgments remain unchanged.

## Coverage and interpretation

The 32 valid pairs provide 64 side assessments, with 36 model-flagged constraint losses. These are assessment counts, not unique defects: reference replies recur across pairings. Early collection covered baseline comparisons only, with no terse comparisons. It is an order-biased, incomplete screen and cannot estimate comparative arm quality or justify style-rule changes on its own.

| Split | Arm | Side assessments | Model loss flags |
| --- | --- | ---: | ---: |
| tuning | baseline | 28 | 16 |
| tuning | lite | 10 | 8 |
| tuning | full | 8 | 5 |
| tuning | ultra | 10 | 6 |
| held-out | baseline | 4 | 0 |
| held-out | lite | 1 | 0 |
| held-out | full | 2 | 0 |
| held-out | ultra | 1 | 1 |

Arm attribution happened only after judgments, using the key. Held-out cases were counted for reporting only; their contents were not used for tuning.

## Manual assistant audit: tuning cases only

This is an assistant inspection of source replies, not human approval.

- `240e7349fe80`, docker-cache, A/lite: source Dockerfile runs `npm install` and then `npm ci --omit=dev`, despite calling them alternatives; `.dockerignore` is absent. The redundant install is a concrete actionable defect. The model's required-fact omission is supported; the flag's severity still requires human judgment.
- `2b8444506daa`, ambiguous-target, A/lite: reply invents three scenarios instead of asking whether production or staging is the intended backup. It does not delete anything, but misses the specific required clarification. This supports a completeness/actionability failure, not evidence of an actual destructive action.
- `0b1c63456caa`, git-revert, A/ultra: `git reset --soft HEAD~1` and staged-change explanation are correct. The pushed-history coordination caveat required by the rubric is absent. However, the judge assigns correctness 2 partly because of dialect, conflating factual accuracy with style. Do not treat that numerical score as a verified factual-error count.
- `3a402e7a14b7`, api-pagination, A/baseline: arbitrary page-jump limitation is absent as flagged. More seriously, the reply calls a cursor an immutable snapshot and promises O(1) lookup; a cursor alone provides neither guarantee. The judge calls this content technically accurate, demonstrating missed factual defects and the need for independent human review.

The baseline fails this preliminary quality screen. No claim of complete paired review, established arm causality, or human quality approval is made. All 270 original replies remain available for subsequent human review. Provider usage from retained calls is preserved; stopped in-flight calls may have incurred usage without a retained final provider report.
