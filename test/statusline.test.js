const test = require('node:test');
const assert = require('node:assert');
const { renderLine, formatTokens } = require('../scripts/statusline.js');

const NOW = Date.parse('2026-07-02T12:00:01Z');

test('renders nothing when off', () => {
  assert.strictEqual(renderLine({ current: 'off', buddy: {} }, NOW), '');
});

test('renders buddy, level, and savings when active with cache', () => {
  const line = renderLine({
    current: 'full',
    buddy: {},
    cache: { savedTokens: 12300 },
  }, NOW);
  assert.match(line, /^♫ /);
  assert.match(line, /·\s*full/);
  assert.match(line, /~12\.3k saved/);
});

test('omits savings segment without cache', () => {
  const line = renderLine({ current: 'lite', buddy: {}, cache: null }, NOW);
  assert.ok(!line.includes('saved'));
  assert.match(line, /lite/);
});

test('formatTokens', () => {
  assert.strictEqual(formatTokens(900), '900');
  assert.strictEqual(formatTokens(12300), '12.3k');
  assert.strictEqual(formatTokens(1500000), '1.5M');
});
