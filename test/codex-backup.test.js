const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const { isolateEnv } = require('./helpers/env');

const backup = path.join(__dirname, '..', 'scripts', 'codex', 'backup.js');
function fixture() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-backup-')));
  const env = isolateEnv({ ...process.env });
  env.ERIDIAN_STATE_DIR = dir;
  const run = (args) =>
    spawnSync(process.execPath, [backup, ...args], { cwd: dir, env, encoding: 'utf8' });
  return { dir, run, backups: path.join(dir, 'codex', 'backups') };
}

test('backup copies the target into the Codex store with exclusive creation and verifies bytes', () => {
  const f = fixture();
  const target = path.join(f.dir, 'AGENTS.md');
  fs.writeFileSync(target, '# Agents\n\nKeep tests green.\n');
  const first = f.run([target]);
  assert.equal(first.status, 0, first.stderr);
  const printed = first.stdout.match(/^backup: (.+)$/m);
  assert.ok(printed, first.stdout);
  assert.equal(path.dirname(printed[1]), f.backups);
  assert.match(path.basename(printed[1]), /^\d{8}T\d{6}Z-.*AGENTS\.md$/);
  assert.equal(fs.readFileSync(printed[1], 'utf8'), fs.readFileSync(target, 'utf8'));
  const second = f.run([target]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readdirSync(f.backups).length, 2);
  assert.equal(fs.readFileSync(target, 'utf8'), '# Agents\n\nKeep tests green.\n');
});

test('backup refuses missing, unsafe and non-regular targets without creating files', () => {
  const f = fixture();
  const missing = f.run([path.join(f.dir, 'nope.md')]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /backup failed/);
  const real = path.join(f.dir, 'real.md');
  fs.writeFileSync(real, 'x');
  const link = path.join(f.dir, 'link.md');
  fs.symlinkSync(real, link);
  const symlink = f.run([link]);
  assert.equal(symlink.status, 1);
  assert.match(symlink.stderr, /symlink/);
  const none = f.run([]);
  assert.equal(none.status, 1);
  assert.equal(fs.existsSync(f.backups), false);
});
