#!/usr/bin/env node
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
  return s;
});

if (target === 'off') {
  console.log('rocky mode: off');
} else {
  console.log(`rocky mode: ${target}\n\n${loadInjectionBlock(target)}`);
}
