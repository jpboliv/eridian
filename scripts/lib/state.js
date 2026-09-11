const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { atomicWrite, withLock } = require('./atomic');
const { ruleIdentity } = require('./persona');
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
  if (parsed.version > 2)
    throw new Error('Unsupported Eridian state schema; update the plugin before writing state');
  if (parsed.version === 2) {
    const object = (value) =>
      value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const level = (value) => (['off', 'lite', 'full', 'ultra'].includes(value) ? value : 'off');
    const preferences = object(parsed.preferences);
    const sessions = {};
    for (const [id, value] of Object.entries(object(parsed.sessions))) {
      if (!sessionId(id)) continue;
      const session = object(value);
      sessions[id] = {
        ...session,
        current: level(session.current),
        events: Array.isArray(session.events)
          ? session.events.filter(
              (event) =>
                event &&
                typeof event === 'object' &&
                Number.isFinite(Date.parse(event.ts)) &&
                ['off', 'lite', 'full', 'ultra'].includes(event.level)
            )
          : [],
        buddy: object(session.buddy),
        promptsSinceReinject:
          Number.isInteger(session.promptsSinceReinject) && session.promptsSinceReinject >= 0
            ? session.promptsSinceReinject
            : 0,
      };
    }
    return {
      ...parsed,
      preferences: {
        ...preferences,
        current: level(preferences.current),
        buddy: object(preferences.buddy),
      },
      sessions,
      legacy: {
        ...object(parsed.legacy),
        attribution: 'unknown',
        events: Array.isArray(parsed.legacy?.events) ? parsed.legacy.events : [],
      },
    };
  }
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
function updateSession(id, fn, { initialize = false, afterCommit } = {}) {
  id = sessionId(id);
  if (!id) return null;
  return withLock(STATE_FILE, () => {
    const store = readStore();
    const state = effective(store, id);
    if (initialize) recordActivation(state, state.current, false);
    const next = fn(state, store);
    store.sessions[id] = { ...next, buddy: { ...next.buddy }, updatedAt: new Date().toISOString() };
    delete store.sessions[id].buddy.stepSeconds;
    atomicWrite(STATE_FILE, store);
    const committed = effective(store, id);
    if (afterCommit) afterCommit(committed);
    return committed;
  });
}
function recordActivation(state, level, force = true) {
  const rule = ruleIdentity();
  const previous = state.events.at(-1);
  if (force || !previous || previous.level !== level || previous.rule !== rule)
    state.events.push({ ts: new Date().toISOString(), level, rule });
}
// Explicit replacement is intended for fixtures/imports. Runtime mutations use transactions.
function writeState(state) {
  withLock(STATE_FILE, () => atomicWrite(STATE_FILE, state));
}
module.exports = {
  recordActivation,
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
