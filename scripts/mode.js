#!/usr/bin/env node
const { isOptedOut } = require('./lib/runtime');
if (isOptedOut()) {
  console.log('eridian disabled for this run (ERIDIAN_OFF=1). Saved mode unchanged.');
  process.exit(0);
}

const { update, updateSession, commandSessionId, recordActivation } = require('./lib/state');
const { normalizeLevel, loadInjectionBlock } = require('./lib/persona');
const { transition } = require('./lib/mode-service');

const id = commandSessionId();
const arg = (process.argv[2] === '--session-id' ? '' : process.argv[2] || '').trim();
if (arg === 'reset' && !id) {
  console.log('eridian reset requires a session identity; saved preference unchanged.');
  process.exit(0);
}
if (arg && arg !== 'reset' && !normalizeLevel(arg)) {
  console.log(`unknown level "${arg}". use: lite | full | ultra | eridian | off | reset`);
  process.exit(0);
}

let target;
// Shared with the Codex adapter; activation history is only recorded for a known session.
const change = (state, store) => {
  const result = transition(state, store, arg, { recordActivation: id ? recordActivation : null });
  if (!result.ok) throw new Error(result.error);
  target = result.target;
  return result.state;
};
const emit = () => {
  require('node:fs').writeSync(
    1,
    target === 'off'
      ? 'eridian mode: off\n'
      : `eridian mode: ${target}\n\n${loadInjectionBlock(target)}\n`
  );
};
if (id) updateSession(id, change, { afterCommit: emit });
else {
  update(change);
  emit();
}

if (!id)
  console.log('Session identity unavailable; preference saved, session accounting unavailable.');
