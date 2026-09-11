# Clarity-level candidate raw evidence

The archive retains run `2026-09-11T16-07-28.095Z-07dd213e`: 19 cases, five arms,
three repetitions, 285 successful responses and no failed cells. It includes the
manifest/prompt snapshot, exact CLI stdout/stderr, parsed records and summaries,
anonymous pairs and attribution key, deterministic 57-pair sample, and the
19-pair offline assistant selection/assessments. Human review remains pending;
the preliminary quality screen failed.

- [Raw run archive](raw-run.tar.gz)
- [Archive SHA-256](raw-run.sha256)
- [Per-file hashes and readable inventory](index.json)
- [Quality screen and limits](../../../docs/008-quality-review.md)
- [Costs, marker observations and provenance](../../../docs/clarity-levels.md)

Verify and inspect from this directory:

```sh
shasum -a 256 -c raw-run.sha256
tar -tzf raw-run.tar.gz
```

The archive contains provider-reported usage, not a compatible prose-only runtime
calibration. It makes no human-quality or complete-review claim. The candidate
payload stayed frozen during response collection and subsequent assessment.
