const test = require('node:test');
const assert = require('node:assert');
const { extractInjectionBlock, loadInjectionBlock, normalizeLevel } =
  require('../scripts/lib/persona');

test('extractInjectionBlock pulls delimited block', () => {
  const md = 'x\n<!-- rocky:inject:full -->\nRULES HERE\n<!-- /rocky:inject:full -->\ny';
  assert.strictEqual(extractInjectionBlock(md, 'full'), 'RULES HERE');
});

test('extractInjectionBlock returns null when missing', () => {
  assert.strictEqual(extractInjectionBlock('no blocks', 'full'), null);
});

test('loadInjectionBlock reads real SKILL.md for every level', () => {
  for (const level of ['lite', 'full', 'ultra']) {
    const block = loadInjectionBlock(level);
    assert.ok(block && block.includes('ROCKY MODE'), `${level} block exists`);
    assert.ok(block.includes('NEVER alter code'), `${level} keeps invariant`);
  }
});

test('normalizeLevel handles aliases and junk', () => {
  assert.strictEqual(normalizeLevel('eridian'), 'ultra');
  assert.strictEqual(normalizeLevel('FULL'), 'full');
  assert.strictEqual(normalizeLevel('off'), 'off');
  assert.strictEqual(normalizeLevel('banana'), null);
});
