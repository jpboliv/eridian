const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveConfig, readConfig, repoRoot } = require('../scripts/lib/config');

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-config-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const user = path.join(dir, 'config', 'eridian');
  fs.mkdirSync(user, { recursive: true });
  const messages = [];
  return {
    dir,
    repo,
    user,
    options: {
      cwd: repo,
      home: dir,
      env: { XDG_CONFIG_HOME: path.dirname(user) },
      diagnostic: (s) => messages.push(s),
    },
    messages,
  };
}
const write = (file, mode) => fs.writeFileSync(file, JSON.stringify({ defaultMode: mode }));

test('resolves every precedence source, including explicit off and opt-out', (t) => {
  const f = fixture(t),
    o = f.options;
  assert.equal(resolveConfig(o).source, 'fallback');
  o.preference = 'ultra';
  assert.equal(resolveConfig(o).mode, 'ultra');
  write(path.join(f.user, 'config.json'), 'full');
  assert.equal(resolveConfig(o).source, 'user');
  write(path.join(f.repo, '.eridian.json'), 'lite');
  assert.equal(resolveConfig(o).mode, 'lite');
  o.env.ERIDIAN_DEFAULT_MODE = 'ultra';
  assert.equal(resolveConfig(o).source, 'environment');
  o.sessionOverride = 'off';
  assert.equal(resolveConfig(o).mode, 'off');
  o.sessionOverride = 'full';
  o.env.ERIDIAN_OFF = '1';
  assert.equal(resolveConfig(o).source, 'environment-opt-out');
  assert.equal(resolveConfig(o).mode, 'off');
  assert.equal(f.messages.length, 0);
});

test('bad sources fall through with one bounded diagnostic and no raw content', (t) => {
  const f = fixture(t);
  f.options.env.ERIDIAN_DEFAULT_MODE = 'unsafe';
  fs.writeFileSync(path.join(f.repo, '.eridian.json'), '{"defaultMode":"token-secret-contents"}');
  write(path.join(f.user, 'config.json'), 'lite');
  const r = resolveConfig(f.options);
  assert.equal(r.mode, 'lite');
  assert.equal(f.messages.length, 1);
  assert.ok(f.messages[0].length < 100);
  assert.ok(!f.messages[0].includes('token-secret'));
});

test('rejects oversized, malformed, non-object and unexpected config fields', (t) => {
  const f = fixture(t),
    file = path.join(f.repo, '.eridian.json');
  for (const content of [
    'x'.repeat(4097),
    '{',
    '[]',
    'null',
    '{"defaultMode":"eridian"}',
    '{"defaultMode":"lite","prompt":"inject"}',
  ]) {
    fs.writeFileSync(file, content);
    assert.equal(readConfig(file).invalid, true, content.slice(0, 30));
  }
  assert.equal(readConfig(f.repo).invalid, true);
  if (process.platform !== 'win32') assert.equal(readConfig('/dev/null').invalid, true);
});

test('rejects symlink files and parent directories; valid JSON is never treated as instructions', (t) => {
  const f = fixture(t),
    file = path.join(f.repo, '.eridian.json');
  write(path.join(f.dir, 'source.json'), 'lite');
  fs.symlinkSync(path.join(f.dir, 'source.json'), file);
  assert.equal(readConfig(file).invalid, true);
  fs.symlinkSync(f.user, path.join(f.dir, 'alias'));
  write(path.join(f.user, 'config.json'), 'full');
  assert.equal(readConfig(path.join(f.dir, 'alias/config.json')).invalid, true);
});

test('repo boundary honors worktree git files and never reads parent or nested config', (t) => {
  const f = fixture(t),
    child = path.join(f.repo, 'a/b');
  fs.mkdirSync(child, { recursive: true });
  write(path.join(f.dir, '.eridian.json'), 'ultra');
  write(path.join(child, '.eridian.json'), 'full');
  assert.equal(repoRoot(child), f.repo);
  assert.equal(resolveConfig({ ...f.options, cwd: child }).mode, 'off');
  write(path.join(f.repo, '.eridian.json'), 'lite');
  assert.equal(resolveConfig({ ...f.options, cwd: child }).mode, 'lite');
  const worktree = path.join(f.dir, 'worktree');
  fs.mkdirSync(worktree);
  fs.writeFileSync(path.join(worktree, '.git'), 'gitdir: elsewhere');
  assert.equal(repoRoot(worktree), worktree);
  const unversioned = path.join(f.dir, 'plain');
  fs.mkdirSync(unversioned);
  assert.equal(resolveConfig({ ...f.options, cwd: unversioned }).mode, 'off');
});
