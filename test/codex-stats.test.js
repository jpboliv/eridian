const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const { readNormalizedEvents, MAX_LINE_BYTES } = require('../scripts/codex/usage');

const scripts = path.join(__dirname, '..', 'scripts', 'codex');
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-stats-'));
  const env = { ...process.env };
  for (const key of ['CODEX_THREAD_ID', 'CODEX_HOME', 'ERIDIAN_DEFAULT_MODE', 'ERIDIAN_OFF'])
    delete env[key];
  env.ERIDIAN_STATE_DIR = dir;
  env.XDG_CONFIG_HOME = path.join(dir, 'xdg');
  const run = (script, args = [], extra = {}) =>
    spawnSync(process.execPath, [path.join(scripts, script), ...args], {
      cwd: dir,
      env: { ...env, ...extra },
      encoding: 'utf8',
    });
  return { dir, run };
}
function eventsFile(dir) {
  const valid = {
    version: 1,
    type: 'assistant',
    session_id: 'thread-a',
    id: 'm1',
    model: 'codex-test',
    timestamp: '2026-09-22T10:01:00.000Z',
    usage: { output_tokens: 12 },
    content: [{ type: 'text', text: 'Plain prose reply.' }],
  };
  const file = path.join(dir, 'events.jsonl');
  fs.writeFileSync(
    file,
    [
      JSON.stringify(valid),
      '{not json',
      JSON.stringify({ ...valid, session_id: 'other' }),
      JSON.stringify({
        ...valid,
        id: 'huge',
        content: [{ type: 'text', text: 'x'.repeat(MAX_LINE_BYTES) }],
      }),
    ].join('\n') + '\n'
  );
  return file;
}

test('the usage reader counts malformed, unsupported and oversized records separately', () => {
  const f = fixture();
  const result = readNormalizedEvents(eventsFile(f.dir), 'thread-a');
  assert.equal(result.events.length, 1);
  assert.equal(result.malformed, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.oversized, 1);
});

test('stats prints the input summary and diagnostics counts when normalized events are supplied', () => {
  const f = fixture();
  const file = eventsFile(f.dir);
  const result = f.run('stats.js', ['--events', file, '--diagnostics', '--language', 'en'], {
    CODEX_THREAD_ID: 'thread-a',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /normalized Codex input v1 \(1 events; 1 unsupported records; 1 malformed records; 1 oversized records\)/
  );
  assert.match(result.stdout, /unavailable \(no applicable Codex prose calibration\)/);
  assert.match(result.stdout, /unsupported: 1; malformed: 1; oversized: 1/);
});

test('stats and buddy report an identity conflict as an error like mode does', () => {
  const f = fixture();
  for (const script of ['stats.js', 'buddy.js']) {
    const result = f.run(script, ['--session-id', 'a'], { CODEX_THREAD_ID: 'b' });
    assert.equal(result.status, 1, `${script} should exit 1`);
    assert.match(result.stderr, /conflicts with CODEX_THREAD_ID/);
  }
});
