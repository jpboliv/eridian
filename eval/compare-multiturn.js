#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { hash, distribution } = require('./lib');
const POLICIES = ['start-only', 'interval20', 'brief'];
function compare(directories) {
  if (directories.length !== 3) throw new Error('Supply exactly three policy runs');
  const runs = directories.map((dir) => {
    const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    const manifest = read('manifest.json');
    const scenarios = read('scenarios.json');
    const summary = read('summary.json');
    const records = read('records.json');
    if (hash(JSON.stringify(scenarios)) !== manifest.scenarioHash)
      throw new Error('Scenario hash mismatch');
    if (!POLICIES.includes(manifest.policy) || manifest.repetitions < 3)
      throw new Error('Unsupported policy or insufficient repetitions');
    const expected = new Set();
    for (const scenario of scenarios)
      for (let repetition = 1; repetition <= manifest.repetitions; repetition++)
        for (let turn = 1; turn <= scenario.turns.length; turn++)
          expected.add(`${scenario.id}:${repetition}:${turn}`);
    for (const record of records) {
      if (
        record.runId !== manifest.runId ||
        record.ruleHash !== manifest.ruleHash ||
        record.policy !== manifest.policy ||
        !expected.delete(`${record.scenarioId}:${record.repetition}:${record.turn}`)
      )
        throw new Error('Unexpected or mixed-identity turn');
      const request = read(`${record.id}.request.json`);
      if (hash(request.prompt) !== record.promptHash) throw new Error('Request hash mismatch');
      const replay = JSON.parse(request.prompt);
      if (replay.messages.some((message) => Object.hasOwn(message, 'mode')))
        throw new Error('Confounded replay contains implicit per-turn mode cues');
      if (!fs.existsSync(path.join(dir, `${record.id}.raw.json`)))
        throw new Error('Missing raw turn evidence');
      record.requestCharacters = request.prompt.length;
    }
    const completed = records.filter((r) => r.status === 'complete');
    const failed = records.filter((r) => r.status === 'failed');
    if (
      completed.length + failed.length !== records.length ||
      summary.completedTurns !== completed.length ||
      summary.failedTurns !== failed.length ||
      summary.skippedTurns !== expected.size ||
      summary.expectedTurns !== records.length + expected.size
    )
      throw new Error('Incomplete or inconsistent recorded coverage');
    return { dir, manifest, summary, records, completed };
  });
  if (new Set(runs.map((r) => r.manifest.policy)).size !== 3) throw new Error('Duplicate policy');
  const first = runs[0].manifest;
  for (const { manifest } of runs)
    for (const key of [
      'model',
      'cliVersion',
      'ruleHash',
      'scenarioHash',
      'scorerHash',
      'repetitions',
    ])
      if (manifest[key] !== first[key]) throw new Error(`Incompatible ${key}`);
  if (
    runs.some(
      ({ manifest }) => JSON.stringify(manifest.invocation) !== JSON.stringify(first.invocation)
    )
  )
    throw new Error('Different provider invocation');
  const cellKey = (record) => `${record.scenarioId}:${record.repetition}:${record.turn}`;
  const commonCells = runs[0].completed
    .map(cellKey)
    .filter((key) => runs.every((run) => run.completed.some((record) => cellKey(record) === key)));
  const metrics = (records) => {
    const field = (name) => {
      const values = records.map((r) => r.usage?.[name]).filter(Number.isFinite);
      return {
        reported: values.length,
        missing: records.length - values.length,
        total: values.length ? values.reduce((a, b) => a + b, 0) : null,
        distribution: distribution(values),
      };
    };
    return {
      turns: records.length,
      inputTokens: field('input_tokens'),
      outputTokens: field('output_tokens'),
      cacheReadInputTokens: field('cache_read_input_tokens'),
      cacheCreationInputTokens: field('cache_creation_input_tokens'),
      injectedCharacters: records.reduce((sum, r) => sum + r.injectionChars, 0),
      replayedRequestCharacters: records.reduce((sum, r) => sum + r.requestCharacters, 0),
      proseWords: distribution(records.map((r) => r.diagnostics.proseWords)),
      rockyMarkerMatches: records.reduce(
        (sum, r) => sum + (r.diagnostics.counts.rockyMarkers || 0),
        0
      ),
      phraseMatches: records.reduce((sum, r) => sum + (r.diagnostics.phraseMatches || 0), 0),
      literalConstraintScreen: {
        label: 'Literal anchors only; not semantic correctness or quality approval',
        missingNeverDelete: records
          .filter((r) => !/never\s+delete\s+production\s+data/i.test(r.reply.replace(/[*_`]/g, '')))
          .map((r) => r.id),
        missingRollback: records
          .filter((r) => !/rollback\s+path/i.test(r.reply.replace(/[*_`]/g, '')))
          .map((r) => r.id),
      },
    };
  };
  return {
    schemaVersion: 1,
    matchedCellCount: commonCells.length,
    comparisonLimit:
      'Only matched cohorts share complete cells; overall totals have unequal coverage and cannot establish a policy benefit.',
    model: first.model,
    cliVersion: first.cliVersion,
    ruleHash: first.ruleHash,
    scenarioHash: first.scenarioHash,
    scope:
      'Synthetic context replay, not real host hooks or billed session cost. Output may include thinking; character counts are not tokens.',
    qualityGate:
      'Human acceptance pending; literal anchors and style diagnostics cannot establish correctness.',
    policies: Object.fromEntries(
      runs.map(({ manifest, summary, records, completed }) => [
        manifest.policy,
        {
          runId: manifest.runId,
          coverage: summary,
          overall: metrics(completed),
          matchedCohort: metrics(
            completed.filter((record) => commonCells.includes(cellKey(record)))
          ),
          byScenario: Object.fromEntries(
            [...new Set(records.map((r) => r.scenarioId))].map((id) => [
              id,
              metrics(completed.filter((r) => r.scenarioId === id)),
            ])
          ),
          driftWindows: Object.fromEntries(
            [
              ['early', 1, 5],
              ['beforeRefresh', 16, 19],
              ['afterRefresh', 20, 22],
            ].map(([name, start, end]) => [
              name,
              metrics(
                completed.filter(
                  (r) => r.scenarioId === 'drift' && r.turn >= start && r.turn <= end
                )
              ),
            ])
          ),
          failures: records
            .filter((r) => r.status === 'failed')
            .map((r) => ({ id: r.id, error: r.error })),
        },
      ])
    ),
  };
}
if (require.main === module) {
  try {
    console.log(JSON.stringify(compare(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { compare };
