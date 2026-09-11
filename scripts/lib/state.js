const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { atomicWrite, withLock } = require('./atomic');
const DEFAULT_STATE_DIR = path.join(os.homedir(), '.claude', 'eridian');
const STATE_DIR = process.env.ERIDIAN_STATE_DIR || DEFAULT_STATE_DIR;
const STATE_FILE = path.join(STATE_DIR, 'state.json');
function migrateLegacyStateDir(legacyDir, dir) {
  try {
    if (!fs.existsSync(dir) && fs.existsSync(legacyDir)) fs.renameSync(legacyDir, dir);
  } catch {
    /* best effort */
  }
}
if (!process.env.ERIDIAN_STATE_DIR)
  migrateLegacyStateDir(path.join(os.homedir(), '.claude', 'rocky'), DEFAULT_STATE_DIR);
function sessionId(value = process.env.CLAUDE_SESSION_ID) {
  return typeof value === 'string' &&
    /^[a-zA-Z0-9][\w.-]{0,199}$/.test(value) &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
    ? value
    : null;
}
function commandSessionId() {
  const index = process.argv.indexOf('--session-id');
  return sessionId(index >= 0 ? process.argv[index + 1] : undefined);
}
function readStore() {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    /* default */
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
  if (parsed.version === 2) return parsed;
  return {
    version: 2,
    preferences: {
      current: parsed.current || 'off',
      buddy: Number.isFinite(parsed.buddy?.stepSeconds)
        ? { stepSeconds: parsed.buddy.stepSeconds }
        : {},
    },
    sessions: {},
    legacy: { attribution: 'unknown', events: parsed.events || [] },
  };
}
function effective(store, id) {
  const session = id && Object.hasOwn(store.sessions, id) ? store.sessions[id] : null;
  return session
    ? { ...session, buddy: { ...session.buddy, ...store.preferences.buddy } }
    : {
        current: store.preferences.current,
        events: [],
        buddy: { ...store.preferences.buddy },
        promptsSinceReinject: 0,
      };
}
function readState(id) {
  return effective(readStore(), sessionId(id || null));
}
function update(fn) {
  return withLock(STATE_FILE, () => {
    const store = readStore();
    const next = fn(effective(store, null));
    store.preferences = {
      ...store.preferences,
      current: next.current,
      buddy: next.buddy?.stepSeconds === undefined ? {} : { stepSeconds: next.buddy.stepSeconds },
    };
    atomicWrite(STATE_FILE, store);
    return next;
  });
}
function updateSession(id, fn, { initialize = false } = {}) {
  id = sessionId(id);
  if (!id) return null;
  return withLock(STATE_FILE, () => {
    const store = readStore();
    const state = effective(store, id);
    if (!state.events.length && initialize)
      state.events.push({ ts: new Date().toISOString(), level: state.current });
    const next = fn(state, store);
    store.sessions[id] = { ...next, buddy: { ...next.buddy }, updatedAt: new Date().toISOString() };
    delete store.sessions[id].buddy.stepSeconds;
    atomicWrite(STATE_FILE, store);
    return effective(store, id);
  });
}
// Explicit replacement is intended for fixtures/imports. Runtime mutations use transactions.
function writeState(state) {
  withLock(STATE_FILE, () => atomicWrite(STATE_FILE, state));
}
module.exports = {
  readState,
  readStore,
  writeState,
  update,
  updateSession,
  sessionId,
  commandSessionId,
  migrateLegacyStateDir,
  STATE_DIR,
  STATE_FILE,
};
