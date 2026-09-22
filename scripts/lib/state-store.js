const fs = require('node:fs');
const path = require('node:path');
const { atomicWrite, withLock } = require('./atomic');
const { ruleIdentity } = require('./persona');
const { resolveConfig: defaultResolveConfig, MODES } = require('./config');

const VERSION = 2;
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

function sessionId(value) {
  return typeof value === 'string' &&
    /^[a-zA-Z0-9][\w.-]{0,199}$/.test(value) &&
    !RESERVED_IDS.has(value)
    ? value
    : null;
}

function createStateStore({
  stateDir,
  migrateLegacyFrom = null,
  resolveConfig = defaultResolveConfig,
  configOptions = {},
} = {}) {
  if (typeof stateDir !== 'string' || !stateDir) throw new TypeError('stateDir is required');
  const dir = path.resolve(stateDir);
  const stateFile = path.join(dir, 'state.json');

  if (migrateLegacyFrom) {
    try {
      if (!fs.existsSync(dir) && fs.existsSync(migrateLegacyFrom))
        fs.renameSync(migrateLegacyFrom, dir);
    } catch {
      /* best effort */
    }
  }

  const object = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const level = (value) => (MODES.includes(value) ? value : 'off');

  function readStore() {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      /* default */
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
    if (parsed.version > VERSION)
      throw new Error('Unsupported Eridian state schema; update the plugin before writing state');
    if (parsed.version === VERSION) {
      const preferences = object(parsed.preferences);
      const sessions = {};
      for (const [id, value] of Object.entries(object(parsed.sessions))) {
        if (!sessionId(id)) continue;
        const session = object(value);
        sessions[id] = {
          ...session,
          current: level(session.current),
          modeOverride: MODES.includes(session.modeOverride) ? session.modeOverride : null,
          events: Array.isArray(session.events)
            ? session.events.filter(
                (event) =>
                  event &&
                  typeof event === 'object' &&
                  Number.isFinite(Date.parse(event.ts)) &&
                  MODES.includes(event.level)
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
      version: VERSION,
      preferences: {
        current: level(parsed.current),
        buddy: Number.isFinite(parsed.buddy?.stepSeconds)
          ? { stepSeconds: parsed.buddy.stepSeconds }
          : {},
      },
      sessions: {},
      legacy: { attribution: 'unknown', events: Array.isArray(parsed.events) ? parsed.events : [] },
    };
  }

  function effective(store, id, cwd) {
    const session = id && Object.hasOwn(store.sessions, id) ? store.sessions[id] : null;
    const defaults =
      !session && id
        ? resolveConfig({ cwd, preference: store.preferences.current, ...configOptions })
        : null;
    return session
      ? { ...session, buddy: { ...session.buddy, ...store.preferences.buddy } }
      : {
          current: defaults ? defaults.mode : store.preferences.current,
          ...(defaults
            ? { modeOverride: null, resolvedSource: defaults.source, repoRoot: defaults.repoRoot }
            : {}),
          events: [],
          buddy: { ...store.preferences.buddy },
          promptsSinceReinject: 0,
        };
  }

  function readState(id, { cwd } = {}) {
    return effective(readStore(), sessionId(id || null), cwd);
  }

  function update(fn) {
    return withLock(stateFile, () => {
      const store = readStore();
      const next = fn(effective(store, null), store);
      store.preferences = {
        ...store.preferences,
        current: next.current,
        buddy: next.buddy?.stepSeconds === undefined ? {} : { stepSeconds: next.buddy.stepSeconds },
      };
      atomicWrite(stateFile, store);
      return next;
    });
  }

  function updateSession(id, fn, { initialize = false, cwd, afterCommit } = {}) {
    id = sessionId(id);
    if (!id) return null;
    return withLock(stateFile, () => {
      const store = readStore();
      const state = effective(store, id, cwd);
      if (initialize) recordActivation(state, state.current, false);
      const next = fn(state, store);
      store.sessions[id] = {
        ...next,
        buddy: { ...next.buddy },
        updatedAt: new Date().toISOString(),
      };
      delete store.sessions[id].buddy.stepSeconds;
      atomicWrite(stateFile, store);
      const committed = effective(store, id);
      if (afterCommit) afterCommit(committed);
      return committed;
    });
  }

  function writeState(state) {
    withLock(stateFile, () => atomicWrite(stateFile, state));
  }

  return {
    STATE_DIR: dir,
    STATE_FILE: stateFile,
    readStore,
    readState,
    update,
    updateSession,
    writeState,
    sessionId,
    recordActivation,
  };
}

function recordActivation(state, level, force = true) {
  const rule = ruleIdentity();
  const previous = state.events.at(-1);
  if (force || !previous || previous.level !== level || previous.rule !== rule)
    state.events.push({ ts: new Date().toISOString(), level, rule });
}

module.exports = { createStateStore, recordActivation, sessionId, VERSION };
