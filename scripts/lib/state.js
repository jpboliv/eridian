const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStateStore } = require('./state-store');

const DEFAULT_STATE_DIR = path.join(os.homedir(), '.claude', 'eridian');
const STATE_DIR = process.env.ERIDIAN_STATE_DIR || DEFAULT_STATE_DIR;
const store = createStateStore({
  stateDir: STATE_DIR,
  migrateLegacyFrom: process.env.ERIDIAN_STATE_DIR
    ? null
    : path.join(os.homedir(), '.claude', 'rocky'),
});

function commandSessionId() {
  const index = process.argv.indexOf('--session-id');
  return store.sessionId(index >= 0 ? process.argv[index + 1] : process.env.CLAUDE_SESSION_ID);
}

module.exports = {
  ...store,
  commandSessionId,
  DEFAULT_STATE_DIR,
  STATE_DIR: store.STATE_DIR,
  STATE_FILE: store.STATE_FILE,
  migrateLegacyStateDir(legacyDir, dir) {
    try {
      if (!fs.existsSync(dir) && fs.existsSync(legacyDir)) fs.renameSync(legacyDir, dir);
    } catch {
      /* best effort */
    }
  },
};
