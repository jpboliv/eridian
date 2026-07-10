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
  const beat0 = renderBuddy({ ...buddy, frame: 0 }, NOW).rows;
  const beat1 = renderBuddy({ ...buddy, frame: 1 }, NOW).rows; // beat index 1 (five, shift 1)
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

test('alarmed is held still across frames; sleeping too', () => {
  for (const mood of ['alarmed', 'sleeping']) {
    assert.deepStrictEqual(
      renderBuddy({ ...MOODS[mood], frame: 0 }, NOW).rows,
      renderBuddy({ ...MOODS[mood], frame: 1 }, NOW).rows,
      `${mood} frozen`
    );
  }
});

// the original bug: poses were keyed to wall clock, but the host only
// re-runs the statusline every ~10s, so sub-2s ticks never showed. Poses
// must advance with the per-invocation frame counter instead.
test('every moving mood steps a visibly different frame each refresh', () => {
  for (const mood of ['humming', 'reacting', 'working', 'celebrating']) {
    assert.notDeepStrictEqual(
      renderBuddy({ ...MOODS[mood], frame: 0 }, NOW).rows,
      renderBuddy({ ...MOODS[mood], frame: 1 }, NOW).rows,
      `${mood} moves between consecutive frames`
    );
  }
});

test('pose is keyed to frame, not wall clock', () => {
  assert.deepStrictEqual(
    renderBuddy({ frame: 4 }, NOW).rows,
    renderBuddy({ frame: 4 }, NOW + 3000).rows,
    'same frame renders the same pose regardless of clock'
  );
});

test('reacting quip follows prompt class', () => {
  const buddy = { lastPromptAt: secsAgo(5), promptClass: 'bugfix' };
  assert.strictEqual(renderBuddy(buddy, NOW).quip, 'bad bad. I fix.');
});

test('legs alternate gait frames with the frame counter', () => {
  const work = { lastToolAt: secsAgo(1) };
  assert.notStrictEqual(
    renderBuddy({ ...work, frame: 0 }, NOW).rows[2],
    renderBuddy({ ...work, frame: 1 }, NOW).rows[2],
    'gait alternates every frame'
  );
});
