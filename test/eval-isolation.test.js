const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');

test('eval forces opt-out in all arms and records isolation on fresh and partial runs', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-eval-isolation-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of ['eval', 'scripts', 'skills']) {
    fs.cpSync(path.join(ROOT, name), path.join(dir, name), { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, 'eval/prompts.json'),
    JSON.stringify([{ id: 'p1', prompt: 'Explain a lock.' }])
  );
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(stateDir);
  const stateFile = path.join(stateDir, 'state.json');
  const state = JSON.stringify({
    current: 'ultra',
    events: [],
    buddy: {},
    promptsSinceReinject: 999,
  });
  fs.writeFileSync(stateFile, state);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  function executable(name, body) {
    fs.writeFileSync(path.join(bin, name), `#!${process.execPath}\n${body}`, { mode: 0o755 });
  }
  // Substitute only the external services: exercise the real harness and hooks.
  executable(
    'claude',
    `
    const fs = require('node:fs');
    const { execFileSync } = require('node:child_process');
    const assert = require('node:assert/strict');
    assert.equal(process.env.ERIDIAN_OFF, '1');
    for (const args of [['scripts/session-start.js'], ['scripts/buddy-hook.js', 'prompt']]) {
      assert.equal(execFileSync(process.execPath, args, {
        input: JSON.stringify({ prompt: 'Explain a lock.' }), encoding: 'utf8'
      }), '');
    }
    fs.appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(2)) + '\\n');
    console.log(JSON.stringify({ usage: { output_tokens: 7 } }));
  `
  );
  // The test suite needs only Node; the production harness uses real jq.
  executable(
    'jq',
    `
    const fs = require('node:fs');
    const [flag, query, file] = process.argv.slice(2);
    const data = JSON.parse(fs.readFileSync(file || 0, 'utf8'));
    if (flag === '-c' && query === '.[]') {
      for (const row of data) console.log(JSON.stringify(row));
    } else if (flag === '-r' && ['.id', '.prompt', '.usage.output_tokens'].includes(query)) {
      console.log(query.slice(1).split('.').reduce((value, key) => value[key], data));
    } else {
      throw new Error('Unexpected jq invocation');
    }
  `
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    ERIDIAN_OFF: '0',
    ERIDIAN_STATE_DIR: stateDir,
  };
  function run(args) {
    execFileSync('bash', ['eval/run.sh', ...args], { cwd: dir, env, encoding: 'utf8' });
    assert.equal(fs.readFileSync(stateFile, 'utf8'), state);
  }
  function records(name) {
    return fs.readFileSync(path.join(dir, name), 'utf8').trim().split('\n');
  }
  const modes = ['baseline', 'terse', 'lite', 'full', 'ultra'];
  run([]);
  const calls = records('calls.jsonl').map(JSON.parse);
  assert.equal(calls.length, 5);
  assert.equal(calls[0][1], 'Explain a lock.');
  assert.equal(calls[1][1], 'Answer concisely.\n\nExplain a lock.');
  for (let i = 2; i < 5; i++) assert.ok(calls[i][1].includes(`ROCKY MODE (${modes[i]})`));
  assert.deepEqual(records('eval/results.csv'), [
    'prompt_id,mode,output_tokens',
    ...modes.map((mode) => `p1,${mode},7`),
  ]);
  let metadata = records('eval/results-isolation.jsonl').map(JSON.parse);
  assert.equal(metadata.length, 1);
  assert.deepEqual(metadata[0].modes, modes);
  assert.equal(metadata[0].isolation.ERIDIAN_OFF, '1');
  assert.ok(Number.isFinite(Date.parse(metadata[0].startedAt)));
  run(['terse']);
  metadata = records('eval/results-isolation.jsonl').map(JSON.parse);
  assert.equal(metadata.length, 2);
  assert.deepEqual(metadata[1].modes, ['terse']);
  assert.equal(records('eval/results.csv').length, 7);
  run([]);
  assert.equal(records('eval/results-isolation.jsonl').length, 1);
  assert.equal(records('eval/results.csv').length, 6);
});
