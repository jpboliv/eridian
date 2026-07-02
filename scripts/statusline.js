#!/usr/bin/env node
const { renderBuddy, renderTall } = require('./lib/buddy');

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function infoSegments(state) {
  const parts = [`· ${state.current}`];
  if (state.cache && typeof state.cache.savedTokens === 'number') {
    parts.push(`· ~${formatTokens(state.cache.savedTokens)} saved`);
  }
  return parts;
}

function renderLines(state, nowMs) {
  if (!state.current || state.current === 'off') return [];

  if (state.buddyStyle === 'tall') {
    const { rows, quip } = renderTall(state.buddy || {}, nowMs);
    return [
      `${rows[0]}  ${quip || '♫'}`.trimEnd(),
      `${rows[1]}  ${infoSegments(state).join('  ')}`,
      rows[2],
    ];
  }

  const { art, quip } = renderBuddy(state.buddy || {}, nowMs);
  const parts = [`♫ ${art}`];
  if (quip) parts.push(quip);
  parts.push(...infoSegments(state));
  return [parts.join('  ')];
}

module.exports = { renderLines, formatTokens };

if (require.main === module) {
  // Claude Code pipes session JSON on stdin; we render from our own state.
  try {
    const { readState } = require('./lib/state');
    process.stdout.write(renderLines(readState(), Date.now()).join('\n'));
  } catch {
    // statusline must never crash the host renderer
  }
  process.exit(0);
}
