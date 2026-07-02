#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readState, update } = require('./lib/state');
const { buildWindows, attribute, estimateSaved, crossedMilestones } =
  require('./lib/stats-lib');

const PROJECTS_DIR =
  process.env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
const FACTORS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'eval', 'factors.json'), 'utf8')
);

function collectMessages(dir) {
  const messages = [];
  let sessions = 0;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return { messages, sessions }; }
  for (const project of entries.filter((e) => e.isDirectory())) {
    const projectDir = path.join(dir, project.name);
    for (const file of fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'))) {
      sessions += 1;
      const lines = fs.readFileSync(path.join(projectDir, file), 'utf8').split('\n');
      const sessionMessages = [];
      let sessionStartMs = Infinity;
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const tsMs = Date.parse(obj?.timestamp);
          if (Number.isFinite(tsMs) && tsMs < sessionStartMs) sessionStartMs = tsMs;
          const tokens = obj?.message?.usage?.output_tokens;
          if (obj.type === 'assistant' && Number.isFinite(tsMs) && tokens > 0) {
            sessionMessages.push({ tsMs, outputTokens: tokens });
          }
        } catch { /* skip malformed lines */ }
      }
      for (const m of sessionMessages) {
        messages.push({ ...m, sessionStartMs });
      }
    }
  }
  return { messages, sessions };
}

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
  console.log(`${level.padEnd(6)} ${String(t.messages).padEnd(9)} ${String(t.tokens).padEnd(14)} ~${levelSaved}`);
}
if (!Object.keys(totals).length) console.log('(no eridian-mode messages found yet)');
console.log(`\nlifetime est. saved: ~${saved} tokens`);
console.log(`sessions scanned: ${sessions}`);
if (milestones.length) console.log(`milestone crossed: ${milestones.join(', ')} — good good good!`);
