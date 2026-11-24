const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

// A holder that is hard-killed (SIGKILL, host timeout) never runs its finally,
// so its lock outlives it. The longest holder parses a session transcript, so
// hold time grows with transcript size; one held past this is judged dead.
const STALE_LOCK_MS = 30000;

function ownerAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readOwner(lock) {
  try {
    return fs.readFileSync(path.join(lock, 'owner'), 'utf8');
  } catch {
    return null;
  }
}

// Stale when the owner process is gone, or when the lock is too old to belong
// to a live holder (covers a dead owner's PID being reused).
function isStale(lock, stat) {
  if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) return true;
  const owner = readOwner(lock);
  if (owner === null) return false; // owner not written yet: a holder is mid-acquire
  const pid = Number.parseInt(owner, 10);
  return Number.isInteger(pid) && pid > 0 && !ownerAlive(pid);
}

// Reclaimers queue behind a second lock and re-check staleness inside it. A dead
// owner never releases its lock, so it cannot change between that check and the
// rename; only a live holder already past STALE_LOCK_MS can still race it.
function reclaim(lock) {
  const guard = `${lock}.reclaim`;
  try {
    fs.mkdirSync(guard);
  } catch (error) {
    // A reclaimer killed inside the guard would otherwise block reclaiming for good.
    try {
      if (error.code === 'EEXIST' && Date.now() - fs.statSync(guard).mtimeMs > STALE_LOCK_MS)
        fs.rmdirSync(guard);
    } catch {
      /* another waiter removed it */
    }
    return false;
  }
  try {
    if (!isStale(lock, fs.statSync(lock))) return false;
    const aside = `${lock}.${randomUUID()}.stale`;
    fs.renameSync(lock, aside);
    fs.rmSync(aside, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(guard, { recursive: true, force: true });
  }
}

function withLock(file, fn) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const owner = `${process.pid} ${randomUUID()}`;
  const deadline = Date.now() + 3000;
  while (true) {
    try {
      fs.mkdirSync(lock);
      try {
        fs.writeFileSync(path.join(lock, 'owner'), owner);
      } catch (error) {
        fs.rmSync(lock, { recursive: true, force: true });
        throw error;
      }
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let stat;
      try {
        stat = fs.statSync(lock);
      } catch {
        continue; // released between mkdir and stat
      }
      if (isStale(lock, stat) && reclaim(lock)) continue;
      if (Date.now() >= deadline)
        throw new Error('Eridian state lock timed out; inspect the lock owner before recovery', {
          cause: error,
        });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    return fn();
  } finally {
    // A holder judged stale may have lost its lock to the next one; leave that one alone.
    if (readOwner(lock) === owner) fs.rmSync(lock, { recursive: true, force: true });
  }
}
module.exports = { atomicWrite, withLock, STALE_LOCK_MS };
