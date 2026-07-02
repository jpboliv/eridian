const test = require('node:test');
const assert = require('node:assert');
const { MINI, TALL } = require('../scripts/lib/buddy-art');

test('mini art exposes every part buddy.js composes', () => {
  assert.strictEqual(MINI.arms.down, '', 'arms down is the blank top row');
  for (const pose of ['up', 'wide', 'leftWave', 'rightWave', 'five', 'celebrate']) {
    assert.strictEqual(typeof MINI.arms[pose], 'string', `mini arm ${pose}`);
  }
  assert.strictEqual(MINI.legs.length, 2, 'two gait frames');
  assert.ok(MINI.dome && MINI.body && MINI.legsTucked && MINI.domeParty);
});

test('tall art exposes every part buddy.js composes', () => {
  assert.strictEqual(TALL.arms.down, '');
  for (const pose of ['up', 'higher', 'wide', 'leftWave', 'rightWave', 'five', 'celebrate']) {
    assert.strictEqual(typeof TALL.arms[pose], 'string', `tall arm ${pose}`);
  }
  assert.strictEqual(TALL.legs.length, 2, 'two gait frames');
  assert.strictEqual(TALL.body.length, 2, 'two body rows');
  assert.ok(TALL.dome && TALL.legsTucked && TALL.domeParty);
});

test('leg gait frames alternate and keep the end legs anchored', () => {
  for (const art of [MINI, TALL]) {
    const [a, b] = art.legs;
    assert.notStrictEqual(a, b, 'gait frames differ (so legs move)');
    for (const frame of [a, b]) {
      assert.match(frame, /^▘/, 'left leg anchored');
      assert.match(frame, /▘$/, 'right leg anchored');
    }
  }
});
