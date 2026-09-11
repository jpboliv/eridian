const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { run, scenarios, injection } = require('../eval/multiturn');

const prefixes = { lite: 'LITE', full: 'FULL', ultra: 'ULTRA' };
const brief = { lite: 'l', full: 'f', ultra: 'u' };

test('replay injection distinguishes interval policies and suppresses off refresh', () => {
  for (const policy of ['start-only', 'interval20', 'brief']) {
    const state = { mode: 'full', index: 0 };
    assert.equal(injection(policy, {}, state, prefixes, brief), 'FULL');
    state.index = 1;
    assert.equal(injection(policy, {}, state, prefixes, brief), policy === 'brief' ? 'f' : '');
    state.index = 19;
    assert.equal(
      injection(policy, {}, state, prefixes, brief),
      policy === 'start-only' ? '' : policy === 'brief' ? 'f' : 'FULL'
    );
    assert.match(
      injection(policy, { event: 'off', mode: 'off' }, state, prefixes, brief),
      /ordinary assistant prose/
    );
    assert.equal(injection(policy, {}, state, prefixes, brief), '');
    assert.equal(
      injection(policy, { event: 'mode', mode: 'ultra' }, state, prefixes, brief),
      'ULTRA'
    );
    assert.equal(injection(policy, { event: 'resume' }, state, prefixes, brief), 'ULTRA');
    assert.equal(injection(policy, { event: 'compact' }, state, prefixes, brief), 'ULTRA');
  }
  assert.ok(scenarios().every((s) => s.turns.length >= 22));
});

test('paid CLI calls require explicit opt-in and valid repeat coverage', async () => {
  await assert.rejects(run({ cli: '/missing' }), /allow-paid/);
  await assert.rejects(run({ allowPaid: true, concurrency: 7, cli: '/missing' }), /Concurrency/);
  await assert.rejects(
    run({ allowPaid: true, repetitions: 1, cli: '/missing' }),
    /three repetitions/
  );
  await assert.rejects(run({ allowPaid: true, policy: 'brief', cli: '/missing' }), /brief-file/);
});

test('fake CLI retains requests, transcripts, usage, policy hashes and failed evidence in unique runs', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-multiturn-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cli = path.join(dir, 'fake-claude');
  fs.writeFileSync(
    cli,
    `#!/usr/bin/env node
if (process.argv.includes('--version')) { console.log('fake-cli-1'); process.exit(0); }
const p = JSON.parse(process.argv[process.argv.indexOf('-p') + 1]);
if (process.env.ERIDIAN_OFF !== '1' || !process.argv.includes('--safe-mode') || !p.messages.length) process.exit(4);
console.log(JSON.stringify({subtype:'success', result:'Never delete production data. Keep a rollback path.', usage:{input_tokens:12, output_tokens:9, cache_read_input_tokens:3}, modelUsage:{'fake-model':{outputTokens:9}}}));
`,
    { mode: 0o755 }
  );
  const options = {
    allowPaid: true,
    cli,
    out: dir,
    scenarios: [scenarios()[1]],
    policy: 'interval20',
  };
  const first = await run(options);
  assert.equal(first.records.length, 66);
  assert.ok(first.records.every((r) => r.status === 'complete'));
  assert.equal(first.records[0].usage.cache_read_input_tokens, 3);
  assert.deepEqual(first.records[0].actualModels, ['fake-model']);
  assert.equal(first.manifest.cliVersion, 'fake-cli-1');
  assert.match(first.manifest.mode, /not persisted host sessions/);
  const request = JSON.parse(
    fs.readFileSync(path.join(first.out, 'lifecycle--interval20--1--18.request.json'))
  );
  const compacted = JSON.parse(request.prompt).messages;
  assert.equal(compacted.length, 2);
  assert.equal(compacted[0].role, 'context-summary');
  assert.ok(compacted.every((message) => !('mode' in message)));
  const ordinary = JSON.parse(
    JSON.parse(fs.readFileSync(path.join(first.out, 'lifecycle--interval20--1--2.request.json')))
      .prompt
  );
  assert.ok(ordinary.messages.every((message) => !('mode' in message)));
  assert.equal(ordinary.messages.at(-1).injection, '');
  assert.ok(!first.manifest.invocation.some((arg) => arg.includes('current simulated mode')));
  const transcript = JSON.parse(
    fs.readFileSync(path.join(first.out, 'lifecycle--interval20--1.transcript.json'))
  );
  assert.equal(transcript.length, 44); // compaction never discards retained evidence
  assert.equal(first.records.find((r) => r.turn === 11).injectionChars, 0);
  assert.ok(first.records.find((r) => r.turn === 20).injectionChars > 0);
  fs.writeFileSync(
    cli,
    `#!/usr/bin/env node
if (process.argv.includes('--version')) console.log('fake-cli-1');
else { console.log('{"subtype":"error","result":"truncated"}'); process.exit(1); }
`,
    { mode: 0o755 }
  );
  const second = await run(options);
  assert.notEqual(first.out, second.out);
  assert.equal(second.records.length, 3);
  assert.ok(second.records.every((r) => r.status === 'failed' && !('usage' in r)));
  const summary = JSON.parse(fs.readFileSync(path.join(second.out, 'summary.json')));
  assert.equal(summary.skippedTurns, 63);
  assert.equal(summary.complete, false);
  const raw = JSON.parse(
    fs.readFileSync(path.join(second.out, 'lifecycle--interval20--1--1.raw.json'))
  );
  assert.equal(raw.exitCode, 1);
  assert.match(raw.stdout, /truncated/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(first.out, 'records.json'))).length, 66);
});
