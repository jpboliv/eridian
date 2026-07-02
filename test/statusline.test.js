const test = require('node:test');
const assert = require('node:assert');
const { renderLines, formatTokens } = require('../scripts/statusline.js');

const NOW = Date.parse('2026-07-02T12:00:01Z');

test('renders nothing when off', () => {
  assert.deepStrictEqual(renderLines({ current: 'off', buddy: {} }, NOW), []);
});

test('mini: one line with buddy, level, and savings', () => {
  const lines = renderLines({
    current: 'full',
    buddyStyle: 'mini',
    buddy: {},
    cache: { savedTokens: 12300 },
  }, NOW);
  assert.strictEqual(lines.length, 1);
  assert.match(lines[0], /^♫ /);
  assert.match(lines[0], /·\s*full/);
  assert.match(lines[0], /~12\.3k saved/);
});

test('mini omits savings segment without cache', () => {
  const lines = renderLines({ current: 'lite', buddyStyle: 'mini', buddy: {}, cache: null }, NOW);
  assert.ok(!lines[0].includes('saved'));
  assert.match(lines[0], /lite/);
});

test('tall: three rows, quip on first, level+savings on second', () => {
  const lines = renderLines({
    current: 'ultra',
    buddyStyle: 'tall',
    buddy: {},
    cache: { savedTokens: 12300 },
  }, NOW);
  assert.strictEqual(lines.length, 3);
  assert.match(lines[0], /♫/);
  assert.match(lines[1], /· ultra/);
  assert.match(lines[1], /~12\.3k saved/);
});

test('formatTokens', () => {
  assert.strictEqual(formatTokens(900), '900');
  assert.strictEqual(formatTokens(12300), '12.3k');
  assert.strictEqual(formatTokens(1500000), '1.5M');
});
