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
    assert.ok(!block.includes('Negate with'), `${level} does not force ungrammatical negation`);
  }
});

test('lite keeps grammar while full/ultra make decoration optional', () => {
  const lite = loadInjectionBlock('lite');
  assert.ok(lite.includes('grammatical prose'));
  assert.ok(lite.includes('normal articles, verbs and negation'));
  assert.ok(lite.includes('No mandatory dialect markers'));
  assert.ok(!lite.includes(', statement.') && !lite.includes(', question?'));
  for (const level of ['full', 'ultra']) {
    const block = loadInjectionBlock(level);
    assert.ok(block.includes(', question?'));
    assert.ok(block.includes(', statement.'));
    assert.match(block, /[Oo]ptional|Choose none or one/);
    assert.match(block, /[Aa]t most (?:one|ONE) decorative marker/);
    assert.ok(block.includes('not evidence or certainty'));
  }
});

test('no-invented-abbreviations rule lands in every level', () => {
  for (const level of ['lite', 'full', 'ultra']) {
    const block = loadInjectionBlock(level);
    assert.ok(block.includes('No invented abbreviations'), `${level} bans invented abbreviations`);
    assert.ok(
      block.includes('No invented abbreviations or prose arrows'),
      `${level} bans prose arrows`
    );
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

test('ultra budget counts gags, triples, suffixes, third person and glyphs', () => {
  const block = loadInjectionBlock('ultra');
  for (const marker of [
    'Rocky fix',
    'fist my bump',
    'big science',
    'Thumbs up, baby 👎',
    'friend',
    'good good good',
    '♫',
  ])
    assert.ok(block.includes(marker));
  assert.ok(block.includes('👎 means good'));
  assert.ok(!block.includes('👍'));
  assert.ok(block.includes('overlapping markers count longest once'));
  assert.ok(block.includes('Separate markers add up'));
  assert.ok(block.includes('Never require a greeting'));
});
