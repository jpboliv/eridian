const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ERIDIAN_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-state-'));

const test = require('node:test');
const assert = require('node:assert');
const state = require('../scripts/lib/state');

test('readState returns default when file missing', () => {
  const s = state.readState();
  assert.deepStrictEqual(s, {
    current: 'off',
    events: [],
    buddy: {},
    promptsSinceReinject: 0,
  });
});

test('writeState then readState round-trips', () => {
  state.writeState({
    current: 'full',
    events: [{ ts: 'T', level: 'full' }],
    buddy: {},
  });
  assert.strictEqual(state.readState().current, 'full');
  assert.strictEqual(state.readState().events.length, 1);
});

test('readState survives corrupt file', () => {
  fs.writeFileSync(state.STATE_FILE, '{not json!!');
  assert.strictEqual(state.readState().current, 'off');
});

test('update applies mutation and persists', () => {
  state.writeState({ current: 'off', events: [], buddy: {} });
  const next = state.update((s) => {
    s.current = 'ultra';
    return s;
  });
  assert.strictEqual(next.current, 'ultra');
  assert.strictEqual(state.readState().current, 'ultra');
});

test('migrateLegacyStateDir renames old dir when new absent', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-mig-'));
  const legacy = path.join(base, 'rocky');
  const next = path.join(base, 'eridian');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, 'state.json'), '{"current":"full"}');
  state.migrateLegacyStateDir(legacy, next);
  assert.ok(!fs.existsSync(legacy), 'legacy dir gone');
  assert.strictEqual(
    JSON.parse(fs.readFileSync(path.join(next, 'state.json'), 'utf8')).current,
    'full'
  );
});

test('migrateLegacyStateDir keeps new dir when both exist', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-mig-'));
  const legacy = path.join(base, 'rocky');
  const next = path.join(base, 'eridian');
  fs.mkdirSync(legacy);
  fs.mkdirSync(next);
  fs.writeFileSync(path.join(next, 'state.json'), '{"current":"ultra"}');
  state.migrateLegacyStateDir(legacy, next);
  assert.ok(fs.existsSync(legacy), 'legacy left untouched');
  assert.strictEqual(
    JSON.parse(fs.readFileSync(path.join(next, 'state.json'), 'utf8')).current,
    'ultra'
  );
});

test('migrateLegacyStateDir no-ops when neither exists', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-mig-'));
  state.migrateLegacyStateDir(path.join(base, 'rocky'), path.join(base, 'eridian'));
  assert.ok(!fs.existsSync(path.join(base, 'eridian')));
});
