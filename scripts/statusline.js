#!/usr/bin/env node
const { renderBuddy } = require('./lib/buddy');

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function infoSegments(state) {
  const parts = [`∙ ${state.current}`];
  if (state.cache && typeof state.cache.savedTokens === 'number') {
    parts.push(`∙ ~${formatTokens(state.cache.savedTokens)} saved`);
  }
  return parts;
}

function renderLines(state, nowMs) {
  if (!state.current || state.current === 'off') return [];

  const info = infoSegments(state).join('  ');
  const { rows, quip } = renderBuddy(state.buddy || {}, nowMs);

  // quip rides the arms+dome (top) row like a speech bubble; info rides the
  // body row. Height is fixed at 3 rows for every mood.
  const bodyRow = rows.length - 2;
  return rows.map((row, i) => {
    if (i === 0) return `${row}  ${quip || '♫'}`.trimEnd();
    if (i === bodyRow) return `${row}  ${info}`.trimEnd();
    return row;
  });
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
