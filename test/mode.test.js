const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const test = require('node:test');
const assert = require('node:assert');

const MODE = path.join(__dirname, '..', 'scripts', 'mode.js');

function run(args, stateDir) {
  return execFileSync('node', [MODE, ...args], {
    env: { ...process.env, ROCKY_STATE_DIR: stateDir },
    encoding: 'utf8',
  });
}

function freshDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rocky-mode-'));
}

test('set full prints mode and dialect block, logs event', () => {
  const dir = freshDir();
  const out = run(['full'], dir);
  assert.match(out, /rocky mode: full/);
  assert.match(out, /ROCKY MODE \(full\)/);
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  assert.strictEqual(state.current, 'full');
  assert.strictEqual(state.events.length, 1);
});

test('no arg toggles off -> full -> off', () => {
  const dir = freshDir();
  assert.match(run([], dir), /rocky mode: full/);
  assert.match(run([], dir), /rocky mode: off/);
});

test('eridian alias sets ultra', () => {
  const dir = freshDir();
  assert.match(run(['eridian'], dir), /rocky mode: ultra/);
});

test('unknown level prints usage, state unchanged', () => {
  const dir = freshDir();
  const out = run(['banana'], dir);
  assert.match(out, /unknown level/);
  assert.ok(!fs.existsSync(path.join(dir, 'state.json')));
});
