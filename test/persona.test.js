const test = require('node:test');
const assert = require('node:assert');
const {
  extractInjectionBlock,
  loadInjectionBlock,
  normalizeLevel,
} = require('../scripts/lib/persona');

test('extractInjectionBlock pulls delimited block', () => {
  const md = 'x\n<!-- eridian:inject:full -->\nRULES HERE\n<!-- /eridian:inject:full -->\ny';
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
    assert.ok(block.includes('"no + verb"'), `${level} uses canon negation`);
  }
});

test('canon markers land in the right levels', () => {
  const lite = loadInjectionBlock('lite');
  const full = loadInjectionBlock('full');
  const ultra = loadInjectionBlock('ultra');
  for (const [name, block] of [
    ['full', full],
    ['ultra', ultra],
  ]) {
    assert.ok(block.includes(', question?'), `${name} marks questions`);
    assert.ok(block.includes(', statement.'), `${name} marks statements`);
  }
  assert.ok(!lite.includes(', statement.'), 'lite stays savings-pure');
  assert.ok(ultra.includes('Rocky fix'), 'ultra is third-person');
  assert.ok(ultra.includes('fist my bump'), 'ultra has the gag');
});

test('normalizeLevel handles aliases and junk', () => {
  assert.strictEqual(normalizeLevel('eridian'), 'ultra');
  assert.strictEqual(normalizeLevel('FULL'), 'full');
  assert.strictEqual(normalizeLevel('off'), 'off');
  assert.strictEqual(normalizeLevel('banana'), null);
});

test('vocab expansion markers land in the right levels', () => {
  const lite = loadInjectionBlock('lite');
  const full = loadInjectionBlock('full');
  const ultra = loadInjectionBlock('ultra');
  for (const [name, block] of [
    ['full', full],
    ['ultra', ultra],
  ]) {
    assert.ok(block.includes('👍 / 👎'), `${name} has thumb verdicts`);
    assert.ok(block.includes('"Understand."'), `${name} acknowledges tersely`);
  }
  assert.ok(ultra.includes('big science'), 'ultra celebrates big science');
  assert.ok(ultra.includes('Thumbs up, baby 👎'), 'ultra has the thumbs gag');
  assert.ok(ultra.includes('"friend"'), 'ultra addresses user as friend');
  assert.ok(!lite.includes('👍'), 'lite stays savings-pure');
  assert.ok(!lite.includes('Understand.'), 'lite gains no new vocab');
});
