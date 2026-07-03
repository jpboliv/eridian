const test = require('node:test');
const assert = require('node:assert');
const { MINI } = require('../scripts/lib/buddy-art');

const AMBIGUOUS_WIDTH_CHARS = ['█', '▄', '♪'];

test('mini art exposes every part buddy.js composes', () => {
  assert.strictEqual(MINI.arms.down, '', 'arms down is the blank top row');
  for (const pose of ['up', 'wide', 'leftWave', 'rightWave', 'five', 'celebrate']) {
    assert.strictEqual(typeof MINI.arms[pose], 'string', `mini arm ${pose}`);
  }
  assert.strictEqual(MINI.legs.length, 2, 'two gait frames');
  assert.ok(MINI.dome && MINI.body && MINI.legsTucked);
});

test('leg gait frames alternate and keep the end legs anchored', () => {
  const [a, b] = MINI.legs;
  assert.notStrictEqual(a, b, 'gait frames differ (so legs move)');
  for (const frame of [a, b]) {
    assert.match(frame, /^▘/, 'left leg anchored');
    assert.match(frame, /▘$/, 'right leg anchored');
  }
});

test("five/celebrate arm ticks never land on the dome's ink columns", () => {
  const domeInk = new Set(
    [...MINI.dome].map((ch, i) => (ch !== ' ' ? i : null)).filter((i) => i !== null)
  );
  for (const pose of ['five', 'celebrate']) {
    const armInk = [...MINI.arms[pose]]
      .map((ch, i) => (ch !== ' ' ? i : null))
      .filter((i) => i !== null);
    for (const col of armInk) {
      assert.ok(!domeInk.has(col), `${pose} tick at column ${col} collides with dome ink`);
    }
  }
});

test('no ambiguous-width glyphs in the art data (they break column alignment)', () => {
  const values = [MINI.dome, MINI.body, MINI.legsTucked, ...MINI.legs, ...Object.values(MINI.arms)];
  for (const value of values) {
    for (const bad of AMBIGUOUS_WIDTH_CHARS) {
      assert.ok(!value.includes(bad), `"${value}" contains ambiguous-width char "${bad}"`);
    }
  }
});
