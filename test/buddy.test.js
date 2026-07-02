const test = require('node:test');
const assert = require('node:assert');
const { deriveMood, renderBuddy, renderTall } = require('../scripts/lib/buddy');
const { MINI, TALL } = require('../scripts/lib/buddy-art');

const NOW = Date.parse('2026-07-02T12:00:00Z');
const secsAgo = (n) => new Date(NOW - n * 1000).toISOString();

// one buddy state per mood
const MOODS = {
  humming: {},
  reacting: { lastPromptAt: secsAgo(5) },
  working: { lastToolAt: secsAgo(5) },
  celebrating: { milestoneAt: secsAgo(5) },
  alarmed: { lastErrorAt: secsAgo(5) },
  sleeping: { lastToolAt: secsAgo(700) },
};

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

test('recent prompt keeps Rocky awake', () => {
  const buddy = { lastToolAt: secsAgo(700), lastPromptAt: secsAgo(30) };
  assert.strictEqual(deriveMood(buddy, NOW), 'humming');
});

test('fixed height: mini is always 4 rows, tall always 5', () => {
  for (const [mood, buddy] of Object.entries(MOODS)) {
    assert.strictEqual(renderBuddy(buddy, NOW).rows.length, 4, `mini ${mood}`);
    assert.strictEqual(renderTall(buddy, NOW).rows.length, 5, `tall ${mood}`);
  }
});

test('mini is eyeless and carries mood quips', () => {
  const hum = renderBuddy({}, NOW);
  assert.ok(hum.rows.every((r) => !/[▛▜]/.test(r)), 'no eye notches');
  assert.ok(renderBuddy({ lastErrorAt: secsAgo(5) }, NOW).quip.length > 0);
  assert.strictEqual(renderBuddy({ lastToolAt: secsAgo(700) }, NOW).quip, 'zzz');
});

test('celebrating uses the party dome; sleeping tucks the legs + drops arms', () => {
  const party = renderTall({ milestoneAt: secsAgo(5) }, NOW);
  assert.strictEqual(party.rows[1], TALL.domeParty);

  const sleep = renderTall({ lastToolAt: secsAgo(700) }, NOW);
  assert.strictEqual(sleep.rows[4], TALL.legsTucked);
  assert.strictEqual(sleep.rows[0], '', 'arms down while asleep');

  const sleepMini = renderBuddy({ lastToolAt: secsAgo(700) }, NOW);
  assert.strictEqual(sleepMini.rows[3], MINI.legsTucked);
});

test('alarmed is held still across ticks; humming animates', () => {
  const alarmed = { lastErrorAt: secsAgo(5) };
  assert.deepStrictEqual(
    renderBuddy(alarmed, NOW).rows,
    renderBuddy(alarmed, NOW + 3000).rows,
    'alarmed frozen (stillness reads as alarm)',
  );

  const t0 = Math.floor(NOW / 4000) * 4000; // arms & legs both flip within 2s
  assert.notDeepStrictEqual(
    renderBuddy({}, t0).rows,
    renderBuddy({}, t0 + 2000).rows,
    'humming moves',
  );
});

test('reacting quip follows prompt class', () => {
  const buddy = { lastPromptAt: secsAgo(5), promptClass: 'bugfix' };
  assert.strictEqual(renderBuddy(buddy, NOW).quip, 'bad bad. I fix.');
});

test('working legs step faster than humming', () => {
  const t0 = Math.floor(NOW / 2000) * 2000;
  const work = { lastToolAt: secsAgo(1) };
  assert.notStrictEqual(
    renderTall(work, t0).rows[4],
    renderTall(work, t0 + 1000).rows[4],
    'working gait alternates every second',
  );
});
