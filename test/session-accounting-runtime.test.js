require('./helpers/env').isolateEnv();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-runtime-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return {
    dir,
    env: { ...process.env, ERIDIAN_STATE_DIR: dir, ERIDIAN_OFF: '0', CLAUDE_SESSION_ID: '' },
  };
}
function run(f, script, args = [], input = {}) {
  return execFileSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    env: f.env,
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
}
function read(f) {
  return JSON.parse(fs.readFileSync(path.join(f.dir, 'state.json'), 'utf8'));
}
function asyncRun(f, script, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', script), ...args], {
      env: f.env,
    });
    let output = '';
    let error = '';
    child.stdout.on('data', (c) => (output += c));
    child.stderr.on('data', (c) => (error += c));
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve(output) : reject(new Error(error))));
    child.stdin.end(JSON.stringify(input));
  });
}
test('sessions retain their own mode across startup, resume and compaction', (t) => {
  const f = fixture(t);
  run(f, 'mode.js', ['full', '--session-id', 'alpha']);
  run(f, 'session-start.js', [], { session_id: 'beta', source: 'startup' });
  run(f, 'mode.js', ['off', '--session-id', 'alpha']);
  for (const source of ['resume', 'compact', 'clear']) {
    assert.equal(run(f, 'session-start.js', [], { session_id: 'alpha', source }), '');
    assert.match(
      run(f, 'session-start.js', [], { session_id: 'beta', source }),
      /ROCKY MODE \(full\)/
    );
  }
  const state = read(f);
  assert.deepEqual(
    state.sessions.alpha.events.map((e) => e.level),
    ['full', 'off']
  );
  assert.deepEqual(
    state.sessions.beta.events.map((e) => e.level),
    ['full']
  );
  assert.equal(state.preferences.current, 'off');
});
test('missing identity never creates session history or touches another buddy', (t) => {
  const f = fixture(t);
  assert.match(run(f, 'mode.js', ['full']), /identity unavailable/);
  run(f, 'buddy-hook.js', ['prompt'], { prompt: 'fix crash' });
  assert.equal(run(f, 'session-start.js'), '');
  assert.deepEqual(read(f).sessions, {});
  assert.equal(read(f).preferences.current, 'full');
});
test('simultaneous hooks and preferences preserve every unrelated change', async (t) => {
  const f = fixture(t);
  run(f, 'mode.js', ['full', '--session-id', 'alpha']);
  run(f, 'mode.js', ['ultra', '--session-id', 'beta']);
  const jobs = [];
  for (let i = 0; i < 30; i++)
    jobs.push(
      asyncRun(f, 'buddy-hook.js', ['prompt'], { session_id: 'alpha', prompt: 'fix crash' })
    );
  for (let i = 0; i < 15; i++)
    jobs.push(
      asyncRun(f, 'buddy-hook.js', ['prompt'], { session_id: 'beta', prompt: 'explain this' })
    );
  jobs.push(
    asyncRun(f, 'buddy-hook.js', ['post-tool'], {
      session_id: 'alpha',
      tool_response: { is_error: true },
    })
  );
  jobs.push(asyncRun(f, 'buddy-speed.js', ['2'], {}));
  const outputs = await Promise.all(jobs);
  const state = read(f);
  assert.equal(state.sessions.alpha.promptsSinceReinject, 10);
  assert.equal(state.sessions.beta.promptsSinceReinject, 15);
  assert.equal(outputs.filter((o) => o.includes('reminder')).length, 1);
  assert.ok(state.sessions.alpha.buddy.lastErrorAt);
  assert.equal(state.sessions.beta.buddy.lastErrorAt, undefined);
  assert.equal(state.preferences.buddy.stepSeconds, 2);
  assert.equal(fs.existsSync(path.join(f.dir, 'state.json.lock')), false);
});
test('failed transactions release locks and atomic-write failures clean temporary files', (t) => {
  const f = fixture(t);
  const script = `const {update}=require('./scripts/lib/state'); const {atomicWrite}=require('./scripts/lib/atomic'); const fs=require('node:fs'); const path=require('node:path'); try {update(()=>{throw Error('failure')})} catch {} update(s=>({...s,current:'full'})); const destination=path.join(process.env.ERIDIAN_STATE_DIR,'destination');fs.mkdirSync(destination);try {atomicWrite(destination,{})} catch {}`;
  execFileSync(process.execPath, ['-e', script], { cwd: root, env: f.env });
  assert.equal(read(f).preferences.current, 'full');
  assert.ok(
    fs.readdirSync(f.dir).every((name) => !name.endsWith('.tmp') && !name.endsWith('.lock'))
  );
});
test('abandoned lock times out without stealing ownership or overwriting data', (t) => {
  const f = fixture(t);
  run(f, 'mode.js', ['full']);
  const before = fs.readFileSync(path.join(f.dir, 'state.json'), 'utf8');
  fs.mkdirSync(path.join(f.dir, 'state.json.lock'));
  fs.writeFileSync(path.join(f.dir, 'state.json.lock', 'owner'), '99999999');
  run(f, 'buddy-hook.js', ['prompt'], { session_id: 'alpha' });
  assert.equal(fs.readFileSync(path.join(f.dir, 'state.json'), 'utf8'), before);
  assert.equal(fs.readFileSync(path.join(f.dir, 'state.json.lock', 'owner'), 'utf8'), '99999999');
});

test('simultaneous accounting refreshes deduplicate usage and emit one milestone', async (t) => {
  const f = fixture(t);
  const transcript = path.join(f.dir, 'transcript.jsonl');
  fs.writeFileSync(
    transcript,
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-08T10:15:00Z',
      message: {
        id: 'one',
        model: 'fixture-model',
        content: [{ type: 'text', text: 'Prose.' }],
        usage: { output_tokens: 6000 },
      },
    }) + '\n'
  );
  const source = `const {sessionSavings}=require('./scripts/lib/session-savings');const f=require('./test/fixtures/session-accounting.json');console.log(JSON.stringify(sessionSavings({sessionId:'alpha',transcriptPath:process.argv[1]},f.sessions.alpha,f.factors,Date.parse('2026-07-08T11:00:00Z'))));`;
  const outputs = await Promise.all(
    Array.from(
      { length: 12 },
      () =>
        new Promise((resolve, reject) => {
          const child = spawn(process.execPath, ['-e', source, transcript], {
            cwd: root,
            env: f.env,
          });
          let output = '';
          child.stdout.on('data', (c) => (output += c));
          child.on('error', reject);
          child.on('exit', (code) =>
            code === 0 ? resolve(JSON.parse(output)) : reject(new Error(`exit ${code}`))
          );
        })
    )
  );
  assert.ok(outputs.every((o) => o.savedTokens === 6000));
  assert.equal(
    outputs.reduce((sum, o) => sum + o.crossed.length, 0),
    1
  );
});
