const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../eval/run');
const { validateResult, summarize, anonymize, validateCollection } = require('../eval/lib');

test('rejects failed, truncated, empty and invalid usage results', () => {
  const good = {
    subtype: 'success',
    result: 'answer',
    stop_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 2 },
  };
  assert.equal(validateResult(good), good);
  for (const change of [
    { is_error: true },
    { stop_reason: 'max_tokens' },
    { result: '' },
    { usage: { output_tokens: 2 } },
  ]) {
    assert.throws(() => validateResult({ ...good, ...change }));
  }
});

test('aggregation retains repetitions and separates mean relative from aggregate reduction', () => {
  const records = [];
  for (const [repetition, reference, arm] of [
    [1, 10, 20],
    [2, 100, 50],
    [3, 100, 50],
  ]) {
    for (const [mode, tokens] of [
      ['baseline', reference],
      ['terse', reference],
      ['lite', arm],
      ['full', arm],
      ['ultra', arm],
    ]) {
      records.push({
        promptId: 'p',
        repetition,
        arm: mode,
        status: 'complete',
        usage: { output_tokens: tokens },
        reply: 'answer',
      });
    }
  }
  const summary = summarize(records);
  assert.equal(summary.complete, 15);
  assert.equal(summary.repeatedCoverageComplete, true);
  assert.equal(summary.comparisons.baseline.full.sampleCount, 3);
  assert.equal(summary.comparisons.baseline.full.relativeReduction.mean, 0);
  assert.ok(summary.comparisons.baseline.full.aggregateTokenReduction > 0.4);
  assert.equal(summarize(records.slice(1)).repeatedCoverageComplete, false);
  assert.throws(() => summarize([...records, records[0]]), /Duplicate/);
  const { pairs } = anonymize(records, [{ id: 'p', prompt: 'Question', requiredFacts: ['fact'] }]);
  assert.equal(pairs.length, 18);
  assert.equal(pairs[0].review.correctness, null);
  assert.equal(pairs[0].arm, undefined);
});

test('harness retains immutable raw replies, failures and isolation without changing state', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-eval-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cli = path.join(dir, 'fake-claude');
  fs.writeFileSync(
    cli,
    `#!${process.execPath}\n
    if (process.argv.includes('--version')) { console.log('fake-1'); process.exit(0); }
    const assert = require('node:assert/strict');
    assert.equal(process.env.ERIDIAN_OFF, '1');
    assert.ok(process.argv.includes('--safe-mode'));
    assert.ok(process.argv.includes('--no-session-persistence'));
    console.log(JSON.stringify({ subtype: 'success', result: 'Answer.', stop_reason: 'end_turn', usage: {input_tokens: 10, output_tokens: 3}, modelUsage: {'fake-model': {outputTokens: 3}} }));
  `,
    { mode: 0o755 }
  );
  const prompts = path.join(dir, 'prompts.json');
  fs.writeFileSync(
    prompts,
    JSON.stringify([
      {
        id: 'case',
        prompt: 'Question?',
        language: 'en',
        split: 'held-out',
        requiredFacts: ['Answer'],
      },
    ])
  );
  const opts = { cli, prompts, out: dir, repetitions: 3, concurrency: 2 };
  const first = await run(opts);
  assert.equal(first.records.length, 15);
  assert.ok(first.records.every((r) => r.status === 'complete'));
  const saved = fs.readFileSync(path.join(first.out, 'manifest.json'), 'utf8');
  assert.equal(JSON.parse(saved).isolation.ERIDIAN_OFF, '1');
  assert.equal(fs.readdirSync(first.out).filter((f) => f.endsWith('.raw.json')).length, 15);
  fs.writeFileSync(
    cli,
    `#!${process.execPath}\nif(process.argv.includes('--version')) { console.log('fake-2'); } else { console.log('broken'); process.exitCode=1; }`,
    { mode: 0o755 }
  );
  const second = await run({ ...opts, repetitions: 1, arms: ['baseline'] });
  assert.notEqual(first.out, second.out);
  assert.equal(second.records[0].status, 'failed');
  assert.equal(fs.readFileSync(path.join(first.out, 'manifest.json'), 'utf8'), saved);
  assert.ok(fs.existsSync(path.join(second.out, 'case--baseline--1.raw.json')));
});

test('completed collection requires all declared prompts and consistent completion counts', () => {
  const manifest = { runId: 'run', ruleHash: 'rules', arms: ['baseline'], repetitions: 1 };
  const prompts = [{ id: 'one' }, { id: 'two' }];
  const records = prompts.map(({ id }) => ({
    runId: 'run',
    ruleHash: 'rules',
    promptId: id,
    arm: 'baseline',
    repetition: 1,
    status: 'complete',
    usage: { output_tokens: 3 },
  }));
  const completion = { finishedAt: '2026-09-11', successful: 2, failed: 0 };
  assert.deepEqual(validateCollection(manifest, prompts, records, completion), {
    successful: 2,
    failed: 0,
  });
  assert.throws(() => validateCollection(manifest, prompts, records, undefined), /metadata/);
  assert.throws(
    () => validateCollection(manifest, prompts, records.slice(1), { ...completion, successful: 1 }),
    /coverage/
  );
  assert.throws(
    () => validateCollection(manifest, prompts, records, { ...completion, successful: 1 }),
    /counts/
  );
  assert.throws(
    () => validateCollection(manifest, prompts, [...records, records[0]], completion),
    /duplicate/
  );
});
