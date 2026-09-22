const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');

function packagePath(value) {
  assert.equal(typeof value, 'string');
  assert.match(value, /^\.\//);
  const resolved = path.resolve(root, value);
  assert.ok(resolved === root || resolved.startsWith(`${root}${path.sep}`));
  return resolved;
}

test('Codex compatibility manifest selects only Codex skills and hooks inside the package', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const claude = JSON.parse(
    fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8')
  );
  assert.equal(manifest.name, 'eridian');
  assert.equal(manifest.version, claude.version);
  assert.equal(packagePath(manifest.skills), path.join(root, 'adapters', 'codex', 'skills'));
  assert.equal(packagePath(manifest.hooks), path.join(root, 'hooks', 'codex.json'));
  assert.ok(!JSON.stringify(manifest).includes('CLAUDE_PLUGIN_ROOT'));
  assert.ok(
    !JSON.stringify(
      JSON.parse(fs.readFileSync(manifest.hooks && path.join(root, manifest.hooks), 'utf8'))
    ).includes('CLAUDE_PLUGIN_ROOT')
  );
});

test('Codex skills expose every requested workflow without duplicating canonical dialect blocks', () => {
  const skillRoot = path.join(root, 'adapters', 'codex', 'skills');
  const names = fs.readdirSync(skillRoot).sort();
  assert.deepEqual(names, ['buddy', 'commit', 'compress', 'help', 'mode', 'review', 'stats']);
  for (const name of names) {
    const text = fs.readFileSync(path.join(skillRoot, name, 'SKILL.md'), 'utf8');
    assert.match(text, /^---\nname: /);
    assert.ok(!text.includes('<!-- eridian:inject:'));
    assert.ok(!text.includes('$ARGUMENTS'));
    assert.ok(!text.includes('CLAUDE_PLUGIN_ROOT'));
  }
});

test('Codex distribution builder excludes local planning and evaluation data', () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-dist-'));
  const output = path.join(destination, 'package');
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-codex-package.js'), output], {
    encoding: 'utf8',
  });
  const pluginRoot = path.join(output, 'plugin');
  assert.ok(fs.existsSync(path.join(pluginRoot, '.codex-plugin', 'plugin.json')));
  assert.ok(fs.existsSync(path.join(pluginRoot, 'hooks', 'codex.json')));
  assert.ok(fs.existsSync(path.join(pluginRoot, 'skills', 'speak', 'SKILL.md')));
  const forbidden = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const current = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(current);
      else if (/docs\/(superpowers|tickets)|worktrees|eval\/(runs|reviews|snapshots)/.test(current))
        forbidden.push(current);
    }
  };
  visit(output);
  assert.deepEqual(forbidden, []);
  assert.ok(fs.existsSync(path.join(output, '.agents', 'plugins', 'marketplace.json')));
});
