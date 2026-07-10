const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const test = require('node:test');
const assert = require('node:assert');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'buddy-speed.js');

function run(args, stateDir) {
  return execFileSync('node', [SCRIPT, ...args], {
    env: { ...process.env, ERIDIAN_STATE_DIR: stateDir },
    encoding: 'utf8',
  });
}

function freshDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-buddy-speed-'));
}

function readBuddy(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).buddy;
}

test('sets stepSeconds', () => {
  const dir = freshDir();
  const out = run(['2'], dir);
  assert.match(out, /every 2s/);
  assert.strictEqual(readBuddy(dir).stepSeconds, 2);
});

test('accepts fractional seconds', () => {
  const dir = freshDir();
  run(['0.5'], dir);
  assert.strictEqual(readBuddy(dir).stepSeconds, 0.5);
});

test('0 removes the setting', () => {
  const dir = freshDir();
  run(['2'], dir);
  const out = run(['0'], dir);
  assert.match(out, /every refresh/);
  assert.ok(!('stepSeconds' in readBuddy(dir)));
});

test('no arg prints current setting', () => {
  const dir = freshDir();
  assert.match(run([], dir), /every refresh/);
  run(['3'], dir);
  assert.match(run([], dir), /every 3s/);
});

test('rejects garbage and negatives, state untouched', () => {
  const dir = freshDir();
  assert.match(run(['fast'], dir), /bad value/);
  assert.match(run(['-1'], dir), /bad value/);
  assert.ok(!fs.existsSync(path.join(dir, 'state.json')));
});

test('preserves other buddy fields', () => {
  const dir = freshDir();
  fs.writeFileSync(
    path.join(dir, 'state.json'),
    JSON.stringify({ current: 'full', events: [], buddy: { frame: 7 } })
  );
  run(['2'], dir);
  const buddy = readBuddy(dir);
  assert.strictEqual(buddy.frame, 7);
  assert.strictEqual(buddy.stepSeconds, 2);
});
