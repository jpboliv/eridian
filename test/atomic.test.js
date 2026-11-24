require('./helpers/env').isolateEnv();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const { spawn, spawnSync } = require('node:child_process');
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

// Workers contend for one lock while planters leave dead-owner locks whenever it
// is free, as killed holders would; any overlap inside the critical section fails.
test('reclaiming dead-owner locks never admits two holders at once', async () => {
  const file = tempFile();
  const inside = `${file}.inside`;
  const dead = deadPid();
  const worker = `
    const fs = require('node:fs');
    const { withLock } = require(${JSON.stringify(atomicPath)});
    const until = Date.now() + 3000;
    let overlaps = 0;
    let entries = 0;
    while (Date.now() < until) {
      try {
        withLock(${JSON.stringify(file)}, () => {
          entries++;
          try { fs.mkdirSync(${JSON.stringify(inside)}); } catch { overlaps++; return; }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
          fs.rmdirSync(${JSON.stringify(inside)});
        });
      } catch (error) {
        if (!/lock timed out/.test(error.message)) throw error;
      }
    }
    process.stdout.write(JSON.stringify({ overlaps, entries }));`;
  const planter = `
    const fs = require('node:fs');
    const lock = ${JSON.stringify(`${file}.lock`)};
    const until = Date.now() + 3000;
    while (Date.now() < until) {
      try { fs.mkdirSync(lock); fs.writeFileSync(lock + '/owner', '${dead}'); } catch {}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
    }`;
  const run = (code) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, ['-e', code]);
      let out = '';
      let err = '';
      child.stdout.on('data', (chunk) => (out += chunk));
      child.stderr.on('data', (chunk) => (err += chunk));
      child.on('close', (code) => resolve({ code, out, err }));
    });
  const [workers] = await Promise.all([
    Promise.all(Array.from({ length: 12 }, () => run(worker))),
    Promise.all(Array.from({ length: 3 }, () => run(planter))),
  ]);
  for (const { code, out, err } of workers) {
    assert.strictEqual(code, 0, `a worker crashed: ${err}`);
    const { overlaps, entries } = JSON.parse(out);
    assert.ok(entries > 0, 'a worker never got the lock');
    assert.strictEqual(overlaps, 0, 'two holders were inside at once');
  }
});

test(
  'a stale lock that cannot be reclaimed times out instead of spinning',
  { skip: process.getuid?.() === 0 },
  () => {
    const file = tempFile();
    plantLock(file, deadPid());
    fs.chmodSync(path.dirname(file), 0o555);
    try {
      const child = spawnSync(
        process.execPath,
        [
          '-e',
          `require(${JSON.stringify(atomicPath)}).withLock(${JSON.stringify(file)}, () => {})`,
        ],
        { timeout: 10000 }
      );
      assert.strictEqual(child.signal, null, 'withLock spun past its deadline');
      assert.match(String(child.stderr), /lock timed out/);
    } finally {
      fs.chmodSync(path.dirname(file), 0o755);
    }
  }
);

test('a holder whose lock was reclaimed leaves the next holder its lock', () => {
  const file = tempFile();
  const lock = `${file}.lock`;
  withLock(file, () => {
    fs.rmSync(lock, { recursive: true });
    plantLock(file, process.pid);
  });
  assert.ok(fs.existsSync(lock), "the next holder's lock was deleted");
});
