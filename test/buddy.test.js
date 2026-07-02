const test = require('node:test');
const assert = require('node:assert');
const { deriveMood, renderBuddy } = require('../scripts/lib/buddy');

const NOW = Date.parse('2026-07-02T12:00:00Z');
const secsAgo = (n) => new Date(NOW - n * 1000).toISOString();

test('mood precedence: celebrating > alarmed > reacting > working', () => {
  const buddy = {
    milestoneAt: secsAgo(10),
    lastErrorAt: secsAgo(5),
    lastPromptAt: secsAgo(5),
    lastToolAt: secsAgo(5),
  };
  assert.strictEqual(deriveMood(buddy, NOW), 'celebrating');
  delete buddy.milestoneAt;
  assert.strictEqual(deriveMood(buddy, NOW), 'alarmed');
  delete buddy.lastErrorAt;
  assert.strictEqual(deriveMood(buddy, NOW), 'reacting');
  buddy.lastPromptAt = secsAgo(25);
  assert.strictEqual(deriveMood(buddy, NOW), 'working');
});

test('sleeping after 10 min idle; humming when no history', () => {
  assert.strictEqual(deriveMood({ lastToolAt: secsAgo(601) }, NOW), 'sleeping');
  assert.strictEqual(deriveMood({}, NOW), 'humming');
});

test('recent prompt keeps rocky awake', () => {
  const buddy = { lastToolAt: secsAgo(700), lastPromptAt: secsAgo(30) };
  assert.strictEqual(deriveMood(buddy, NOW), 'humming');
});

test('mini render is deterministic, eyeless, and mood-appropriate', () => {
  const sleeping = renderBuddy({ lastToolAt: secsAgo(700) }, NOW);
  assert.strictEqual(sleeping.art, '▄▄▄ zzz');
  assert.strictEqual(sleeping.quip, '');

  const alarmed = renderBuddy({ lastErrorAt: secsAgo(5) }, NOW);
  assert.strictEqual(alarmed.art, '▛█▜');
  assert.ok(alarmed.quip.length > 0);

  const a = renderBuddy({}, NOW);
  const b = renderBuddy({}, NOW);
  assert.deepStrictEqual(a, b);
  assert.ok(['▟█▙', '▄█▄'].includes(a.art), 'base frame is an eyeless glyph');
});

test('mini legs shuffle across 2-second ticks', () => {
  const even = renderBuddy({}, Math.floor(NOW / 4000) * 4000);
  const odd = renderBuddy({}, Math.floor(NOW / 4000) * 4000 + 2000);
  assert.notStrictEqual(even.art, odd.art);
});

test('reacting quip follows prompt class', () => {
  const buddy = { lastPromptAt: secsAgo(5), promptClass: 'bugfix' };
  assert.strictEqual(renderBuddy(buddy, NOW).quip, 'bad bad. I fix.');
});

test('tall render: 3 connected rows, eyeless, quips carried', () => {
  const { renderTall } = require('../scripts/lib/buddy');

  const { rows, quip } = renderTall({ lastToolAt: secsAgo(5) }, NOW);
  assert.strictEqual(rows.length, 3);
  for (const row of rows) assert.strictEqual([...row].length, 9);
  assert.ok(!/[▛▜]/.test(rows[0]), 'dome has no eye notches');
  // legs: exactly five ticks, ends are ▘ so they touch ▐/▌ filled halves
  const ticks = [...rows[2]].filter((c) => c === '▘' || c === '▝');
  assert.strictEqual(ticks.length, 5);
  assert.match(rows[2], /^ ▘/);
  assert.match(rows[2], /▘$/);
  assert.ok(quip.length > 0);

  const sleeping = renderTall({ lastToolAt: secsAgo(700) }, NOW);
  assert.strictEqual(sleeping.quip, 'zzz');
  assert.ok(!/[▘▝]/.test(sleeping.rows[2]), 'legs tucked when sleeping');

  const party = renderTall({ milestoneAt: secsAgo(5) }, NOW);
  assert.match(party.rows[0], /^♪.*♪$/);
});
