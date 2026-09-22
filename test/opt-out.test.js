require('./helpers/env').isolateEnv();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const hooks = require('../hooks/hooks.json').hooks;

function fixture(t, current = 'full') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-opt-out-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const stateFile = path.join(dir, 'state.json');
  const state = JSON.stringify({ current, events: [], buddy: {}, promptsSinceReinject: 999 });
  fs.writeFileSync(stateFile, state);
  return { dir, stateFile, state };
}

function run(script, args, dir, off = '1', input = {}) {
  return execFileSync(process.execPath, [path.join(ROOT, script), ...args], {
    env: { ...process.env, ERIDIAN_OFF: off, ERIDIAN_STATE_DIR: dir },
    input: JSON.stringify({ session_id: 'test-session', ...input }),
    encoding: 'utf8',
  });
}

for (const level of ['lite', 'full', 'ultra', 'off']) {
  test(`opt-out silences every registered hook and preserves ${level} state`, (t) => {
    const { dir, stateFile, state } = fixture(t, level);
    for (const [event, matchers] of Object.entries(hooks)) {
      for (const matcher of matchers) {
        for (const hook of matcher.hooks) {
          const command = hook.command.replaceAll('${CLAUDE_PLUGIN_ROOT}', ROOT);
          const out = execFileSync('sh', ['-c', command], {
            env: { ...process.env, ERIDIAN_OFF: '1', ERIDIAN_STATE_DIR: dir },
            input: JSON.stringify({
              hook_event_name: event,
              source: 'startup',
              prompt: '<scheduled-task>fix the crash</scheduled-task>',
              tool_response: { is_error: true },
            }),
            encoding: 'utf8',
          });
          assert.equal(out, '', event);
          assert.equal(fs.readFileSync(stateFile, 'utf8'), state, event);
        }
      }
    }
  });
}

test('opt-out blocks every mode command without changing persisted settings', (t) => {
  for (const current of ['off', 'full']) {
    const { dir, stateFile, state } = fixture(t, current);
    for (const arg of ['', 'lite', 'full', 'ultra', 'eridian', 'off', 'unknown']) {
      const out = run('scripts/mode.js', arg ? [arg] : [], dir);
      assert.match(out, /disabled for this run \(ERIDIAN_OFF=1\)/);
      assert.doesNotMatch(out, /ROCKY MODE/);
      assert.equal(fs.readFileSync(stateFile, 'utf8'), state);
    }
  }
});

test('opted-out entry points do not create state on an unconfigured installation', (t) => {
  const { dir } = fixture(t);
  const missing = path.join(dir, 'missing');
  for (const [script, args] of [
    ['scripts/session-start.js', []],
    ['scripts/buddy-hook.js', ['prompt']],
    ['scripts/buddy-hook.js', ['post-tool']],
    ['scripts/mode.js', ['full']],
  ]) {
    run(script, args, missing);
    assert.equal(fs.existsSync(missing), false);
  }
});

test('only exact 1 opts out; scheduled-task text does not suppress reminders', (t) => {
  const { dir } = fixture(t);
  for (const off of ['', '0', 'true', '01']) {
    assert.match(run('scripts/session-start.js', [], dir, off), /ROCKY MODE/);
    run('scripts/mode.js', ['full'], dir, off);
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    state.sessions['test-session'].promptsSinceReinject = 999;
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
    assert.match(
      run('scripts/buddy-hook.js', ['prompt'], dir, off, { prompt: '<scheduled-task>' }),
      /ROCKY MODE/
    );
  }
});

test('opt-out leaves explicit evaluation prefixes available', (t) => {
  const { dir } = fixture(t);
  for (const level of ['lite', 'full', 'ultra']) {
    assert.match(run('eval/prefix.js', [level], dir), new RegExp(`ROCKY MODE \\(${level}\\)`));
  }
});
