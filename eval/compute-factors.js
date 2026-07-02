#!/usr/bin/env node
// Reads eval/results.csv. Computes mean output-token reduction per level
// vs baseline (rewrites eval/factors.json — feeds the statusline estimate)
// and vs the terse control arm (README only), printing a table for each.
const fs = require('node:fs');
const path = require('node:path');

const rows = fs.readFileSync(path.join(__dirname, 'results.csv'), 'utf8')
  .trim().split('\n').slice(1)
  .map((l) => {
    const [id, mode, tokens] = l.split(',');
    return { id, mode, tokens: Number(tokens) };
  })
  .filter((r) => Number.isFinite(r.tokens) && r.tokens > 0);

const byId = {};
for (const r of rows) (byId[r.id] = byId[r.id] || {})[r.mode] = r.tokens;

const LEVELS = ['lite', 'full', 'ultra'];

function meanReductions(reference) {
  const reductions = { lite: [], full: [], ultra: [] };
  for (const modes of Object.values(byId)) {
    if (!modes[reference]) continue;
    for (const level of LEVELS) {
      if (modes[level]) reductions[level].push(1 - modes[level] / modes[reference]);
    }
  }
  return reductions;
}

function printTable(reductions) {
  const means = {};
  console.log('| level | avg reduction | samples |');
  console.log('|---|---|---|');
  for (const [level, list] of Object.entries(reductions)) {
    const mean = list.reduce((a, b) => a + b, 0) / (list.length || 1);
    means[level] = Math.round(mean * 100) / 100;
    console.log(`| ${level} | ${(mean * 100).toFixed(0)}% | ${list.length} |`);
  }
  return means;
}

console.log('vs baseline (default Claude — written to eval/factors.json):\n');
const factors = printTable(meanReductions('baseline'));
fs.writeFileSync(
  path.join(__dirname, 'factors.json'),
  JSON.stringify({ _note: 'measured by eval/run.sh', ...factors }, null, 2)
);
console.log('\neval/factors.json updated.');

const vsTerse = meanReductions('terse');
if (Object.values(vsTerse).some((list) => list.length)) {
  console.log('\nvs terse control ("Answer concisely." — README only):\n');
  printTable(vsTerse);
} else {
  console.log('\nno terse cells in results.csv — for the vs-terse table run: bash eval/run.sh terse');
}
