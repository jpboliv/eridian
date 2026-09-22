const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const scripts = path.join(__dirname, '..', 'scripts', 'codex');
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-buddy-'));
  const env = { ...process.env };
  for (const key of ['CODEX_THREAD_ID', 'CODEX_HOME', 'ERIDIAN_DEFAULT_MODE', 'ERIDIAN_OFF'])
    delete env[key];
  env.ERIDIAN_STATE_DIR = dir;
  env.XDG_CONFIG_HOME = path.join(dir, 'xdg');
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
