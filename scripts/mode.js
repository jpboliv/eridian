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
const reset = arg === 'reset';
if (reset && !id) {
  console.log('eridian reset requires a session identity; saved preference unchanged.');
  process.exit(0);
}
let target;

if (!arg) {
  target = readState(id).current === 'off' ? 'full' : 'off';
} else if (!reset) {
  target = normalizeLevel(arg);
  if (!target) {
    console.log(`unknown level "${arg}". use: lite | full | ultra | eridian | off | reset`);
    process.exit(0);
  }
}

const change = (s, store) => {
  if (reset) {
    const { resolveConfig } = require('./lib/config');
    const resolved = resolveConfig({ preference: store.preferences.current });
    target = resolved.mode;
    s.modeOverride = null;
    s.resolvedSource = resolved.source;
    s.repoRoot = resolved.repoRoot;
  } else {
    if (!arg) target = s.current === 'off' ? 'full' : 'off';
    s.modeOverride = target;
    s.resolvedSource = 'session-override';
    if (store) store.preferences.current = target;
  }
  s.current = target;
  if (id) recordActivation(s, target);
  s.promptsSinceReinject = 0;
  return s;
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
