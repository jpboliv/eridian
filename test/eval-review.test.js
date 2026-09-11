const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { review, validateJudgment, MODEL } = require('../eval/review');

function judgment(facts = ['Keep backups']) {
  const side = {
    correctness: 5,
    completeness: 5,
    actionability: 4,
    readability: 4,
    criticalConstraintLoss: false,
    requiredFacts: facts.map((fact) => ({
      fact,
      status: 'preserved',
      reason: 'Both answers explicitly retain backups.',
    })),
    reasons: Object.fromEntries(
      ['correctness', 'completeness', 'actionability', 'readability', 'criticalConstraintLoss'].map(
        (key) => [key, 'Supported by explicit backup instruction.']
      )
    ),
  };
  return {
    a: structuredClone(side),
    b: structuredClone(side),
    preference: 'tie',
    rationale: 'Both answers preserve the requested backup.',
  };
}

function fixture(t, prompts = ['success']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-judge-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pairs = prompts.map((prompt, index) => ({
    id: `pair-${index}`,
    prompt,
    language: 'en',
    requiredFacts: ['Keep backups'],
    a: 'Keep backups.',
    b: 'Retain backups.',
  }));
  fs.writeFileSync(path.join(dir, 'paired-review.json'), JSON.stringify(pairs));
  // Any accidental key read/parse fails: the judge must consume only anonymous data.
  fs.writeFileSync(path.join(dir, 'paired-key.json'), 'ARM-SECRET-NOT-JSON');
  const cli = path.join(dir, 'fake-claude');
  fs.writeFileSync(
    cli,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('fake-claude 1'); process.exit(0); }
const payload = JSON.parse(args[1]);
if (payload.prompt === 'timeout') { setInterval(() => {}, 1000); }
else {
  if (process.env.ERIDIAN_OFF !== '1' || process.env.CLAUDE_CODE_SAFE_MODE !== '1' || !args.includes('--safe-mode') || !args.includes('--strict-mcp-config') || !args.includes('--disable-slash-commands') || !args.includes('--no-session-persistence') || args[args.indexOf('--tools') + 1] !== '' || args[args.indexOf('--model') + 1] !== '${MODEL}' || args[args.indexOf('--mcp-config') + 1] !== '{"mcpServers":{}}' || fs.existsSync('paired-key.json') || /ARM-SECRET|"arm"|"split"/.test(args[1])) throw new Error('isolation or anonymization failure');
  const result = ${JSON.stringify(judgment())};
  if (payload.prompt === 'critical') { result.a.requiredFacts[0].status = 'missing'; result.a.criticalConstraintLoss = true; }
  if (payload.prompt === 'contradictory') result.a.requiredFacts[0].status = 'missing';
  if (payload.prompt === 'incomplete') delete result.a.readability;
  console.log(JSON.stringify({subtype:'success', result: payload.prompt === 'malformed' ? 'not JSON' : JSON.stringify(result), usage:{input_tokens:23,output_tokens:17},modelUsage:{'${MODEL}':{inputTokens:23,outputTokens:17}}}));
  if (payload.prompt === 'failed') process.exitCode = 1;
}
`,
    { mode: 0o755 }
  );
  return { dir, cli, pairs };
}

test('requires explicit opt-in before invoking any CLI or reading a run', async () => {
  await assert.rejects(review({ cli: '/does-not-exist' }), /opt in/);
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, '../eval/review.js'), '--run', '/does-not-exist'],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /opt in/);
});

test('validates every dimension, required fact, loss flag, and reason', () => {
  assert.deepEqual(validateJudgment(judgment(), ['Keep backups']), judgment());
  const malformed = [null, {}, judgment(), judgment(), judgment(), judgment(), judgment()];
  malformed[2].a.correctness = 6;
  malformed[3].b.requiredFacts = [];
  malformed[4].a.reasons.readability = '';
  malformed[5].a.requiredFacts[0].status = 'missing';
  malformed[6].b.requiredFacts[0].fact = 'An unrelated fact';
  for (const value of malformed) assert.throws(() => validateJudgment(value, ['Keep backups']));
});

test('isolated fake judge retains anonymized inputs, hashes, usage, and immutable reruns', async (t) => {
  const { dir, cli } = fixture(t, ['success', 'critical']);
  const first = await review({ run: dir, cli, execute: true, concurrency: 2 });
  assert.equal(first.records.length, 2);
  assert.ok(
    first.records.every(
      (record) => record.status === 'complete' && record.humanReview === 'pending'
    )
  );
  assert.equal(first.records[1].judgment.a.criticalConstraintLoss, true);
  assert.deepEqual(first.records[0].usage, { input_tokens: 23, output_tokens: 17 });
  assert.deepEqual(first.records[0].actualModels, [MODEL]);
  for (const key of [
    'modelHash',
    'cliVersionHash',
    'inputHash',
    'systemPromptHash',
    'reviewerHash',
  ])
    assert.match(first.manifest[key], /^[a-f0-9]{64}$/);
  assert.match(first.records[0].promptHash, /^[a-f0-9]{64}$/);
  const before = fs.readFileSync(path.join(first.out, 'pair-0.raw.json'), 'utf8');
  const second = await review({ run: dir, cli, execute: true, concurrency: 1 });
  assert.notEqual(first.out, second.out);
  assert.equal(fs.readFileSync(path.join(first.out, 'pair-0.raw.json'), 'utf8'), before);
  const completion = JSON.parse(fs.readFileSync(path.join(first.out, 'completion.json')));
  assert.equal(completion.humanReview, 'pending');
  assert.match(completion.qualityGate, /cannot approve/);
});

test('malformed, incomplete, contradictory and failed judges fail closed with raw evidence', async (t) => {
  const { dir, cli } = fixture(t, ['malformed', 'incomplete', 'contradictory', 'failed']);
  const result = await review({ run: dir, cli, execute: true });
  assert.equal(result.records.length, 4);
  for (const record of result.records) {
    assert.equal(record.status, 'failed');
    assert.equal(record.judgment, undefined);
    assert.equal(record.usage.output_tokens, 17);
    assert.ok(fs.existsSync(path.join(result.out, `${record.pairId}.raw.json`)));
  }
});

test('timed-out judge is killed and recorded without a judgment', async (t) => {
  const { dir, cli } = fixture(t, ['timeout']);
  const result = await review({ run: dir, cli, execute: true, timeoutMs: 500 });
  assert.equal(result.records[0].status, 'failed');
  const raw = JSON.parse(fs.readFileSync(path.join(result.out, 'pair-0.raw.json')));
  assert.equal(raw.timedOut, true);
});

test('invalid anonymous input and concurrency reject before calls', async (t) => {
  const { dir, cli, pairs } = fixture(t);
  await assert.rejects(review({ run: dir, cli, execute: true, concurrency: 17 }), /concurrency/);
  pairs[0].id = '../escape';
  fs.writeFileSync(path.join(dir, 'paired-review.json'), JSON.stringify(pairs));
  await assert.rejects(review({ run: dir, cli, execute: true }), /Invalid anonymous/);
  assert.equal(fs.existsSync(path.join(dir, 'quality-reviews')), false);
});
