const fs = require('node:fs');
const path = require('node:path');

const SKILL_FILE = path.join(__dirname, '..', '..', 'skills', 'speak', 'SKILL.md');

const LEVELS = ['lite', 'full', 'ultra', 'off'];
const ALIASES = { eridian: 'ultra' };

function normalizeLevel(input) {
  const key = String(input || '')
    .trim()
    .toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  return LEVELS.includes(key) ? key : null;
}

function extractInjectionBlock(markdown, level) {
  const start = `<!-- eridian:inject:${level} -->`;
  const end = `<!-- /eridian:inject:${level} -->`;
  const si = markdown.indexOf(start);
  const ei = markdown.indexOf(end);
  if (
    si === -1 ||
    ei === -1 ||
    ei < si ||
    markdown.indexOf(start, si + start.length) !== -1 ||
    markdown.indexOf(end, ei + end.length) !== -1
  )
    return null;
  return markdown.slice(si + start.length, ei).trim();
}

function composeInjectionBlock(markdown, level) {
  if (!LEVELS.includes(level) || level === 'off') return null;
  const shared = extractInjectionBlock(markdown, 'shared');
  const dialect = extractInjectionBlock(markdown, level);
  return shared && dialect ? `${shared}\n\n${dialect}` : null;
}

function loadInjectionBlock(level) {
  try {
    return composeInjectionBlock(fs.readFileSync(SKILL_FILE, 'utf8'), level);
  } catch {
    return null;
  }
}

function ruleIdentity() {
  try {
    return require('node:crypto')
      .createHash('sha256')
      .update(fs.readFileSync(SKILL_FILE))
      .digest('hex');
  } catch {
    return null;
  }
}

module.exports = {
  composeInjectionBlock,
  ruleIdentity,
  extractInjectionBlock,
  loadInjectionBlock,
  normalizeLevel,
  SKILL_FILE,
};
