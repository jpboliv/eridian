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
