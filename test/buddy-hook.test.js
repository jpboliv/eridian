const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const test = require('node:test');
const assert = require('node:assert');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'buddy-hook.js');

function run(mode, stdinJson, stateDir) {
  return execFileSync('node', [SCRIPT, mode], {
    env: { ...process.env, ERIDIAN_STATE_DIR: stateDir },
    input: JSON.stringify(stdinJson),
    encoding: 'utf8',
  });
}

function readStateFile(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
}

function writeStateFile(dir, state) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
}

test('prompt event records timestamp and class', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-bh-'));
  const out = run('prompt', { prompt: 'fix the crash please' }, dir);
  assert.strictEqual(out, '');
  const s = readStateFile(dir);
  assert.strictEqual(s.buddy.promptClass, 'bugfix');
  assert.ok(s.buddy.lastPromptAt);
});

test('post-tool records lastToolAt, no error field on success', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-bh-'));
  run('post-tool', { tool_name: 'Read', tool_response: { ok: true } }, dir);
  const s = readStateFile(dir);
  assert.ok(s.buddy.lastToolAt);
  assert.strictEqual(s.buddy.lastErrorAt, undefined);
});

test('post-tool records lastErrorAt on error-looking response', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-bh-'));
  run('post-tool', { tool_name: 'Bash', tool_response: { is_error: true } }, dir);
  assert.ok(readStateFile(dir).buddy.lastErrorAt);
});

test('prompt event reinjects persona block once enough prompts accumulate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-bh-'));
  writeStateFile(dir, {
    current: 'full',
    events: [],
    cache: null,
    buddy: {},
    promptsSinceReinject: 999,
  });
  const out = run('prompt', { prompt: 'fix the crash please' }, dir);
  assert.match(out, /ROCKY MODE \(full\)/);
  assert.strictEqual(readStateFile(dir).promptsSinceReinject, 0);
});

test('prompt event stays silent before the reinject threshold', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-bh-'));
  writeStateFile(dir, {
    current: 'full',
    events: [],
    cache: null,
    buddy: {},
    promptsSinceReinject: 1,
  });
  const out = run('prompt', { prompt: 'fix the crash please' }, dir);
  assert.strictEqual(out, '');
});

test('prompt event never reinjects when eridian mode is off', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-bh-'));
  writeStateFile(dir, {
    current: 'off',
    events: [],
    cache: null,
    buddy: {},
    promptsSinceReinject: 999,
  });
  const out = run('prompt', { prompt: 'fix the crash please' }, dir);
  assert.strictEqual(out, '');
});

test('garbage stdin exits 0 silently', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-bh-'));
  const out = execFileSync('node', [SCRIPT, 'prompt'], {
    env: { ...process.env, ERIDIAN_STATE_DIR: dir },
    input: '{{{not json',
    encoding: 'utf8',
  });
  assert.strictEqual(out, '');
});
