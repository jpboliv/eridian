#!/usr/bin/env node
const { readState, update } = require('./lib/state');

const arg = (process.argv[2] || '').trim();

function describe(stepSeconds) {
  const secs = Number(stepSeconds);
  return Number.isFinite(secs) && secs > 0
    ? `buddy steps every ${secs}s at most (host refresh permitting)`
    : 'buddy steps every refresh (default)';
}

if (!arg) {
  console.log(describe((readState().buddy || {}).stepSeconds));
  process.exit(0);
}

const secs = Number(arg);
if (!Number.isFinite(secs) || secs < 0) {
  console.log(`bad value "${arg}". use: /eridian:buddy <seconds>, 0 = every refresh`);
  process.exit(0);
}

update((s) => {
  s.buddy = s.buddy || {};
  if (secs > 0) s.buddy.stepSeconds = secs;
  else delete s.buddy.stepSeconds;
  return s;
});

console.log(`${describe(secs)}. good.`);
process.exit(0);
