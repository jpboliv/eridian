const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..');

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-defaults-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repos = ['a', 'b'].map((name) => path.join(dir, name));
  for (const repo of repos) fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const env = {
    ...process.env,
    ERIDIAN_STATE_DIR: path.join(dir, 'state'),
    XDG_CONFIG_HOME: path.join(dir, 'config'),
  };
  delete env.ERIDIAN_OFF;
  delete env.ERIDIAN_DEFAULT_MODE;
  delete env.CLAUDE_SESSION_ID;
  const run = (script, id, cwd, args = [], extra = {}) =>
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd,
      env: { ...env, ...extra, ...(id ? { CLAUDE_SESSION_ID: id } : {}) },
      input: JSON.stringify({ session_id: id, cwd, source: 'resume', prompt: 'check' }),
      encoding: 'utf8',
    });
  const store = () => JSON.parse(fs.readFileSync(path.join(dir, 'state/state.json')));
  const config = (repo, defaultMode) =>
    fs.writeFileSync(path.join(repo, '.eridian.json'), JSON.stringify({ defaultMode }));
  return { dir, repos, run, store, config };
}

test('concurrent repos snapshot their own defaults; overrides do not rewrite another history', (t) => {
  const {
    repos: [a, b],
    run,
    store,
    config,
  } = fixture(t);
  config(a, 'lite');
  config(b, 'ultra');
  assert.match(run('session-start.js', 'session-a', a), /ROCKY MODE \(lite\)/i);
  assert.match(run('session-start.js', 'session-b', b), /ROCKY MODE \(ultra\)/i);
  const priorB = store().sessions['session-b'];
  run('mode.js', 'session-a', a, ['off']);
  assert.equal(store().sessions['session-a'].modeOverride, 'off');
  assert.deepEqual(store().sessions['session-b'], priorB);
  assert.equal(store().preferences.current, 'off');
  config(a, 'full');
  assert.equal(run('session-start.js', 'session-a', a), '');
  assert.equal(store().sessions['session-a'].current, 'off');
  run('mode.js', 'session-a', a, ['reset']);
  assert.equal(store().sessions['session-a'].current, 'full');
  assert.equal(store().sessions['session-a'].modeOverride, null);
  assert.equal(store().preferences.current, 'off');
  assert.equal(store().sessions['session-a'].promptsSinceReinject, 0);
  assert.ok(store().sessions['session-a'].events.at(-1).rule);
});

test('resume keeps defaults snapshot while reset and new sessions see changed repo defaults', (t) => {
  const {
    repos: [a],
    run,
    store,
    config,
  } = fixture(t);
  config(a, 'lite');
  run('session-start.js', 'old', a);
  config(a, 'ultra');
  run('session-start.js', 'old', a);
  assert.equal(store().sessions.old.current, 'lite');
  run('session-start.js', 'new', a);
  assert.equal(store().sessions.new.current, 'ultra');
  run('mode.js', 'old', a, ['reset']);
  assert.equal(store().sessions.old.current, 'ultra');
  run('mode.js', 'old', a, ['off']);
  run('mode.js', 'old', a);
  assert.equal(store().sessions.old.current, 'full');
  assert.equal(store().preferences.current, 'full');
});

test('hooks and statusline use shared snapshot and opt-out does not mutate it', (t) => {
  const {
    repos: [a],
    run,
    store,
    config,
  } = fixture(t);
  config(a, 'lite');
  run('session-start.js', 'one', a);
  config(a, 'off');
  run('buddy-hook.js', 'one', a, ['prompt']);
  assert.match(run('statusline.js', 'one', a), /lite/);
  const before = store();
  assert.equal(run('session-start.js', 'one', a, [], { ERIDIAN_OFF: '1' }), '');
  assert.equal(run('statusline.js', 'one', a, [], { ERIDIAN_OFF: '1' }), '');
  assert.match(run('mode.js', 'one', a, ['reset'], { ERIDIAN_OFF: '1' }), /disabled/);
  assert.deepEqual(store(), before);
  assert.match(run('mode.js', null, a, ['reset']), /requires a session identity/);
});
