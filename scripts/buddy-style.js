#!/usr/bin/env node
const { readState, update } = require('./lib/state');

const STYLES = ['mini', 'tall'];
const arg = (process.argv[2] || '').trim().toLowerCase();
let target;

if (!arg) {
  target = readState().buddyStyle === 'tall' ? 'mini' : 'tall';
} else if (STYLES.includes(arg)) {
  target = arg;
} else {
  console.log(`unknown style "${arg}". use: mini | tall`);
  process.exit(0);
}

update((s) => {
  s.buddyStyle = target;
  return s;
});
console.log(`eridian buddy: ${target}`);
