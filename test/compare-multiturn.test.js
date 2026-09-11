const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { hash } = require('../eval/lib');
const { compare } = require('../eval/compare-multiturn');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-comparison-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return ['start-only', 'interval20', 'brief'].map((policy) => {
    const dir = path.join(root, policy);
    fs.mkdirSync(dir);
    const write = (file, value) => fs.writeFileSync(path.join(dir, file), JSON.stringify(value));
    const scenarios = [
      { id: 'drift', turns: Array.from({ length: 22 }, () => ({ prompt: 'Question' })) },
    ];
    write('scenarios.json', scenarios);
    write('manifest.json', {
      runId: policy,
      policy,
      repetitions: 3,
      model: 'model',
      cliVersion: 'cli',
      ruleHash: 'rule',
      scenarioHash: hash(JSON.stringify(scenarios)),
      scorerHash: 'scorer',
      invocation: ['same'],
    });
    const records = Array.from({ length: 3 }, (_, i) => {
      const id = `drift--${policy}--1--${i + 1}`;
      const prompt = JSON.stringify({ messages: [{ role: 'user', injection: 'RULES' }] });
      write(`${id}.request.json`, { prompt });
      write(`${id}.raw.json`, {});
      return {
        id,
        runId: policy,
        policy,
        ruleHash: 'rule',
        scenarioId: 'drift',
        repetition: 1,
        turn: i + 1,
        promptHash: hash(prompt),
        status: 'complete',
        usage: { input_tokens: 10, output_tokens: 20 },
        injectionChars: 5,
        reply: 'Never delete production data. Keep a rollback path.',
        diagnostics: { proseWords: 11, phraseMatches: 0, counts: { rockyMarkers: 0 } },
      };
    });
    write('records.json', records);
    write('summary.json', {
      expectedTurns: 66,
      completedTurns: 3,
      failedTurns: 0,
      skippedTurns: 63,
      complete: false,
    });
    return dir;
  });
}
test('comparison preserves missing coverage and compares only mutually completed cells', (t) => {
  const dirs = fixture(t);
  const last = dirs[2];
  const records = JSON.parse(fs.readFileSync(path.join(last, 'records.json')));
  records[2].status = 'failed';
  records[2].error = 'provider limit';
  delete records[2].usage;
  fs.writeFileSync(path.join(last, 'records.json'), JSON.stringify(records));
  fs.writeFileSync(
    path.join(last, 'summary.json'),
    JSON.stringify({
      expectedTurns: 66,
      completedTurns: 2,
      failedTurns: 1,
      skippedTurns: 63,
      complete: false,
    })
  );
  const result = compare(dirs);
  assert.equal(result.matchedCellCount, 2);
  assert.equal(result.policies.brief.coverage.skippedTurns, 63);
  for (const policy of Object.values(result.policies)) {
    assert.equal(policy.matchedCohort.turns, 2);
    assert.equal(policy.matchedCohort.outputTokens.total, 40);
  }
  assert.equal(result.policies.brief.overall.cacheReadInputTokens.total, null);
  assert.match(result.qualityGate, /Human acceptance pending/);
});
test('comparison rejects mismatched rule identity, duplicated policies and missing raw evidence', (t) => {
  const dirs = fixture(t);
  assert.throws(() => compare([dirs[0], dirs[0], dirs[2]]), /Duplicate policy/);
  const file = path.join(dirs[0], 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file));
  fs.writeFileSync(file, JSON.stringify({ ...manifest, ruleHash: 'different' }));
  assert.throws(() => compare(dirs), /mixed-identity/);
  fs.writeFileSync(file, JSON.stringify(manifest));
  fs.unlinkSync(path.join(dirs[0], 'drift--start-only--1--1.raw.json'));
  assert.throws(() => compare(dirs), /Missing raw/);
});
test('comparison rejects hidden per-turn mode cues even when the request hash matches', (t) => {
  const dirs = fixture(t);
  const file = path.join(dirs[0], 'records.json');
  const records = JSON.parse(fs.readFileSync(file));
  const prompt = JSON.stringify({ messages: [{ role: 'user', mode: 'full' }] });
  records[0].promptHash = hash(prompt);
  fs.writeFileSync(file, JSON.stringify(records));
  fs.writeFileSync(path.join(dirs[0], records[0].id + '.request.json'), JSON.stringify({ prompt }));
  assert.throws(() => compare(dirs), /Confounded/);
});
