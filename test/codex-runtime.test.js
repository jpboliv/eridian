const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const { isolateEnv } = require('./helpers/env');

const root = path.resolve(__dirname, '..');
const scripts = path.join(root, 'scripts', 'codex');

// Fixtures must not inherit the developer's Codex thread, defaults or user config.
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-runtime-'));
  const env = isolateEnv({ ...process.env });
  env.ERIDIAN_STATE_DIR = dir;
  const run = (script, args = [], input = {}, extra = {}) =>
    execFileSync(process.execPath, [path.join(scripts, script), ...args], {
      cwd: dir,
      env: { ...env, ...extra },
      input: JSON.stringify(input),
      encoding: 'utf8',
    });
  return { dir, env, run, stateFile: path.join(dir, 'codex', 'state.json') };
}

function readState(f) {
  return JSON.parse(fs.readFileSync(f.stateFile, 'utf8'));
}

test('Codex startup creates an isolated off snapshot and active startup emits canonical context', () => {
  const f = fixture();
  assert.equal(
    f.run('session-start.js', [], { session_id: 'thread-a', source: 'startup', cwd: f.dir }),
    ''
  );
  assert.equal(readState(f).sessions['thread-a'].current, 'off');
  f.run('mode.js', ['full'], {}, { CODEX_THREAD_ID: 'thread-a' });
  const out = f.run('session-start.js', [], {
    session_id: 'thread-a',
    source: 'resume',
    cwd: f.dir,
  });
  const response = JSON.parse(out);
  assert.match(response.hookSpecificOutput.additionalContext, /ROCKY MODE \(full\)/);
  assert.equal(readState(f).sessions['thread-a'].binding.source, 'resume');
});

test('Codex preserves snapshots on resume and reset resolves defaults without changing preference', () => {
  const f = fixture();
  f.run('session-start.js', [], { session_id: 'thread-a', source: 'startup', cwd: f.dir });
  f.run('mode.js', ['lite'], {}, { CODEX_THREAD_ID: 'thread-a' });
  f.run(
    'session-start.js',
    [],
    { session_id: 'thread-a', source: 'compact', cwd: f.dir },
    { ERIDIAN_DEFAULT_MODE: 'ultra' }
  );
  assert.equal(readState(f).sessions['thread-a'].current, 'lite');
  f.run('mode.js', ['reset'], {}, { CODEX_THREAD_ID: 'thread-a', ERIDIAN_DEFAULT_MODE: 'ultra' });
  const state = readState(f);
  assert.equal(state.sessions['thread-a'].current, 'ultra');
  assert.equal(state.preferences.current, 'lite');
});

test('Codex reinforcement counts active prompts, deduplicates turn IDs, and refreshes at 20', () => {
  const f = fixture();
  f.run('session-start.js', [], { session_id: 'thread-a', source: 'startup', cwd: f.dir });
  f.run('mode.js', ['full'], {}, { CODEX_THREAD_ID: 'thread-a' });
  const state = readState(f);
  state.sessions['thread-a'].promptsSinceReinject = 18;
  fs.writeFileSync(f.stateFile, JSON.stringify(state));
  assert.equal(
    f.run('prompt.js', [], {
      session_id: 'thread-a',
      turn_id: 't19',
      prompt: 'fix bug',
      cwd: f.dir,
    }),
    ''
  );
  assert.equal(
    f.run('prompt.js', [], {
      session_id: 'thread-a',
      turn_id: 't19',
      prompt: 'fix bug',
      cwd: f.dir,
    }),
    ''
  );
  const at19 = readState(f).sessions['thread-a'];
  assert.equal(at19.promptsSinceReinject, 19);
  const out = f.run('prompt.js', [], {
    session_id: 'thread-a',
    turn_id: 't20',
    prompt: 'fix bug',
    cwd: f.dir,
  });
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /ROCKY MODE \(full\)/);
  assert.equal(readState(f).sessions['thread-a'].promptsSinceReinject, 0);
  f.run('prompt.js', [], { session_id: 'thread-a', turn_id: 't21', prompt: 'fix bug', cwd: f.dir });
  assert.equal(readState(f).sessions['thread-a'].promptsSinceReinject, 1);
});

test('invalid and subagent hook input is silent and non-blocking', () => {
  const f = fixture();
  assert.equal(
    execFileSync(process.execPath, [path.join(scripts, 'prompt.js')], {
      cwd: f.dir,
      env: f.env,
      input: '{not json',
      encoding: 'utf8',
    }),
    ''
  );
  assert.equal(
    f.run('session-start.js', [], { session_id: 'thread-a', source: 'startup', subagent: true }),
    ''
  );
  assert.ok(!fs.existsSync(f.stateFile));
});

test('ERIDIAN_OFF suppresses Codex reads, writes, and injection', () => {
  const f = fixture();
  const out = execFileSync(process.execPath, [path.join(scripts, 'session-start.js')], {
    cwd: f.dir,
    env: { ...f.env, ERIDIAN_OFF: '1' },
    input: JSON.stringify({ session_id: 'thread-a', source: 'startup' }),
    encoding: 'utf8',
  });
  assert.equal(out, '');
  assert.ok(!fs.existsSync(f.stateFile));
});

test('Codex and Claude state roots stay separate, including shared override roots', () => {
  const f = fixture();
  const codex = require('../scripts/codex/store').createCodexStore({
    env: { ERIDIAN_STATE_DIR: f.dir },
    home: f.dir,
  });
  const claude = require('../scripts/lib/state-store').createStateStore({
    stateDir: path.join(f.dir, 'claude'),
  });
  assert.equal(codex.STATE_DIR, path.join(f.dir, 'codex'));
  assert.notEqual(codex.STATE_DIR, claude.STATE_DIR);
  fs.mkdirSync(path.join(f.dir, 'rocky'));
  assert.ok(!fs.existsSync(path.join(f.dir, 'codex', 'state.json')));
  codex.updateSession('same-id', (state) => state, { initialize: true });
  assert.ok(fs.existsSync(path.join(f.dir, 'codex', 'state.json')));
  assert.ok(!fs.existsSync(path.join(f.dir, 'eridian', 'state.json')));
});

test('oversized turn IDs and oversized hook input are ignored without touching state', () => {
  const f = fixture();
  f.run('session-start.js', [], { session_id: 'thread-a', source: 'startup', cwd: f.dir });
  f.run('mode.js', ['full'], {}, { CODEX_THREAD_ID: 'thread-a' });
  f.run('prompt.js', [], {
    session_id: 'thread-a',
    turn_id: 'x'.repeat(5000),
    prompt: 'hi',
    cwd: f.dir,
  });
  const session = readState(f).sessions['thread-a'];
  assert.equal(session.promptsSinceReinject, 1);
  assert.deepEqual(session.recentPromptEvents, []);
  const before = fs.readFileSync(f.stateFile, 'utf8');
  const out = execFileSync(process.execPath, [path.join(scripts, 'prompt.js')], {
    cwd: f.dir,
    env: f.env,
    input: JSON.stringify({ session_id: 'thread-a', prompt: 'y'.repeat(300 * 1024) }),
    encoding: 'utf8',
  });
  assert.equal(out, '');
  assert.equal(fs.readFileSync(f.stateFile, 'utf8'), before);
});
