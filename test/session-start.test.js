const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const test = require('node:test');
const assert = require('node:assert');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'session-start.js');

function run(stateDir) {
  return execFileSync('node', [SCRIPT], {
    env: { ...process.env, ROCKY_STATE_DIR: stateDir },
    encoding: 'utf8',
  });
}

test('emits additionalContext when mode active', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rocky-ss-'));
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    current: 'ultra', events: [], cache: null, buddy: {},
  }));
  const out = JSON.parse(run(dir));
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /ROCKY MODE \(ultra\)/);
});

test('prints nothing when off', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rocky-ss-'));
  assert.strictEqual(run(dir), '');
});
