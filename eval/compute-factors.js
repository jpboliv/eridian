#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { summarize } = require('./lib');

// Read one immutable run; report all observations without silently repricing history.
const dir = process.argv[2];
if (!dir) {
  console.error('usage: node eval/compute-factors.js <run-directory>');
  process.exit(1);
}
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const records = JSON.parse(fs.readFileSync(path.join(dir, 'records.json'), 'utf8'));
  if (records.some((r) => r.runId !== manifest.runId || r.ruleHash !== manifest.ruleHash)) {
    throw new Error('Mixed run identities or rule versions');
  }
  const summary = summarize(records);
  console.log(
    JSON.stringify(
      { runId: manifest.runId, model: manifest.model, ruleHash: manifest.ruleHash, ...summary },
      null,
      2
    )
  );
  if (!summary.repeatedCoverageComplete || summary.failed) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
