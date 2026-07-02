const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ROCKY_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rocky-state-'));

const test = require('node:test');
const assert = require('node:assert');
const state = require('../scripts/lib/state');

test('readState returns default when file missing', () => {
  const s = state.readState();
  assert.deepStrictEqual(s, { current: 'off', events: [], cache: null, buddy: {} });
});

test('writeState then readState round-trips', () => {
  state.writeState({ current: 'full', events: [{ ts: 'T', level: 'full' }], cache: null, buddy: {} });
  assert.strictEqual(state.readState().current, 'full');
  assert.strictEqual(state.readState().events.length, 1);
});

test('readState survives corrupt file', () => {
  fs.writeFileSync(state.STATE_FILE, '{not json!!');
  assert.strictEqual(state.readState().current, 'off');
});

test('update applies mutation and persists', () => {
  state.writeState({ current: 'off', events: [], cache: null, buddy: {} });
  const next = state.update((s) => { s.current = 'ultra'; return s; });
  assert.strictEqual(next.current, 'ultra');
  assert.strictEqual(state.readState().current, 'ultra');
});
