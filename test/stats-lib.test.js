const test = require('node:test');
const assert = require('node:assert');
const { buildWindows, attribute, estimateSaved, crossedMilestones } =
  require('../scripts/lib/stats-lib');

const T0 = Date.parse('2026-07-01T10:00:00Z');
const mins = (n) => T0 + n * 60_000;
const iso = (ms) => new Date(ms).toISOString();

test('buildWindows: open window closes at next event or now', () => {
  const events = [
    { ts: iso(mins(0)), level: 'full' },
    { ts: iso(mins(30)), level: 'off' },
    { ts: iso(mins(60)), level: 'ultra' },
  ];
  const w = buildWindows(events, mins(90));
  assert.deepStrictEqual(w, [
    { startMs: mins(0), endMs: mins(30), level: 'full' },
    { startMs: mins(60), endMs: mins(90), level: 'ultra' },
  ]);
});

test('attribute assigns messages to window levels', () => {
  const windows = [
    { startMs: mins(0), endMs: mins(30), level: 'full' },
    { startMs: mins(60), endMs: mins(90), level: 'ultra' },
  ];
  const messages = [
    { tsMs: mins(10), outputTokens: 100, sessionStartMs: mins(5) },
    { tsMs: mins(45), outputTokens: 999, sessionStartMs: mins(5) }, // outside any window
    { tsMs: mins(70), outputTokens: 50, sessionStartMs: mins(65) },
  ];
  assert.deepStrictEqual(attribute(messages, windows), {
    full: { messages: 1, tokens: 100 },
    ultra: { messages: 1, tokens: 50 },
  });
});

test('attribute excludes messages from sessions started before mode-on', () => {
  const windows = [{ startMs: mins(10), endMs: mins(60), level: 'full' }];
  const messages = [
    // session began at mins(0), before the window: hook never injected
    { tsMs: mins(20), outputTokens: 500, sessionStartMs: mins(0) },
    // session began inside the window: counts
    { tsMs: mins(20), outputTokens: 100, sessionStartMs: mins(15) },
  ];
  assert.deepStrictEqual(attribute(messages, windows), {
    full: { messages: 1, tokens: 100 },
  });
});

test('attribute falls back to message ts when sessionStartMs missing', () => {
  const windows = [{ startMs: mins(0), endMs: mins(30), level: 'lite' }];
  const messages = [{ tsMs: mins(10), outputTokens: 40 }];
  assert.deepStrictEqual(attribute(messages, windows), {
    lite: { messages: 1, tokens: 40 },
  });
});

test('estimateSaved applies per-level factors', () => {
  const saved = estimateSaved(
    { full: { messages: 1, tokens: 100 } },
    { full: 0.5 }
  );
  assert.strictEqual(saved, 100); // 100/(1-0.5) - 100
});

test('crossedMilestones', () => {
  assert.deepStrictEqual(crossedMilestones(9000, 11_000), [10_000]);
  assert.deepStrictEqual(crossedMilestones(11_000, 12_000), []);
  assert.deepStrictEqual(crossedMilestones(0, 60_000), [10_000, 50_000]);
});
