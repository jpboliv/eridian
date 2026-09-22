#!/usr/bin/env node
const { isOptedOut } = require('../lib/runtime');

if (isOptedOut()) {
  console.log('eridian disabled for this run (ERIDIAN_OFF=1). Saved mode unchanged.');
  process.exit(0);
}

const fs = require('node:fs');
const { loadInjectionBlock, normalizeLevel } = require('../lib/persona');
const { transition } = require('../lib/mode-service');
const { commandIdentity } = require('./input');
const { createCodexStore } = require('./store');

function emit(target, prefix = 'eridian mode') {
  const block = target === 'off' ? null : loadInjectionBlock(target);
  const text = target === 'off' ? `${prefix}: off\n` : `${prefix}: ${target}\n\n${block || ''}\n`;
  fs.writeSync(1, text);
}

const arg = (process.argv[2] === '--session-id' ? '' : process.argv[2] || '').trim();
const identity = commandIdentity();
if (!identity.ok) {
  console.error(`eridian mode failed: ${identity.reason}`);
  process.exit(1);
}
if (arg === 'reset' && !identity.id) {
  console.log('eridian reset requires a verified session identity; saved preference unchanged.');
  process.exit(0);
}

try {
  const store = createCodexStore();
  if (arg === 'status') {
    const raw = store.readStore();
    const session = identity.id ? raw.sessions[identity.id] : null;
    const state = identity.id
      ? store.readState(identity.id, { cwd: process.cwd() })
      : store.readState();
    console.log(
      `eridian status — host: codex; current: ${state.current}; saved preference: ${raw.preferences.current}`
    );
    console.log(
      `session: ${identity.id || 'unavailable'}; binding: ${session?.binding?.id === identity.id ? 'verified by hook' : 'unavailable'}`
    );
    console.log(
      `last observed hook: ${raw.lastHook ? `${raw.lastHook.event}${raw.lastHook.source ? ` (${raw.lastHook.source})` : ''}` : 'none'}; trust: host-managed, not asserted by Eridian`
    );
    process.exit(0);
  }
  const raw = store.readStore();
  const hasBoundSession = Boolean(
    identity.id && raw.sessions[identity.id]?.binding?.id === identity.id
  );
  if (arg === 'reset' && !hasBoundSession) {
    console.log(
      'eridian reset requires a session initialized by a trusted Codex hook; saved preference unchanged.'
    );
    process.exit(0);
  }
  let target;
  if (arg && arg !== 'reset') {
    target = normalizeLevel(arg);
    if (!target) {
      console.log(`unknown level "${arg}". use: lite | full | ultra | eridian | off | reset`);
      process.exit(0);
    }
  }
  const change = (current, currentStore) =>
    transition(current, currentStore, arg, {
      cwd: process.cwd(),
      recordActivation: store.recordActivation,
    });
  if (hasBoundSession) {
    store.updateSession(
      identity.id,
      (current, currentStore) => {
        const result = change(current, currentStore);
        if (!result.ok) throw new Error(result.error);
        target = result.target;
        current.host = 'codex';
        current.binding = { ...current.binding, id: identity.id };
        return current;
      },
      { cwd: process.cwd(), afterCommit: (committed) => emit(committed.current) }
    );
  } else {
    store.update((current, currentStore) => {
      const result = change(current, currentStore);
      if (!result.ok) throw new Error(result.error);
      target = result.target;
      return result.state;
    });
    emit(target, identity.id ? 'eridian preference (session unavailable)' : 'eridian preference');
    console.log('Session binding unavailable; preference saved, session tracking unavailable.');
  }
} catch (error) {
  console.error(`eridian mode failed: ${error.message}`);
  process.exit(1);
}
