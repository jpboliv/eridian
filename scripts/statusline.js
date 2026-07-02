#!/usr/bin/env node
const { renderBuddy } = require('./lib/buddy');

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function renderLine(state, nowMs) {
  if (!state.current || state.current === 'off') return '';
  const { art, quip } = renderBuddy(state.buddy || {}, nowMs);
  const parts = [`♫ ${art}`];
  if (quip) parts.push(quip);
  parts.push(`· ${state.current}`);
  if (state.cache && typeof state.cache.savedTokens === 'number') {
    parts.push(`· ~${formatTokens(state.cache.savedTokens)} saved`);
  }
  return parts.join('  ');
}

module.exports = { renderLine, formatTokens };

if (require.main === module) {
  // Claude Code pipes session JSON on stdin; we render from our own state.
  try {
    const { readState } = require('./lib/state');
    process.stdout.write(renderLine(readState(), Date.now()));
  } catch {
    // statusline must never crash the host renderer
  }
  process.exit(0);
}
