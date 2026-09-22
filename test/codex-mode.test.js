const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const { codexPaths } = require('../scripts/lib/host-paths');
const { normalizeEvent, readNormalizedEvents } = require('../scripts/codex/usage');

const mode = path.join(__dirname, '..', 'scripts', 'codex', 'mode.js');
function dir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-mode-'));
}
function run(args, stateDir, extra = {}) {
  return execFileSync(process.execPath, [mode, ...args], {
    env: { ...process.env, ERIDIAN_STATE_DIR: stateDir, ERIDIAN_OFF: '0', ...extra },
    cwd: stateDir,
    encoding: 'utf8',
  });
}

test('mode supports aliases, off, toggle, status, and preference-only fallback', () => {
  const stateDir = dir();
  assert.match(run(['eridian'], stateDir), /eridian preference \(session unavailable\): ultra/);
  assert.match(run([], stateDir), /eridian preference \(session unavailable\): off/);
  assert.match(run(['status'], stateDir), /host: codex/);
  assert.equal(fs.existsSync(path.join(stateDir, 'codex', 'state.json')), true);
});

test('mode rejects conflicting command and environment identities', () => {
  const result = spawnSync(process.execPath, [mode, 'full', '--session-id', 'a'], {
    env: { ...process.env, ERIDIAN_STATE_DIR: dir(), CODEX_THREAD_ID: 'b' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /conflicts/);
});

test('Codex path helper rejects the Claude store and uses a child override directory', () => {
  const home = dir();
  assert.throws(
    () => codexPaths({ env: { CODEX_HOME: path.join(home, '.claude') }, home }),
    /cannot be the Claude state directory/
  );
  assert.equal(
    codexPaths({ env: { ERIDIAN_STATE_DIR: path.join(home, 'shared') }, home }).stateDir,
    path.join(home, 'shared', 'codex')
  );
});

test('Codex usage adapter rejects unversioned or wrong-session transcript-shaped data', () => {
  assert.equal(normalizeEvent({ type: 'assistant', id: 'x' }, 'thread'), null);
  assert.equal(
    normalizeEvent(
      {
        version: 1,
        type: 'assistant',
        session_id: 'thread',
        timestamp: '2026-09-22T10:00:00.000Z',
        usage: { output_tokens: 4 },
      },
      'thread'
    ).id,
    null
  );
  const file = path.join(dir(), 'events.jsonl');
  fs.writeFileSync(
    file,
    JSON.stringify({ type: 'assistant', version: 1, session_id: 'other' }) + '\n'
  );
  const result = readNormalizedEvents(file, 'thread');
  assert.equal(result.events.length, 0);
  assert.equal(result.unknown, 1);
});
