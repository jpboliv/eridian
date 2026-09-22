const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.ERIDIAN_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-acct-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const { accountEvents } = require('../scripts/lib/accounting-core');
const { sessionSavings } = require('../scripts/lib/session-savings');
const { normalizeEvent } = require('../scripts/codex/usage');
const { normalizedDiagnostics } = require('../scripts/codex/diagnostics');

const NOW = Date.parse('2026-09-22T10:30:00.000Z');
const state = { events: [{ ts: '2026-09-22T10:00:00.000Z', level: 'full', rule: 'rule-1' }] };
const factors = {
  full: 0.2,
  _calibration: {
    id: 'codex-calibration-1',
    scope: 'prose-only',
    rule: 'rule-1',
    model: 'codex-test',
  },
};
const prose = [{ type: 'text', text: 'Plain prose.' }];

test('normalized Codex accounting matches shared attribution and preserves unavailable calibration', () => {
  const events = [
    {
      id: 'm1',
      model: 'codex-test',
      tsMs: Date.parse('2026-09-22T10:01:00.000Z'),
      outputTokens: 100,
      category: 'prose',
    },
    {
      id: 'm1',
      model: 'codex-test',
      tsMs: Date.parse('2026-09-22T10:01:01.000Z'),
      outputTokens: 120,
      category: 'prose',
    },
    {
      id: 'tool',
      model: 'codex-test',
      tsMs: Date.parse('2026-09-22T10:02:00.000Z'),
      outputTokens: 80,
      category: 'protected-or-mixed',
    },
  ];
  const unavailable = accountEvents({ events, state, factors: null, nowMs: NOW });
  assert.equal(unavailable.outputTokens, 200);
  assert.equal(unavailable.eligibleOutputTokens, 120);
  assert.equal(unavailable.savedTokens, null);
  const calibrated = accountEvents({ events, state, factors, nowMs: NOW });
  assert.equal(calibrated.savedTokens, 30);
});

test('a calibration without a string model never calibrates null-model records (Claude parity)', () => {
  const events = [
    {
      id: 'm1',
      model: null,
      tsMs: Date.parse('2026-09-22T10:01:00.000Z'),
      outputTokens: 100,
      category: 'prose',
    },
  ];
  const nullModel = { full: 0.2, _calibration: { ...factors._calibration, model: null } };
  assert.equal(accountEvents({ events, state, factors: nullModel, nowMs: NOW }).savedTokens, null);
});

test('thinking tokens mark a normalized Codex event as protected output', () => {
  const event = normalizeEvent(
    {
      version: 1,
      type: 'assistant',
      session_id: 'thread',
      id: 'think',
      model: 'codex-test',
      timestamp: '2026-09-22T10:02:30.000Z',
      usage: { output_tokens: 40, output_tokens_details: { thinking_tokens: 5 } },
      content: prose,
    },
    'thread'
  );
  assert.equal(event.category, 'protected-or-mixed');
});

test('the same observations produce the same totals through the Claude transcript and the Codex adapter', () => {
  const observations = [
    ['m1', '2026-09-22T10:01:00.000Z', 100, prose],
    ['m1', '2026-09-22T10:01:01.000Z', 120, prose],
    ['tool', '2026-09-22T10:02:00.000Z', 80, [{ type: 'tool_use', name: 'x' }]],
    ['think', '2026-09-22T10:02:30.000Z', 40, prose, { thinking_tokens: 5 }],
    [null, '2026-09-22T10:03:00.000Z', 7, prose],
    ['early', '2026-09-22T09:59:00.000Z', 300, prose],
  ];
  const claudeLines = observations.map(([id, timestamp, tokens, content, details]) =>
    JSON.stringify({
      type: 'assistant',
      timestamp,
      message: {
        ...(id ? { id } : {}),
        model: 'codex-test',
        content,
        usage: { output_tokens: tokens, ...(details ? { output_tokens_details: details } : {}) },
      },
    })
  );
  const transcript = path.join(process.env.ERIDIAN_STATE_DIR, 'claude.jsonl');
  fs.writeFileSync(transcript, claudeLines.join('\n') + '\n');
  const claude = sessionSavings(
    { sessionId: 'parity', transcriptPath: transcript },
    state,
    factors,
    NOW
  );
  const codexEvents = observations
    .map(([id, timestamp, tokens, content, details]) =>
      normalizeEvent(
        {
          version: 1,
          type: 'assistant',
          session_id: 'thread',
          ...(id ? { id } : {}),
          model: 'codex-test',
          timestamp,
          usage: { output_tokens: tokens, ...(details ? { output_tokens_details: details } : {}) },
          content,
        },
        'thread'
      )
    )
    .filter(Boolean);
  const codex = accountEvents({ events: codexEvents, state, factors, nowMs: NOW });
  const totals = (r) => ({
    outputTokens: r.outputTokens,
    eligibleOutputTokens: r.eligibleOutputTokens,
    calibratedOutputTokens: r.calibratedOutputTokens,
    unidentifiedOutputTokens: r.unidentifiedOutputTokens,
    savedTokens: r.savedTokens,
  });
  assert.deepEqual(totals(claude), {
    outputTokens: 240,
    eligibleOutputTokens: 120,
    calibratedOutputTokens: 120,
    unidentifiedOutputTokens: 7,
    savedTokens: 30,
  });
  assert.deepEqual(totals(codex), totals(claude));
});

test('normalized diagnostics preserve protected content and unsupported-language semantics', () => {
  const report = normalizedDiagnostics({
    sessionId: 'thread',
    language: 'zz',
    events: [
      {
        id: 'a',
        model: 'codex-test',
        outputTokens: 10,
        content: [{ type: 'text', text: 'Short prose.' }],
      },
      {
        id: 'b',
        model: 'codex-test',
        outputTokens: 10,
        content: [{ type: 'text', text: '```js\ncode\n```' }],
      },
      {
        id: null,
        model: 'codex-test',
        outputTokens: 10,
        content: [{ type: 'text', text: 'unknown' }],
      },
    ],
  });
  assert.equal(report.lexicalSupported, false);
  assert.equal(report.phraseMatches, null);
  assert.equal(report.includedReplies, 1);
  assert.equal(report.excludedNonProseReplies, 1);
  assert.equal(report.unidentifiedRecords, 1);
});

test('normalized diagnostics report the reader counts instead of hardcoded zeros', () => {
  const report = normalizedDiagnostics({
    sessionId: 'thread',
    language: 'en',
    events: [],
    malformedRecords: 2,
    unsupportedRecords: 3,
    oversizedRecords: 1,
  });
  assert.equal(report.malformedRecords, 2);
  assert.equal(report.unsupportedRecords, 3);
  assert.equal(report.oversizedRecords, 1);
  assert.equal('excludedSessionRecords' in report, false);
});
