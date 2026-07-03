const test = require('node:test');
const assert = require('node:assert');
const { deriveMood, renderBuddy } = require('../scripts/lib/buddy');
const { MINI } = require('../scripts/lib/buddy-art');

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

test('fixed height: every mood is always exactly 3 rows', () => {
  for (const [mood, buddy] of Object.entries(MOODS)) {
    assert.strictEqual(renderBuddy(buddy, NOW).rows.length, 3, mood);
  }
});

test('mini is eyeless and carries mood quips', () => {
  const hum = renderBuddy({}, NOW);
  assert.ok(
    hum.rows.every((r) => !/[▛▜]/.test(r)),
    'no eye notches'
  );
  assert.ok(renderBuddy({ lastErrorAt: secsAgo(5) }, NOW).quip.length > 0);
  assert.strictEqual(renderBuddy({ lastToolAt: secsAgo(700) }, NOW).quip, 'zzz');
});

test('sleeping tucks the legs and drops arms; dome shows through plain', () => {
  const sleep = renderBuddy({ lastToolAt: secsAgo(700) }, NOW);
  assert.strictEqual(sleep.rows[0], MINI.dome, 'no arm ticks while asleep');
  assert.strictEqual(sleep.rows[2], MINI.legsTucked);
});

test('celebrating dances: two synced beats, whole figure shifts one column together', () => {
  const buddy = { milestoneAt: secsAgo(5) };
  const t0 = Math.floor(NOW / 1000) * 1000; // aligned so beat index is 0 (celebrate, shift 0)
  const beat0 = renderBuddy(buddy, t0).rows;
  const beat1 = renderBuddy(buddy, t0 + 500).rows; // beat index 1 (five, shift 1)
  assert.notDeepStrictEqual(beat0, beat1, 'beats differ (different arm pose + leg frame)');
  // body row content doesn't depend on pose, so it isolates the shift
  assert.strictEqual(beat1[1], ` ${beat0[1]}`, 'beat 1 shifts the whole figure one column right');
  // arms+legs differ in more than just the shift (different pose/gait frame, not a jitter)
  assert.notStrictEqual(
    beat1[0].trimStart(),
    beat0[0].trimStart(),
    'arm pose changes between beats'
  );
  assert.notStrictEqual(
    beat1[2].trimStart(),
    beat0[2].trimStart(),
    'leg frame changes between beats'
  );
});

test('alarmed is held still across ticks; humming animates', () => {
  const alarmed = { lastErrorAt: secsAgo(5) };
  assert.deepStrictEqual(
    renderBuddy(alarmed, NOW).rows,
    renderBuddy(alarmed, NOW + 3000).rows,
    'alarmed frozen (stillness reads as alarm)'
  );

  const t0 = Math.floor(NOW / 4000) * 4000; // arms & legs both flip within 2s
  assert.notDeepStrictEqual(
    renderBuddy({}, t0).rows,
    renderBuddy({}, t0 + 2000).rows,
    'humming moves'
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
    renderBuddy(work, t0).rows[2],
    renderBuddy(work, t0 + 1000).rows[2],
    'working gait alternates every second'
  );
});
