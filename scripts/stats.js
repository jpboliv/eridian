#!/usr/bin/env node
const { readStore, commandSessionId } = require('./lib/state');
const { readCache, allCaches } = require('./lib/session-savings');
const { formatTokens } = require('./statusline');
const id = commandSessionId();
const cache = readCache(id);
const estimate = (value) =>
  value === null
    ? 'unavailable (no applicable prose calibration)'
    : `~${formatTokens(value)} tokens estimated prose output reduction`;
console.log('♫ eridian stats — output reduction estimates, not measured savings\n');
console.log(
  `this session: ${cache ? estimate(cache.savedTokens) : 'unavailable (no identified session accounting data)'}\n`
);
const caches = allCaches();
console.log('lifetime (all retained schema-2 session accounting caches):');
console.log(`sessions accounted: ${caches.length}`);
console.log(
  `observed active-mode output: ${caches.reduce((sum, c) => sum + c.outputTokens, 0)} tokens`
);
const estimates = caches.filter((c) => c.savedTokens !== null);
console.log(
  `lifetime: ${estimate(estimates.length ? estimates.reduce((sum, c) => sum + c.savedTokens, 0) : null)}`
);
console.log(`sessions without applicable calibration: ${caches.length - estimates.length}`);
if (readStore().legacy.events.length)
  console.log('legacy history: unknown session attribution; excluded from estimates');
