#!/usr/bin/env node
// Reads eval/results.csv, computes mean reduction per level vs baseline,
// rewrites eval/factors.json, prints a markdown table for the README.
const fs = require('node:fs');
const path = require('node:path');

const csv = fs.readFileSync(path.join(__dirname, 'results.csv'), 'utf8')
  .trim().split('\n').slice(1)
  .map((l) => {
    const [id, mode, tokens] = l.split(',');
    return { id, mode, tokens: Number(tokens) };
  })
  .filter((r) => Number.isFinite(r.tokens) && r.tokens > 0);

const byId = {};
for (const r of csv) (byId[r.id] = byId[r.id] || {})[r.mode] = r.tokens;

const reductions = { lite: [], full: [], ultra: [] };
for (const modes of Object.values(byId)) {
  if (!modes.baseline) continue;
  for (const level of ['lite', 'full', 'ultra']) {
    if (modes[level]) reductions[level].push(1 - modes[level] / modes.baseline);
  }
}

const factors = {};
console.log('| level | avg reduction | samples |');
console.log('|---|---|---|');
for (const [level, list] of Object.entries(reductions)) {
  const mean = list.reduce((a, b) => a + b, 0) / (list.length || 1);
  factors[level] = Math.round(mean * 100) / 100;
  console.log(`| ${level} | ${(mean * 100).toFixed(0)}% | ${list.length} |`);
}

fs.writeFileSync(
  path.join(__dirname, 'factors.json'),
  JSON.stringify({ _note: 'measured by eval/run.sh', ...factors }, null, 2)
);
console.log('\neval/factors.json updated.');
