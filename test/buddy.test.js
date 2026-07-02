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

test('render is deterministic and mood-appropriate', () => {
  const sleeping = renderBuddy({ lastToolAt: secsAgo(700) }, NOW);
  assert.match(sleeping.art, /zzz/);
  assert.strictEqual(sleeping.quip, '');

  const alarmed = renderBuddy({ lastErrorAt: secsAgo(5) }, NOW);
  assert.match(alarmed.art, /⊙_⊙/);
  assert.ok(alarmed.quip.length > 0);

  const a = renderBuddy({}, NOW);
  const b = renderBuddy({}, NOW);
  assert.deepStrictEqual(a, b);
});

test('blink frame on 7-second tick', () => {
  const blinkNow = Math.floor(NOW / 7000) * 7000; // a multiple of 7s
  const { art } = renderBuddy({}, blinkNow);
  assert.match(art, /-ᴗ-/);
});

test('reacting quip follows prompt class', () => {
  const buddy = { lastPromptAt: secsAgo(5), promptClass: 'bugfix' };
  assert.strictEqual(renderBuddy(buddy, NOW).quip, 'bad bad. I fix.');
});
