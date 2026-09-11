#!/usr/bin/env node
const { isOptedOut } = require('./lib/runtime');
if (isOptedOut()) {
  console.log('eridian disabled for this run (ERIDIAN_OFF=1). Saved mode unchanged.');
  process.exit(0);
}

const { readState, update } = require('./lib/state');
const { normalizeLevel, loadInjectionBlock } = require('./lib/persona');

const arg = (process.argv[2] || '').trim();
let target;

if (!arg) {
  target = readState().current === 'off' ? 'full' : 'off';
} else {
  target = normalizeLevel(arg);
  if (!target) {
    console.log(`unknown level "${arg}". use: lite | full | ultra | eridian | off`);
    process.exit(0);
  }
}

update((s) => {
  s.current = target;
  s.events.push({ ts: new Date().toISOString(), level: target });
  s.promptsSinceReinject = 0;
  return s;
});

if (target === 'off') {
  console.log('eridian mode: off');
} else {
  console.log(`eridian mode: ${target}\n\n${loadInjectionBlock(target)}`);
}
