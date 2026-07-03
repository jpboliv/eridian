const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const {
  readSettings,
  hasStatusLine,
  buildStatusLineEntry,
  addStatusLine,
  writeSettings,
} = require('../scripts/lib/settings');

function freshFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-settings-'));
  return path.join(dir, 'settings.json');
}

test('readSettings returns empty object for a missing file', () => {
  const file = freshFile();
  assert.deepStrictEqual(readSettings(file), { ok: true, settings: {} });
});

test('readSettings fails on malformed JSON, does not default to {}', () => {
  const file = freshFile();
  fs.writeFileSync(file, '{ not valid json');
  const result = readSettings(file);
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /cannot parse/);
});

test('readSettings fails on non-object JSON (array)', () => {
  const file = freshFile();
  fs.writeFileSync(file, '[1, 2, 3]');
  const result = readSettings(file);
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /does not contain a JSON object/);
});

test('readSettings reads a valid existing file', () => {
  const file = freshFile();
  fs.writeFileSync(file, JSON.stringify({ foo: 'bar' }));
  assert.deepStrictEqual(readSettings(file), { ok: true, settings: { foo: 'bar' } });
});

test('hasStatusLine detects presence/absence', () => {
  assert.strictEqual(hasStatusLine({}), false);
  assert.strictEqual(hasStatusLine({ statusLine: {} }), true);
});

test('buildStatusLineEntry builds the expected command', () => {
  assert.deepStrictEqual(buildStatusLineEntry('/plugins/eridian'), {
    type: 'command',
    command: 'node "/plugins/eridian/scripts/statusline.js"',
  });
});

test('addStatusLine adds when absent, does not mutate input', () => {
  const original = { foo: 'bar' };
  const result = addStatusLine(original, '/plugins/eridian');
  assert.strictEqual(result.changed, true);
  assert.deepStrictEqual(original, { foo: 'bar' });
  assert.deepStrictEqual(result.settings, {
    foo: 'bar',
    statusLine: { type: 'command', command: 'node "/plugins/eridian/scripts/statusline.js"' },
  });
});

test('addStatusLine no-ops when already present', () => {
  const original = { statusLine: { type: 'command', command: 'existing' } };
  const result = addStatusLine(original, '/plugins/eridian');
  assert.strictEqual(result.changed, false);
  assert.strictEqual(result.settings, original);
});

test('writeSettings creates parent directory and writes atomically', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-settings-'));
  const file = path.join(dir, 'nested', 'settings.json');
  writeSettings(file, { statusLine: { type: 'command', command: 'x' } });
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(written, { statusLine: { type: 'command', command: 'x' } });
  assert.ok(!fs.existsSync(`${file}.tmp`));
});
