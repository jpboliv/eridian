const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const { isolateEnv } = require('./helpers/env');

const scripts = path.join(__dirname, '..', 'scripts', 'codex');
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-buddy-'));
  const env = isolateEnv({ ...process.env });
  env.ERIDIAN_STATE_DIR = dir;
  const run = (script, args = [], input = {}, extra = {}) => {
    const result = spawnSync(process.execPath, [path.join(scripts, script), ...args], {
      cwd: dir,
      env: { ...env, ...extra },
      input: JSON.stringify(input),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  return {
    dir,
    run,
    state: () => JSON.parse(fs.readFileSync(path.join(dir, 'codex', 'state.json'), 'utf8')),
  };
}

test('buddy speed is queried, set, cleared and stored as a Codex-local preference', () => {
  const f = fixture();
  assert.match(f.run('buddy.js'), /every refresh \(default\)/);
  assert.match(f.run('buddy.js', ['2']), /every 2s at most/);
  assert.equal(f.state().preferences.buddy.stepSeconds, 2);
  assert.match(f.run('buddy.js'), /every 2s at most/);
  assert.match(f.run('buddy.js', ['0']), /every refresh \(default\)/);
  assert.deepEqual(f.state().preferences.buddy, {});
  assert.match(f.run('buddy.js', ['-3']), /bad value/);
});

test('buddy --render prints nothing when off and the mode segment when active', () => {
  const f = fixture();
  assert.equal(f.run('buddy.js', ['--render']), '');
  f.run('mode.js', ['full']);
  const rendered = f.run('buddy.js', ['--render']);
  assert.match(rendered, /∙ full/);
  assert.equal(rendered.split('\n').length, 3);
});

test('bound buddy renders advance frames, obey speed, and stop advancing when off', () => {
  const f = fixture();
  const identity = { CODEX_THREAD_ID: 'thread-a' };
  f.run('session-start.js', [], { session_id: 'thread-a', source: 'startup', cwd: f.dir });
  f.run('mode.js', ['full'], {}, identity);
  f.run('buddy.js', ['0']);
  const first = f.run('buddy.js', ['--render'], {}, identity);
  const second = f.run('buddy.js', ['--render'], {}, identity);
  assert.notEqual(first, second);
  assert.equal(f.state().sessions['thread-a'].buddy.frame, 2);

  f.run('buddy.js', ['3600']);
  const lastStepAt = f.state().sessions['thread-a'].buddy.lastStepAt;
  f.run('buddy.js', ['--render'], {}, identity);
  assert.equal(f.state().sessions['thread-a'].buddy.frame, 2);
  assert.equal(f.state().sessions['thread-a'].buddy.lastStepAt, lastStepAt);

  const state = f.state();
  state.sessions['thread-a'].buddy.lastStepAt = '2000-01-01T00:00:00.000Z';
  fs.writeFileSync(path.join(f.dir, 'codex', 'state.json'), JSON.stringify(state));
  f.run('buddy.js', ['--render'], {}, identity);
  assert.equal(f.state().sessions['thread-a'].buddy.frame, 3);
  f.run('buddy.js', ['0']);
  f.run('buddy.js', ['--render'], {}, identity);
  assert.equal(f.state().sessions['thread-a'].buddy.frame, 4);

  f.run('mode.js', ['off'], {}, identity);
  const before = f.state();
  assert.equal(f.run('buddy.js', ['--render'], {}, identity), '');
  assert.deepEqual(f.state(), before);
});

test('unbound buddy previews do not create sessions or modify preferences', () => {
  const f = fixture();
  f.run('mode.js', ['full']);
  const before = f.state();
  for (const identity of [{}, { CODEX_THREAD_ID: 'unbound' }]) {
    assert.match(f.run('buddy.js', ['--render'], {}, identity), /∙ full/);
    assert.deepEqual(f.state(), before);
  }
});

test('PostToolUse hook records tool and error reactions only for hook-bound sessions', () => {
  const f = fixture();
  assert.equal(
    f.run('buddy-hook.js', [], { session_id: 'thread-a', tool_response: { is_error: true } }),
    ''
  );
  assert.equal(fs.existsSync(path.join(f.dir, 'codex', 'state.json')), false);
  f.run('session-start.js', [], { session_id: 'thread-a', source: 'startup', cwd: f.dir });
  f.run('buddy-hook.js', [], { session_id: 'thread-a', tool_response: { is_error: true } });
  const buddy = f.state().sessions['thread-a'].buddy;
  assert.ok(Number.isFinite(Date.parse(buddy.lastToolAt)));
  assert.equal(buddy.lastErrorAt, buddy.lastToolAt);
  f.run('buddy-hook.js', [], { session_id: 'thread-a', tool_response: 'ok' });
  const after = f.state().sessions['thread-a'].buddy;
  assert.equal(after.lastErrorAt, buddy.lastErrorAt);
  assert.ok(Date.parse(after.lastToolAt) >= Date.parse(buddy.lastToolAt));
});
