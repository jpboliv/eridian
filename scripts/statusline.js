#!/usr/bin/env node
const { renderBuddy } = require('./lib/buddy');

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function infoSegments(state, savedTokens) {
  const parts = [`∙ ${state.current}`];
  if (typeof savedTokens === 'number') {
    parts.push(`∙ ~${formatTokens(savedTokens)} saved`);
  }
  return parts;
}

function renderLines(state, nowMs, savedTokens) {
  if (!state.current || state.current === 'off') return [];

  const info = infoSegments(state, savedTokens).join('  ');
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
  // Claude Code pipes session JSON on stdin; the savings segment comes from
  // the current session's transcript, everything else from our own state.
  const render = (raw) => {
    try {
      const { readState, update } = require('./lib/state');
      const state = readState();
      const nowMs = Date.now();
      let savedTokens = null;
      try {
        const input = JSON.parse(raw);
        const fs = require('node:fs');
        const path = require('node:path');
        const { sessionSavings } = require('./lib/session-savings');
        const factors = JSON.parse(
          fs.readFileSync(path.join(__dirname, '..', 'eval', 'factors.json'), 'utf8')
        );
        const result = sessionSavings(
          { sessionId: input.session_id, transcriptPath: input.transcript_path },
          state,
          factors,
          nowMs
        );
        if (result) {
          savedTokens = result.savedTokens;
          if (result.crossed.length) {
            update((s) => {
              s.buddy.milestoneAt = new Date(nowMs).toISOString();
              return s;
            });
          }
        }
      } catch {
        // no/garbage stdin or unreadable transcript — render without savings
      }
      process.stdout.write(renderLines(state, nowMs, savedTokens).join('\n'));
    } catch {
      // statusline must never crash the host renderer
    }
    process.exit(0);
  };

  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => render(raw));
  // never hang if stdin stays open (e.g. run by hand from a TTY)
  setTimeout(() => render(raw), 250);
}
