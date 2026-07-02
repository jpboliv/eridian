const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATE_DIR =
  process.env.ROCKY_STATE_DIR || path.join(os.homedir(), '.claude', 'rocky');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

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

module.exports = { readState, writeState, update, STATE_DIR, STATE_FILE };
