const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');
const builder = path.join(root, 'scripts', 'build-codex-package.js');

function packagePath(value) {
  assert.equal(typeof value, 'string');
  assert.match(value, /^\.\//);
  const resolved = path.resolve(root, value);
  assert.ok(resolved === root || resolved.startsWith(`${root}${path.sep}`));
  return resolved;
}
function build(args) {
  return spawnSync(process.execPath, [builder, ...args], { encoding: 'utf8' });
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
  assert.match(
    fs.readFileSync(path.join(skillRoot, 'compress', 'SKILL.md'), 'utf8'),
    /scripts\/codex\/backup\.js/
  );
});

test('Codex distribution builder excludes local planning data and ships a self-contained package', () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-dist-'));
  const output = path.join(destination, 'package');
  execFileSync(process.execPath, [builder, output], { encoding: 'utf8' });
  const pluginRoot = path.join(output, 'plugin');
  for (const relative of [
    '.codex-plugin/plugin.json',
    'hooks/codex.json',
    'skills/speak/SKILL.md',
    'scripts/codex/backup.js',
    'scripts/lib/accounting-core.js',
  ])
    assert.ok(fs.existsSync(path.join(pluginRoot, relative)), relative);
  for (const relative of ['scripts/codex/paths.js', 'scripts/lib/normalized-accounting.js'])
    assert.equal(fs.existsSync(path.join(pluginRoot, relative)), false, relative);
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
  const stateDir = path.join(destination, 'state');
  const env = { ...process.env, ERIDIAN_STATE_DIR: stateDir, ERIDIAN_OFF: '0' };
  delete env.CODEX_THREAD_ID;
  for (const [script, args] of [
    ['scripts/codex/mode.js', ['status']],
    ['scripts/codex/stats.js', ['--diagnostics', '--language', 'en']],
    ['scripts/codex/buddy.js', []],
    ['scripts/check-compress-path.js', ['./AGENTS.md']],
  ]) {
    const result = spawnSync(process.execPath, [path.join(pluginRoot, script), ...args], {
      cwd: destination,
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
  }
});

test('Codex distribution builder refuses to overwrite unless --force targets a previous build', () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-codex-dist-'));
  const output = path.join(destination, 'package');
  assert.equal(build([output]).status, 0);
  const again = build([output]);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
  const forced = build([output, '--force']);
  assert.equal(forced.status, 0, forced.stderr);
  assert.ok(fs.existsSync(path.join(output, 'plugin', '.codex-plugin', 'plugin.json')));
  const unrelated = path.join(destination, 'unrelated');
  fs.mkdirSync(unrelated);
  fs.writeFileSync(path.join(unrelated, 'keep.txt'), 'keep');
  const refused = build([unrelated, '--force']);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /not a previous Codex build/);
  assert.equal(fs.readFileSync(path.join(unrelated, 'keep.txt'), 'utf8'), 'keep');
});
