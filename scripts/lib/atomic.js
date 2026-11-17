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
// so its lock outlives it. Every holder finishes in well under this.
const STALE_LOCK_MS = 30000;

function ownerAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// Stale when the owner process is gone, or when the lock is too old to belong
// to a live holder (covers a dead owner's PID being reused).
function isStale(lock, stat) {
  if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) return true;
  let pid;
  try {
    pid = Number.parseInt(fs.readFileSync(path.join(lock, 'owner'), 'utf8'), 10);
  } catch {
    return false; // owner not written yet: a holder is mid-acquire
  }
  return Number.isInteger(pid) && pid > 0 && !ownerAlive(pid);
}

// Move the stale lock aside before deleting it, so a lock another process
// acquired in the meantime is put back rather than deleted.
function reclaim(lock, stat) {
  const aside = `${lock}.${randomUUID()}.stale`;
  try {
    fs.renameSync(lock, aside);
  } catch {
    return;
  }
  try {
    if (fs.statSync(aside).ino !== stat.ino) fs.renameSync(aside, lock);
  } catch {
    /* put-back lost the race; its holder already left */
  }
  fs.rmSync(aside, { recursive: true, force: true });
}

function withLock(file, fn) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const deadline = Date.now() + 3000;
  while (true) {
    try {
      fs.mkdirSync(lock);
      try {
        fs.writeFileSync(path.join(lock, 'owner'), String(process.pid));
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
      if (isStale(lock, stat)) {
        reclaim(lock, stat);
        continue;
      }
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
    fs.rmSync(lock, { recursive: true, force: true });
  }
}
module.exports = { atomicWrite, withLock, STALE_LOCK_MS };
