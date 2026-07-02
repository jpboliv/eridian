#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readState, update } = require('./lib/state');
const { buildWindows, attribute, estimateSaved, crossedMilestones } = require('./lib/stats-lib');
const { collectMessages } = require('./lib/collect-messages');

const PROJECTS_DIR =
  process.env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
const FACTORS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'eval', 'factors.json'), 'utf8')
);

const state = readState();
const windows = buildWindows(state.events, Date.now());
const { messages, sessions } = collectMessages(PROJECTS_DIR);
const totals = attribute(messages, windows);
const saved = estimateSaved(totals, FACTORS);
const oldSaved = state.cache?.savedTokens || 0;
const milestones = crossedMilestones(oldSaved, saved);

update((s) => {
  s.cache = {
    savedTokens: saved,
    messages: Object.values(totals).reduce((n, t) => n + t.messages, 0),
    updatedAt: new Date().toISOString(),
  };
  if (milestones.length) s.buddy.milestoneAt = new Date().toISOString();
  return s;
});

console.log('♫ eridian stats (all numbers estimated)\n');
console.log('level  messages  output tokens  est. saved');
for (const [level, t] of Object.entries(totals)) {
  const levelSaved = Math.round(t.tokens / (1 - FACTORS[level]) - t.tokens);
  console.log(
    `${level.padEnd(6)} ${String(t.messages).padEnd(9)} ${String(t.tokens).padEnd(14)} ~${levelSaved}`
  );
}
if (!Object.keys(totals).length) console.log('(no eridian-mode messages found yet)');
console.log(`\nlifetime est. saved: ~${saved} tokens`);
console.log(`sessions scanned: ${sessions}`);
if (milestones.length) console.log(`milestone crossed: ${milestones.join(', ')} — good good good!`);
