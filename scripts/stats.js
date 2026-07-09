#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readState } = require('./lib/state');
const { buildWindows, attribute, estimateSaved } = require('./lib/stats-lib');
const { collectMessages } = require('./lib/collect-messages');
const { latestSessionSaved } = require('./lib/session-savings');
const { formatTokens } = require('./statusline');

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

console.log('♫ eridian stats (all numbers estimated)\n');

const sessionSaved = latestSessionSaved();
if (sessionSaved === null) {
  console.log('this session: (no data)\n');
} else {
  console.log(`this session: ~${formatTokens(sessionSaved)} saved (${state.current})\n`);
}

console.log('lifetime (all sessions):');
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
