const test = require('node:test');
const assert = require('node:assert');
const { renderLines, formatTokens } = require('../scripts/statusline.js');

const NOW = Date.parse('2026-07-02T12:00:01Z');

test('renders nothing when off', () => {
  assert.deepStrictEqual(renderLines({ current: 'off', buddy: {} }, NOW), []);
});

test('3 rows, quip on the top row, level+savings on the body row', () => {
  const lines = renderLines({ current: 'full', buddy: {}, cache: { savedTokens: 12300 } }, NOW);
  assert.strictEqual(lines.length, 3);
  assert.match(lines[0], /♫/);
  assert.match(lines[1], /∙\s*full/);
  assert.match(lines[1], /~12\.3k saved/);
});

test('omits savings segment without cache', () => {
  const lines = renderLines({ current: 'lite', buddy: {}, cache: null }, NOW);
  assert.ok(lines.every((l) => !l.includes('saved')));
  assert.ok(lines.some((l) => /lite/.test(l)));
});

test('formatTokens', () => {
  assert.strictEqual(formatTokens(900), '900');
  assert.strictEqual(formatTokens(12300), '12.3k');
  assert.strictEqual(formatTokens(1500000), '1.5M');
});
