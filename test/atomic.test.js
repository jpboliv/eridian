require('./helpers/env').isolateEnv();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { withLock, STALE_LOCK_MS } = require('../scripts/lib/atomic');

const atomicPath = require.resolve('../scripts/lib/atomic');

function tempFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-lock-')), 'state.json');
}

function deadPid() {
  return spawnSync(process.execPath, ['-e', '']).pid;
}

function plantLock(file, owner) {
  fs.mkdirSync(`${file}.lock`);
  fs.writeFileSync(path.join(`${file}.lock`, 'owner'), String(owner));
}

test('a lock left by a hard-killed holder is reclaimed on the next write', () => {
  const file = tempFile();
  const child = spawnSync(process.execPath, [
    '-e',
    `require(${JSON.stringify(atomicPath)}).withLock(${JSON.stringify(file)}, () => process.kill(process.pid, 'SIGKILL'))`,
  ]);
  assert.strictEqual(child.signal, 'SIGKILL');
  assert.ok(fs.existsSync(`${file}.lock`), 'the killed holder left its lock');

  assert.strictEqual(
    withLock(file, () => 'ran'),
    'ran'
  );
  assert.ok(!fs.existsSync(`${file}.lock`));
});

test('a lock whose owner process is gone is reclaimed', () => {
  const file = tempFile();
  plantLock(file, deadPid());
  assert.strictEqual(
    withLock(file, () => 'ran'),
    'ran'
  );
});

test('a lock older than the stale limit is reclaimed even with a live owner', () => {
  const file = tempFile();
  plantLock(file, process.pid);
  const old = (Date.now() - STALE_LOCK_MS - 1000) / 1000;
  fs.utimesSync(`${file}.lock`, old, old);
  assert.strictEqual(
    withLock(file, () => 'ran'),
    'ran'
  );
});

test('a fresh lock with a live owner is respected until the timeout', () => {
  const file = tempFile();
  plantLock(file, process.pid);
  assert.throws(() => withLock(file, () => 'ran'), /lock timed out/);
  assert.ok(fs.existsSync(`${file}.lock`), 'a live lock is never removed');
});
