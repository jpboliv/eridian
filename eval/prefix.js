#!/usr/bin/env node
const { loadInjectionBlock, normalizeLevel } = require('../scripts/lib/persona');
const level = normalizeLevel(process.argv[2]);
if (!level || level === 'off') {
  console.error('usage: node eval/prefix.js <lite|full|ultra>');
  process.exit(1);
}
process.stdout.write(loadInjectionBlock(level));
