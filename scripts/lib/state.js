const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_STATE_DIR = path.join(os.homedir(), '.claude', 'eridian');
const LEGACY_STATE_DIR = path.join(os.homedir(), '.claude', 'rocky');

const STATE_DIR = process.env.ERIDIAN_STATE_DIR || DEFAULT_STATE_DIR;
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// One-shot rename of the pre-rename state dir so savings history survives.
// Env overrides (tests) skip it so the real home dir is never touched.
function migrateLegacyStateDir(legacyDir, dir) {
  try {
    if (!fs.existsSync(dir) && fs.existsSync(legacyDir)) {
      fs.renameSync(legacyDir, dir);
    }
  } catch {
    // best effort — never block state access
  }
}

if (!process.env.ERIDIAN_STATE_DIR) {
  migrateLegacyStateDir(LEGACY_STATE_DIR, DEFAULT_STATE_DIR);
}

const DEFAULT_STATE = {
  current: 'off', events: [], cache: null, buddy: {}, buddyStyle: 'mini',
};

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return structuredClone(DEFAULT_STATE);
    }
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function writeState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

function update(fn) {
  const next = fn(readState());
  writeState(next);
  return next;
}

module.exports = {
  readState, writeState, update, migrateLegacyStateDir, STATE_DIR, STATE_FILE,
};
