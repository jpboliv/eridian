const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert');
const {
  extractInjectionBlock,
  loadInjectionBlock,
  normalizeLevel,
  SKILL_FILE,
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

test('no-invented-abbreviations rule lands in every level', () => {
  for (const level of ['lite', 'full', 'ultra']) {
    const block = loadInjectionBlock(level);
    assert.ok(block.includes('No invented abbreviations'), `${level} bans invented abbreviations`);
    assert.ok(block.includes('no → in prose'), `${level} bans prose arrows`);
    assert.ok(block.includes('acronyms'), `${level} allows standard acronyms`);
  }
});

test('auto-clarity triggers land in every level', () => {
  for (const level of ['lite', 'full', 'ultra']) {
    const block = loadInjectionBlock(level);
    assert.ok(block.includes('destructive-op'), `${level} keeps destructive-op trigger`);
    assert.ok(block.includes('order-sensitive'), `${level} covers order-sensitive steps`);
    assert.ok(block.includes('ambiguity'), `${level} covers compression ambiguity`);
    assert.ok(block.includes('confusion'), `${level} covers user confusion`);
    assert.ok(block.includes('resume'), `${level} resumes dialect after`);
  }
});

test('invariants section lists the expanded auto-clarity triggers', () => {
  const md = fs.readFileSync(SKILL_FILE, 'utf8');
  const start = md.indexOf('## Invariants');
  const end = md.indexOf('## Levels');
  assert.ok(start >= 0, 'SKILL.md has an ## Invariants heading');
  assert.ok(end > start, 'SKILL.md has a ## Levels heading after ## Invariants');
  const invariants = md.slice(start, end);
  assert.ok(
    invariants.includes('destructive-operation warnings'),
    'invariants keeps destructive-op trigger'
  );
  assert.ok(invariants.includes('order-sensitive'), 'invariants covers order-sensitive steps');
  assert.ok(invariants.includes('ambiguity'), 'invariants covers compression ambiguity');
  assert.ok(invariants.includes('confusion'), 'invariants covers user confusion');
  assert.ok(invariants.includes('resume'), 'invariants resumes dialect after');
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
