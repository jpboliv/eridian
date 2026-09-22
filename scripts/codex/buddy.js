#!/usr/bin/env node
const { isOptedOut } = require('../lib/runtime');

if (isOptedOut()) {
  console.log('eridian disabled for this run (ERIDIAN_OFF=1). Buddy preference unchanged.');
  process.exit(0);
}

const { readState, update } = (() => {
  const { createCodexStore } = require('./store');
  return createCodexStore();
})();
const { commandIdentity } = require('./input');
const { renderLines } = require('../statusline');
const arg = (process.argv[2] || '').trim();
const identity = commandIdentity();

function describe(stepSeconds) {
  const secs = Number(stepSeconds);
  return Number.isFinite(secs) && secs > 0
    ? `buddy steps every ${secs}s at most (Codex refresh permitting)`
    : 'buddy steps every refresh (default)';
}

if (!identity.ok) {
  console.log(`bad value: ${identity.reason}`);
  process.exit(0);
}
if (arg === '--render') {
  const state = readState(identity.id, { cwd: process.cwd() });
  if (!state.current || state.current === 'off') process.exit(0);
  process.stdout.write(renderLines(state, Date.now(), null).join('\n'));
  process.exit(0);
}
if (!arg) {
  console.log(describe(readState(identity.id, { cwd: process.cwd() }).buddy?.stepSeconds));
  process.exit(0);
}
const secs = Number(arg);
if (!Number.isFinite(secs) || secs < 0) {
  console.log(`bad value "${arg}". use: <seconds>, 0 = every refresh`);
  process.exit(0);
}
update((state) => {
  state.buddy = state.buddy || {};
  if (secs > 0) state.buddy.stepSeconds = secs;
  else delete state.buddy.stepSeconds;
  return state;
});
console.log(`${describe(secs)}. good.`);
