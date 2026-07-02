const fs = require('node:fs');
const path = require('node:path');

const SKILL_FILE = path.join(
  __dirname, '..', '..', 'skills', 'speak', 'SKILL.md'
);

const LEVELS = ['lite', 'full', 'ultra', 'off'];
const ALIASES = { eridian: 'ultra' };

function normalizeLevel(input) {
  const key = String(input || '').trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  return LEVELS.includes(key) ? key : null;
}

function extractInjectionBlock(markdown, level) {
  const start = `<!-- rocky:inject:${level} -->`;
  const end = `<!-- /rocky:inject:${level} -->`;
  const si = markdown.indexOf(start);
  const ei = markdown.indexOf(end);
  if (si === -1 || ei === -1 || ei < si) return null;
  return markdown.slice(si + start.length, ei).trim();
}

function loadInjectionBlock(level) {
  try {
    return extractInjectionBlock(fs.readFileSync(SKILL_FILE, 'utf8'), level);
  } catch {
    return null;
  }
}

module.exports = { extractInjectionBlock, loadInjectionBlock, normalizeLevel, SKILL_FILE };
