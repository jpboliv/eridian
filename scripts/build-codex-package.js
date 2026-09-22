#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '..');
const destination = path.resolve(
  process.argv[2] || path.join(sourceRoot, 'dist', 'codex-marketplace')
);
if (destination === sourceRoot)
  throw new Error('Codex distribution destination cannot be the repository root');
if (fs.existsSync(destination)) throw new Error(`destination already exists: ${destination}`);

const pluginRoot = path.join(destination, 'plugin');
const files = [
  '.codex-plugin/plugin.json',
  'hooks/codex.json',
  'skills/speak/SKILL.md',
  'scripts/check-compress-path.js',
  'scripts/validate-compress.js',
  'scripts/codex/buddy-hook.js',
  'scripts/codex/buddy.js',
  'scripts/codex/diagnostics.js',
  'scripts/codex/input.js',
  'scripts/codex/mode.js',
  'scripts/codex/paths.js',
  'scripts/codex/prompt.js',
  'scripts/codex/session-start.js',
  'scripts/codex/stats.js',
  'scripts/codex/store.js',
  'scripts/codex/usage.js',
  'scripts/lib/atomic.js',
  'scripts/lib/buddy-art.js',
  'scripts/lib/buddy.js',
  'scripts/lib/classify.js',
  'scripts/lib/compress-guard.js',
  'scripts/lib/config.js',
  'scripts/lib/host-paths.js',
  'scripts/lib/mode-service.js',
  'scripts/lib/normalized-accounting.js',
  'scripts/lib/persona.js',
  'scripts/lib/readcost-lexicon.js',
  'scripts/lib/readcost.js',
  'scripts/lib/reinforcement.js',
  'scripts/lib/runtime.js',
  'scripts/lib/stats-lib.js',
  'scripts/lib/state-store.js',
  'scripts/statusline.js',
];
const skillFiles = fs
  .readdirSync(path.join(sourceRoot, 'adapters', 'codex', 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `adapters/codex/skills/${entry.name}/SKILL.md`);

for (const relative of [...files, ...skillFiles]) {
  const from = path.join(sourceRoot, relative);
  if (!fs.statSync(from).isFile()) throw new Error(`missing package resource: ${relative}`);
  const to = path.join(pluginRoot, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

const marketplace = {
  name: 'eridian',
  description: 'Eridian Codex compatibility package',
  plugins: [
    {
      name: 'eridian',
      source: { source: 'local', path: './plugin' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      interface: {
        displayName: 'Eridian',
        shortDescription: 'Rocky-speak and safe workflows for Codex',
      },
    },
  ],
};
fs.mkdirSync(path.join(destination, '.agents', 'plugins'), { recursive: true });
fs.writeFileSync(
  path.join(destination, '.agents', 'plugins', 'marketplace.json'),
  `${JSON.stringify(marketplace, null, 2)}\n`,
  { mode: 0o600 }
);
console.log(`Codex package written: ${pluginRoot}`);
console.log(`Marketplace: ${destination}`);
