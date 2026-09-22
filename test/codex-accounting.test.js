const test = require('node:test');
const assert = require('node:assert/strict');
const { accountNormalizedEvents } = require('../scripts/lib/normalized-accounting');
const { normalizedDiagnostics } = require('../scripts/codex/diagnostics');

test('normalized Codex accounting matches shared attribution and preserves unavailable calibration', () => {
  const state = {
    events: [{ ts: '2026-09-22T10:00:00.000Z', level: 'full', rule: 'rule-1' }],
  };
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
  const unavailable = accountNormalizedEvents({
    events,
    state,
    factors: null,
    nowMs: Date.parse('2026-09-22T10:03:00.000Z'),
  });
  assert.equal(unavailable.outputTokens, 200);
  assert.equal(unavailable.eligibleOutputTokens, 120);
  assert.equal(unavailable.savedTokens, null);
  const calibrated = accountNormalizedEvents({
    events,
    state,
    factors: {
      full: 0.2,
      _calibration: {
        id: 'codex-calibration-1',
        scope: 'prose-only',
        rule: 'rule-1',
        model: 'codex-test',
      },
    },
    nowMs: Date.parse('2026-09-22T10:03:00.000Z'),
  });
  assert.equal(calibrated.savedTokens, 30);
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
