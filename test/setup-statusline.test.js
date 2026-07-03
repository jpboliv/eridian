const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'setup-statusline.js');

function freshFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-setup-statusline-'));
  return path.join(dir, 'settings.json');
}

function run(args, settingsFile) {
  return execFileSync('node', [SCRIPT, ...args], {
    env: { ...process.env, ERIDIAN_SETTINGS_FILE: settingsFile },
    encoding: 'utf8',
  });
}

test('check on a fresh file prints not-configured', () => {
  const out = run(['check', '/plugins/eridian'], freshFile());
  assert.match(out, /^not-configured/);
});

test('apply adds the statusLine and writes the file', () => {
  const file = freshFile();
  const out = run(['apply', '/plugins/eridian'], file);
  assert.match(out, /^added:/);
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(written.statusLine.command, 'node "/plugins/eridian/scripts/statusline.js"');
});

test('apply is idempotent — second call no-ops', () => {
  const file = freshFile();
  run(['apply', '/plugins/eridian'], file);
  const out = run(['apply', '/plugins/eridian'], file);
  assert.match(out, /^already-configured:/);
});

test('check after apply reports already-configured', () => {
  const file = freshFile();
  run(['apply', '/plugins/eridian'], file);
  const out = run(['check', '/plugins/eridian'], file);
  assert.match(out, /^already-configured:/);
});

test('malformed settings file errors without writing', () => {
  const file = freshFile();
  fs.writeFileSync(file, '{ not valid');
  assert.throws(
    () => run(['check', '/plugins/eridian'], file),
    (err) => {
      assert.strictEqual(err.status, 1);
      assert.match(err.stdout.toString(), /^error:/);
      return true;
    }
  );
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{ not valid');
});
