const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'validate-compress.js');

function writeTemp(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-validate-'));
  const file = path.join(dir, 'file.md');
  fs.writeFileSync(file, content);
  return file;
}

test('validate-compress.js exits 0 and prints PASS for a valid compression', () => {
  const original = writeTemp('# Title\n\nVerbose text about things.\n\n```bash\nnpm test\n```\n');
  const draft = writeTemp('# Title\n\nDense text.\n\n```bash\nnpm test\n```\n');
  const out = execFileSync('node', [SCRIPT, original, draft], { encoding: 'utf8' });
  assert.match(out, /^PASS/);
  assert.match(out, /headings 1\/1/);
  assert.match(out, /code-blocks 1\/1/);
});

test('validate-compress.js exits 1 and prints FAIL reasons when a code block changes', () => {
  const original = writeTemp('# Title\n\n```bash\nnpm test\n```\n');
  const draft = writeTemp('# Title\n\n```bash\nnpm run test\n```\n');
  assert.throws(
    () => execFileSync('node', [SCRIPT, original, draft], { encoding: 'utf8' }),
    (err) => {
      assert.strictEqual(err.status, 1);
      assert.match(err.stdout.toString(), /^FAIL/);
      assert.match(err.stdout.toString(), /code block dropped or altered/);
      return true;
    }
  );
});

test('validate-compress.js exits 1 when the draft file is empty', () => {
  const original = writeTemp('# Title\n\ntext\n');
  const draft = writeTemp('   \n');
  assert.throws(
    () => execFileSync('node', [SCRIPT, original, draft], { encoding: 'utf8' }),
    (err) => {
      assert.strictEqual(err.status, 1);
      assert.match(err.stdout.toString(), /draft is empty/);
      return true;
    }
  );
});
