require('./helpers/env').isolateEnv();
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
  assert.strictEqual(state.readState().events.length, 0);
  assert.strictEqual(state.readStore().legacy.events.length, 1);
});

test('readState prunes retired keys from old state files', () => {
  state.writeState({ current: 'full', events: [], buddy: {}, buddyStyle: 'tall' });
  assert.ok(!('buddyStyle' in state.readState()), 'buddyStyle pruned');
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

test('malformed schema-2 containers recover while preserving valid preferences', () => {
  state.writeState({
    version: 2,
    preferences: { current: 'ultra', buddy: { stepSeconds: 2 } },
    sessions: null,
  });
  assert.equal(state.readState().current, 'ultra');
  state.updateSession('alpha', (s) => s, { initialize: true });
  assert.equal(state.readState('alpha').current, 'ultra');
  assert.equal(state.readState('alpha').buddy.stepSeconds, 2);
  state.writeState({ version: 2 });
  assert.equal(state.readState().current, 'off');
  state.updateSession('alpha', (s) => s, { initialize: true });
  assert.equal(state.readState('alpha').current, 'off');
});
test('future schemas are never downgraded or overwritten', () => {
  state.writeState({ version: 99, preferences: { current: 'ultra' } });
  const before = fs.readFileSync(state.STATE_FILE, 'utf8');
  assert.throws(() => state.update((s) => s), /Unsupported/);
  assert.equal(fs.readFileSync(state.STATE_FILE, 'utf8'), before);
  state.writeState({ current: 'off' });
});

test('concurrent updates from many processes keep state.json valid and the mode intact', async () => {
  const { spawn } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-race-'));
  const file = path.join(dir, 'state.json');
  fs.writeFileSync(file, JSON.stringify({ version: 2, preferences: { current: 'full' } }));
  const script = `
    const s = require(${JSON.stringify(require.resolve('../scripts/lib/state'))});
    for (let i = 0; i < 40; i++) {
      s.update((x) => x);
      s.updateSession('w' + process.pid, (x) => x, { initialize: true });
    }`;
  const env = { ...process.env, ERIDIAN_STATE_DIR: dir };
  const codes = await Promise.all(
    Array.from(
      { length: 8 },
      () =>
        new Promise((resolve) =>
          spawn(process.execPath, ['-e', script], { env, stdio: 'ignore' }).on('exit', resolve)
        )
    )
  );
  assert.deepEqual(codes, Array(8).fill(0), 'every worker finished its updates');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(parsed.preferences.current, 'full');
  assert.deepEqual(
    fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')),
    [],
    'no orphaned temp files'
  );
});

test('update leaves a corrupt state.json untouched instead of resetting it', () => {
  for (const corrupt of ['{"version":2,"preferences":{"current":"fu', 'null', '[]']) {
    fs.writeFileSync(state.STATE_FILE, corrupt);
    assert.throws(() => state.update((s) => s), /unreadable \(.+\)/);
    assert.throws(
      () => state.updateSession('beta', (s) => s, { initialize: true }),
      /unreadable \(.+\)/
    );
    assert.equal(fs.readFileSync(state.STATE_FILE, 'utf8'), corrupt);
    assert.equal(state.readState().current, 'off', 'readers still fall back to defaults');
  }
  state.writeState({ current: 'off' });
});

test('Claude and Codex hooks keep the mode on a corrupt state.json and leave it untouched', () => {
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-corrupt-'));
  const corrupt = '{"version":2,"preferences":{"current":"fu';
  const files = [path.join(dir, 'state.json'), path.join(dir, 'codex', 'state.json')];
  fs.mkdirSync(path.join(dir, 'codex'));
  for (const file of files) fs.writeFileSync(file, corrupt);
  const input = JSON.stringify({ session_id: 'gamma', cwd: dir, source: 'startup', prompt: 'hi' });
  const scripts = path.join(__dirname, '..', 'scripts');
  for (const [script, args] of [
    ['session-start.js', []],
    ['buddy-hook.js', ['prompt']],
    ['buddy-hook.js', ['post-tool']],
    ['statusline.js', []],
    ['codex/session-start.js', []],
  ]) {
    const result = spawnSync(process.execPath, [path.join(scripts, script), ...args], {
      cwd: dir,
      // An active mode, so statusline.js reaches its write.
      env: { ...process.env, ERIDIAN_STATE_DIR: dir, ERIDIAN_DEFAULT_MODE: 'full' },
      input,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${script} exit code`);
    assert.equal(result.stderr, '', `${script} stderr`);
    if (script.endsWith('session-start.js')) {
      const out = JSON.parse(result.stdout);
      assert.match(out.systemMessage, /unreadable.*mode not saved/, `${script} notice`);
      assert.match(out.hookSpecificOutput.additionalContext, /Eridian mode "full"/, script);
    }
    if (script === 'statusline.js') assert.match(result.stdout, /∙ full/, 'statusline renders');
  }
  for (const file of files) assert.equal(fs.readFileSync(file, 'utf8'), corrupt);
});

test('Claude and Codex commands report a corrupt state.json in one line and leave it untouched', () => {
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-corrupt-cmd-'));
  const files = [path.join(dir, 'state.json'), path.join(dir, 'codex', 'state.json')];
  const corrupt = '{"version":2,';
  fs.mkdirSync(path.join(dir, 'codex'));
  for (const file of files) fs.writeFileSync(file, corrupt);
  const scripts = path.join(__dirname, '..', 'scripts');
  for (const [script, args, prefix] of [
    ['mode.js', ['full', '--session-id', 'delta'], 'eridian mode failed'],
    ['mode.js', ['full'], 'eridian mode failed'],
    ['buddy-speed.js', ['3'], 'eridian buddy failed'],
    ['codex/mode.js', ['full'], 'eridian mode failed'],
    ['codex/buddy.js', ['3'], 'eridian buddy failed'],
  ]) {
    const result = spawnSync(process.execPath, [path.join(scripts, script), ...args], {
      env: { ...process.env, ERIDIAN_STATE_DIR: dir },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, `${script} exit code`);
    assert.match(result.stderr, new RegExp(`^${prefix}: .*unreadable.*\\n$`), script);
    assert.equal(result.stdout, '', `${script} claims nothing on stdout`);
  }
  for (const file of files) assert.equal(fs.readFileSync(file, 'utf8'), corrupt);
});
