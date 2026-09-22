require('./helpers/env').isolateEnv();
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-compress-path.js');

test('check-compress-path.js exits 0 and prints ok for a safe path', () => {
  const out = execFileSync('node', [SCRIPT, './CLAUDE.md'], { encoding: 'utf8' });
  assert.match(out, /^ok/);
});

test('check-compress-path.js exits 1 and prints a refusal for a .env path', () => {
  assert.throws(
    () => execFileSync('node', [SCRIPT, '/some/project/.env'], { encoding: 'utf8' }),
    (err) => {
      assert.strictEqual(err.status, 1);
      assert.match(err.stdout.toString(), /^refuse:/);
      return true;
    }
  );
});

test('refuses sensitive and safe symlink aliases, including directory links', (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-path-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, '.env.local'), 'private');
  fs.writeFileSync(path.join(dir, 'notes.md'), 'notes');
  fs.symlinkSync(path.join(dir, '.env.local'), path.join(dir, 'innocent.md'));
  fs.symlinkSync(path.join(dir, 'notes.md'), path.join(dir, 'safe-link.md'));
  fs.symlinkSync(dir, path.join(dir, 'linked-directory'));
  for (const file of ['innocent.md', 'safe-link.md', 'linked-directory/notes.md']) {
    assert.throws(
      () => execFileSync('node', [SCRIPT, path.join(dir, file)]),
      (error) => {
        assert.match(error.stdout.toString(), /symlink/);
        return error.status === 1;
      }
    );
  }
  assert.match(execFileSync('node', [SCRIPT, path.join(dir, 'notes.md')]).toString(), /^ok/);
});

test('refuses hard-linked aliases of sensitive files', (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-hardlink-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, '.env.local'), 'private');
  fs.linkSync(path.join(dir, '.env.local'), path.join(dir, 'notes.md'));
  assert.throws(
    () => execFileSync('node', [SCRIPT, path.join(dir, 'notes.md')]),
    (error) => {
      assert.match(error.stdout.toString(), /hard links/);
      return error.status === 1;
    }
  );
});

test('refuses directory and device targets before reading them', (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-nonregular-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const targets = [dir];
  if (process.platform !== 'win32') targets.push('/dev/null', '/dev/zero');
  for (const target of targets) {
    assert.throws(
      () => execFileSync('node', [SCRIPT, target]),
      (error) => {
        assert.match(error.stdout.toString(), /not a regular file/);
        return error.status === 1;
      }
    );
  }
  assert.match(execFileSync('node', [SCRIPT, path.join(dir, 'new-draft.tmp')]).toString(), /^ok/);
});
