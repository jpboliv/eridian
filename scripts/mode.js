#!/usr/bin/env node
const { isOptedOut } = require('./lib/runtime');
if (isOptedOut()) {
  console.log('eridian disabled for this run (ERIDIAN_OFF=1). Saved mode unchanged.');
  process.exit(0);
}

const {
  readState,
  update,
  updateSession,
  commandSessionId,
  recordActivation,
} = require('./lib/state');
const { normalizeLevel, loadInjectionBlock } = require('./lib/persona');

const id = commandSessionId();
const arg = (process.argv[2] === '--session-id' ? '' : process.argv[2] || '').trim();
let target;

if (!arg) {
  target = readState(id).current === 'off' ? 'full' : 'off';
} else {
  target = normalizeLevel(arg);
  if (!target) {
    console.log(`unknown level "${arg}". use: lite | full | ultra | eridian | off`);
    process.exit(0);
  }
}

const change = (s, store) => {
  if (!arg) target = s.current === 'off' ? 'full' : 'off';
  if (store) store.preferences.current = target;
  s.current = target;
  if (id) recordActivation(s, target);
  s.promptsSinceReinject = 0;
  return s;
};
if (id) updateSession(id, change);
else update(change);

if (target === 'off') {
  console.log('eridian mode: off');
} else {
  console.log(`eridian mode: ${target}\n\n${loadInjectionBlock(target)}`);
}

if (!id)
  console.log('Session identity unavailable; preference saved, session accounting unavailable.');
